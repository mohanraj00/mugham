"""Tests of tools/queue_server.py. Each expected result comes from issue #12: the fixture API does an action one
time for each key, gives the same receipt for a second request with that key, and rejects by its own rule."""
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import queue_server  # noqa: E402

JSON = {'Content-Type': 'application/json'}


class QueueServerTest(unittest.TestCase):
    def setUp(self):
        # Each test gets a new server, so each test starts with the same tools.
        self.server = queue_server.make_server(0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def call(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            return response.status, response.getheader('Content-Type', ''), response.read()
        finally:
            connection.close()

    def read(self, path):
        status, kind, data = self.call('GET', path)
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('application/json'))
        return json.loads(data)

    def reserve(self, tool_id, key, request_id='r-1', tool='tool.reserve'):
        body = json.dumps({'id': request_id, 'key': key, 'tool': tool, 'arguments': {'tool_id': tool_id}}).encode()
        status, _, data = self.call('POST', '/api/actions', body, JSON)
        return status, json.loads(data) if data else None

    def control(self, change):
        status, _, data = self.call('POST', '/api/control', json.dumps(change).encode(), JSON)
        return status, json.loads(data) if data else None

    def reserved(self):
        return [item['id'] for item in self.read('/api/tools')['tools'] if item['reserved']]

    def test_the_list_has_the_synthetic_tools(self):
        tools = self.read('/api/tools')['tools']
        self.assertEqual([item['id'] for item in tools], ['T-01', 'T-02', 'T-03', 'T-04'])
        self.assertEqual(self.reserved(), ['T-02'])

    def test_a_reserve_gives_a_receipt_with_the_id_and_the_key(self):
        status, receipt = self.reserve('T-01', 'k-1', 'r-7')
        self.assertEqual(status, 200)
        self.assertEqual(receipt, {'id': 'r-7', 'key': 'k-1', 'ok': True, 'message': 'The tool T-01 is reserved.', 'reference': 'B-0001'})
        self.assertEqual(self.reserved(), ['T-01', 'T-02'])

    def test_a_second_request_with_the_same_key_gets_the_first_receipt_and_does_nothing(self):
        _, first = self.reserve('T-01', 'k-1', 'r-1')
        status, second = self.reserve('T-01', 'k-1', 'r-2')
        self.assertEqual(status, 200)
        self.assertEqual(second, {**first, 'id': 'r-2'})
        log = self.read('/api/log')
        self.assertEqual(log['applied'], ['k-1'])
        self.assertEqual([item['id'] for item in log['requests']], ['r-1', 'r-2'])
        # A new key for the same tool is a new action. The API rejects it, because the tool is reserved now.
        _, third = self.reserve('T-01', 'k-2', 'r-3')
        self.assertEqual(third, {'id': 'r-3', 'key': 'k-2', 'ok': False, 'message': 'The tool T-01 is already reserved.'})

    def test_the_api_rejects_a_reserved_tool_an_unknown_tool_and_an_unknown_tool_name(self):
        self.assertEqual(self.reserve('T-02', 'k-1')[1]['message'], 'The tool T-02 is already reserved.')
        self.assertEqual(self.reserve('T-99', 'k-2')[1]['message'], 'The API does not know this tool.')
        self.assertEqual(self.reserve('T-01', 'k-3', tool='tool.remove')[1]['message'], 'The API does not know this tool name.')
        self.assertEqual(self.read('/api/log')['applied'], [])
        self.assertEqual(self.reserved(), ['T-02'])

    def test_a_lost_receipt_does_the_action_and_a_retry_gets_the_receipt(self):
        self.assertEqual(self.control({'lose_receipts': 1}), (200, {'service': 'up', 'lose_receipts': 1}))
        with self.assertRaises((http.client.HTTPException, OSError)):
            self.reserve('T-04', 'k-1', 'r-1')
        self.assertEqual(self.reserved(), ['T-02', 'T-04'])
        status, receipt = self.reserve('T-04', 'k-1', 'r-2')
        self.assertEqual((status, receipt['ok'], receipt['id'], receipt['reference']), (200, True, 'r-2', 'B-0001'))
        self.assertEqual(self.read('/api/log')['applied'], ['k-1'])

    def test_a_service_that_is_down_gives_no_answer_and_does_nothing(self):
        self.assertEqual(self.control({'service': 'down'}), (200, {'service': 'down', 'lose_receipts': 0}))
        for call in (lambda: self.reserve('T-01', 'k-1'), lambda: self.call('GET', '/api/tools'),
                     lambda: self.call('GET', '/examples/cards/queue.html')):
            with self.assertRaises((http.client.HTTPException, OSError)):
                call()
        self.assertEqual(self.control({'service': 'up'}), (200, {'service': 'up', 'lose_receipts': 0}))
        self.assertEqual(self.read('/api/log'), {'requests': [], 'applied': []})

    def test_a_bad_request_is_refused_with_no_receipt(self):
        self.assertEqual(self.call('POST', '/api/actions', b'{', JSON)[0], 400)
        self.assertEqual(self.call('POST', '/api/actions', b'{"id": "r-1", "arguments": {}}', JSON)[0], 400)
        self.assertEqual(self.call('POST', '/api/actions', b'{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.call('POST', '/api/actions', b'x' * 5000, JSON)[0], 413)
        for change in ({}, {'service': 'off'}, {'lose_receipts': 11}, {'lose_receipts': True}, {'other': 1}, []):
            self.assertEqual(self.control(change)[0], 400, change)

    def test_a_page_of_a_different_origin_or_host_cannot_use_the_api(self):
        body = json.dumps({'id': 'r-1', 'key': 'k-1', 'tool': 'tool.reserve', 'arguments': {'tool_id': 'T-01'}}).encode()
        headers = {**JSON, 'Origin': 'http://example.test'}
        self.assertEqual(self.call('POST', '/api/actions', body, headers)[0], 403)
        self.assertEqual(self.call('POST', '/api/control', b'{"service": "down"}', headers)[0], 403)
        self.assertEqual(self.call('GET', '/api/tools', headers={'Host': 'example.test'})[0], 403)
        self.assertEqual(self.reserved(), ['T-02'])

    def test_the_server_gives_the_example_files_only(self):
        status, kind, _ = self.call('GET', '/examples/cards/queue.html')
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('text/html'))
        self.assertEqual(self.call('GET', '/src/offline/worker.js')[0], 200)
        self.assertEqual(self.call('GET', '/events')[0], 404)
        self.assertEqual(self.call('GET', '/tools/queue_server.py')[0], 404)


if __name__ == '__main__':
    unittest.main()
