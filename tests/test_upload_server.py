"""Tests of tools/upload_server.py. Each expected result comes from issue #74: the fixture API decides each
file, gives a receipt for each request and keeps the files in memory only."""
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import upload_server  # noqa: E402

PATH = '/api/tickets/T-2041/files'
PDF = b'%PDF-1.4\n% Synthetic receipt A. Amount: 12 units.\n'
ID = '00000000-0000-4000-8000-00000000000%d'


class UploadServerTest(unittest.TestCase):
    def setUp(self):
        # Each test gets a new server, so each test starts with no file.
        self.server = upload_server.make_server(0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def call(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, data

    def post(self, name='receipt-a.pdf', data=PDF, kind='application/pdf', number=1, **headers):
        base = {'Content-Type': kind, 'X-File-Name': name, 'X-Request-Id': ID % number}
        status, body = self.call('POST', PATH, data, {**base, **headers})
        return status, json.loads(body) if body else None

    def files(self):
        status, body = self.call('GET', PATH)
        self.assertEqual(status, 200)
        return json.loads(body)['files']

    def test_a_pdf_file_gets_a_receipt_and_the_api_keeps_it(self):
        self.assertEqual(self.files(), [])
        status, receipt = self.post()
        self.assertEqual(status, 200)
        self.assertEqual(receipt, {'id': ID % 1, 'ok': True, 'message': 'The file is on ticket T-2041.', 'reference': 'F-0001'})
        self.assertEqual(self.files(), [{'reference': 'F-0001', 'name': 'receipt-a.pdf', 'size': len(PDF)}])
        self.assertEqual(self.server.state['files'][0]['data'], PDF)

    def test_the_api_decides_each_file_again(self):
        cases = [
            ({'kind': 'text/plain'}, 'The API accepts only PDF files.'),
            ({'name': 'receipt-a.txt'}, 'The API accepts only PDF files.'),
            ({'name': '.pdf'}, 'The API accepts only PDF files.'),
            ({'data': b'plain text'}, 'The content of the file is not a PDF document.'),
            ({'data': PDF + b'x' * upload_server.MAX_SIZE}, 'The file is larger than the limit of 2 MB.'),
        ]
        for change, message in cases:
            with self.subTest(message=message, change=sorted(change)):
                status, receipt = self.post(**change)
                self.assertEqual((status, receipt), (200, {'id': ID % 1, 'ok': False, 'message': message}))
        self.assertEqual(self.files(), [])

    def test_the_api_keeps_three_files_and_no_file_two_times(self):
        for number in (1, 2, 3):
            self.assertTrue(self.post(name='receipt-%d.pdf' % number, number=number)[1]['ok'])
        self.assertEqual(self.post(name='receipt-4.pdf', number=4)[1],
                         {'id': ID % 4, 'ok': False, 'message': 'The ticket already has 3 files.'})
        self.assertEqual([item['reference'] for item in self.files()], ['F-0001', 'F-0002', 'F-0003'])

    def test_the_api_does_not_read_a_very_large_body(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        connection.putrequest('POST', PATH)
        for name, value in [('Content-Type', 'application/pdf'), ('X-File-Name', 'receipt-a.pdf'), ('X-Request-Id', ID % 1),
                            ('Content-Length', str(upload_server.MAX_DISCARD + 1))]:
            connection.putheader(name, value)
        connection.endheaders()
        # The test sends no body. The API answers from the headers only.
        self.assertEqual(connection.getresponse().status, 413)
        connection.close()
        self.assertEqual(self.files(), [])

    def test_a_second_file_with_the_same_name_is_refused(self):
        self.assertTrue(self.post()[1]['ok'])
        self.assertEqual(self.post(number=2)[1], {'id': ID % 2, 'ok': False, 'message': 'The ticket already has a file with this name.'})

    def test_a_file_name_is_text_and_cannot_be_a_path(self):
        self.assertTrue(self.post(name='%3Cimg%20src%3Dx%3E.pdf')[1]['ok'])
        self.assertEqual(self.files()[0]['name'], '<img src=x>.pdf')
        for name in ['', '..%2Freceipt.pdf', 'a%5Cb.pdf', 'a%00.pdf', '%ff.pdf', 'x' * 256 + '.pdf']:
            with self.subTest(name=name):
                self.assertEqual(self.post(name=name, number=2)[0], 400)

    def test_a_request_needs_a_valid_id_this_host_and_this_origin(self):
        self.assertEqual(self.post(**{'X-Request-Id': 'r-1'})[0], 400)
        self.assertEqual(self.post(Origin='http://example.org')[0], 403)
        self.assertEqual(self.post(Host='example.org')[0], 403)
        self.assertEqual(self.post(Origin='http://127.0.0.1:%d' % self.port)[0], 200)
        self.assertEqual(self.call('POST', '/api/tickets/T-0001/files', PDF)[0], 404)
        self.assertEqual(self.call('GET', PATH, headers={'Host': 'example.org'})[0], 403)

    def test_the_api_writes_no_file(self):
        # The fixture keeps each file in the memory of its process only.
        with mock.patch('builtins.open', side_effect=AssertionError('the API opened a file')), \
                mock.patch('pathlib.Path.write_bytes', side_effect=AssertionError('the API wrote a file')):
            self.assertTrue(self.post()[1]['ok'])
        source = (ROOT / 'tools' / 'upload_server.py').read_text(encoding='utf-8')
        for word in ['open(', 'write_bytes', 'write_text', 'tempfile', 'shutil', 'os.']:
            self.assertNotIn(word, source, word)

    def test_the_server_gives_the_example_page_and_no_other_file(self):
        self.assertEqual(self.call('GET', '/examples/forms/upload.html')[0], 200)
        self.assertEqual(self.call('GET', '/tools/upload_server.py')[0], 404)
        self.assertEqual(self.call('GET', '/events')[0], 404)


if __name__ == '__main__':
    unittest.main()
