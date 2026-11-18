"""Tests of tools/serve.py, the file server of the README quickstart. Each expected result comes from
issue #111: the server gives the files of src/, catalog/ and examples/ only, on 127.0.0.1 only, with no API.
Its listen queue holds the connections of one example page."""
import http.client
from pathlib import Path
import re
import subprocess
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT / 'tests'))
import serve  # noqa: E402
from test_thread_server import hold  # noqa: E402

COMMAND = 'python3 tools/serve.py'
DOCS = ['README.md', 'docs/guides/contracts.md', 'docs/guides/assemble.md', 'docs/guides/theme.md']


class ServeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = serve.make_server(0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def call(self, method, path, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        response.read()
        connection.close()
        return response.status, response.getheader('Content-Type', '')

    def test_the_server_gives_the_files_of_the_served_folders(self):
        self.assertEqual(self.call('GET', serve.START), (200, 'text/html; charset=utf-8'))
        self.assertEqual(self.call('GET', '/src/thread/index.js'), (200, 'text/javascript; charset=utf-8'))
        self.assertEqual(self.call('GET', '/catalog/card.json'), (200, 'application/json; charset=utf-8'))
        self.assertEqual(self.call('GET', '/src/thread/index.js?mode=dark')[0], 200)

    def test_a_folder_path_gives_the_index_page_of_the_folder(self):
        self.assertEqual(self.call('GET', '/examples/apps/'), (200, 'text/html; charset=utf-8'))
        self.assertEqual(self.call('GET', '/examples/apps')[0], 404)
        self.assertEqual(self.call('GET', '/src/')[0], 404)

    def test_each_other_path_is_refused(self):
        for path in ['/', '/tools/serve.py', '/src/../tools/build.py', '/README.md', '/.git/config', '/.git/', '/examples/missing.js',
                     '/docs/screenshots/', '/examples/../README.md']:
            self.assertEqual(self.call('GET', path)[0], 404, path)

    def test_the_server_has_no_api(self):
        self.assertEqual(self.call('GET', '/events')[0], 404)
        self.assertEqual(self.call('POST', '/actions')[0], 501)

    def test_a_different_host_name_is_refused(self):
        self.assertEqual(self.call('GET', serve.START, {'Host': 'example.test:%d' % self.port})[0], 403)
        self.assertEqual(self.call('GET', serve.START, {'Host': 'localhost:%d' % self.port})[0], 200)

    def test_the_server_listens_on_the_loopback_address_only(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_the_queue_holds_the_connections_of_one_page(self):
        # The default queue of 5 connections drops modules of an example page.
        self.assertEqual(self.server.request_queue_size, 64)


def start(*args):
    return subprocess.Popen([sys.executable, '-B', str(ROOT / 'tools' / 'serve.py'), *args],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


class ServePortTest(unittest.TestCase):
    def test_a_busy_default_port_gives_a_free_port_and_a_working_url(self):
        held = hold(serve.DEFAULT_PORT)  # If another process holds the port, the condition of the test is true already.
        process = start()
        try:
            url = process.stdout.readline().strip()
            self.assertRegex(url, r'^http://127\.0\.0\.1:\d+/examples/')
            port = int(url.split(':')[2].split('/')[0])
            self.assertNotEqual(port, serve.DEFAULT_PORT)
            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
            connection.request('GET', url.split(str(port), 1)[1])
            self.assertEqual(connection.getresponse().status, 200)
            connection.close()
        finally:
            process.terminate()
            process.communicate()
            if held:
                held.close()

    def test_a_busy_chosen_port_gives_one_clear_line_and_a_non_zero_exit(self):
        held = hold(0)
        port = held.getsockname()[1]
        try:
            process = start('--port', str(port))
            out, err = process.communicate(timeout=20)
        finally:
            held.close()
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(out, '')
        lines = err.strip().splitlines()
        self.assertEqual(len(lines), 1, err)
        self.assertIn(str(port), lines[0])
        self.assertIn('--port', lines[0])


class QuickstartTextTest(unittest.TestCase):
    def test_the_default_port_is_the_port_of_the_quickstart_urls(self):
        self.assertEqual(serve.DEFAULT_PORT, 8000)
        self.assertIn('http://localhost:8000/examples/', (ROOT / 'README.md').read_text(encoding='utf-8'))

    def test_the_quickstart_and_the_guides_name_the_server_command(self):
        for name in DOCS:
            text = (ROOT / name).read_text(encoding='utf-8')
            with self.subTest(doc=name):
                self.assertIsNotNone(re.search(r'^```sh\n%s\n```$' % re.escape(COMMAND), text, re.M), 'no block with the command')
                self.assertNotIn('http.server', text)


if __name__ == '__main__':
    unittest.main()
