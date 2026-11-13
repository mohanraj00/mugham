"""Tests of tools/approval_server.py. Each expected result comes from issue #8: the fixture API owns the
state of each decision, gives a receipt for each action and refuses a duplicate action."""
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import approval_server  # noqa: E402


class ApprovalServerTest(unittest.TestCase):
    def setUp(self):
        # Each test gets a new server, so each test starts with the same open decisions.
        self.server = approval_server.make_server(0)
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
        return response.status, response.getheader('Content-Type', ''), data

    def decisions(self):
        status, kind, data = self.call('GET', '/api/decisions')
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('application/json'))
        return json.loads(data)['decisions']

    def act(self, tool, decision_id, request_id='r-1'):
        body = json.dumps({'id': request_id, 'tool': tool, 'arguments': {'decision_id': decision_id}}).encode()
        status, _, data = self.call('POST', '/api/actions', body, {'Content-Type': 'application/json'})
        return status, json.loads(data) if data else None

    def test_the_list_has_the_open_synthetic_decisions_with_evidence(self):
        decisions = self.decisions()
        self.assertEqual([item['id'] for item in decisions], ['D-0001', 'D-0002'])
        for item in decisions:
            self.assertEqual(item['status'], 'open')
            self.assertTrue(1 <= len(item['evidence']) <= 4)
            self.assertEqual(item['author']['type'], 'agent')

    def test_an_approve_gives_a_receipt_and_the_api_keeps_the_new_state(self):
        status, receipt = self.act('approval.approve', 'D-0001', 'r-7')
        self.assertEqual(status, 200)
        self.assertEqual(receipt['id'], 'r-7')
        self.assertIs(receipt['ok'], True)
        self.assertRegex(receipt['reference'], r'^A-\d{4}$')
        status, _, data = self.call('GET', '/api/decisions/D-0001')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)['status'], 'approved')
        # The list has only the open decisions.
        self.assertEqual([item['id'] for item in self.decisions()], ['D-0002'])

    def test_a_duplicate_action_is_refused_and_does_not_change_the_state(self):
        self.act('approval.reject', 'D-0002')
        status, receipt = self.act('approval.approve', 'D-0002', 'r-2')
        self.assertEqual(status, 200)
        self.assertEqual(receipt['id'], 'r-2')
        self.assertIs(receipt['ok'], False)
        self.assertIn('already rejected', receipt['message'])
        self.assertNotIn('reference', receipt)
        _, _, data = self.call('GET', '/api/decisions/D-0002')
        self.assertEqual(json.loads(data)['status'], 'rejected')

    def test_an_unknown_tool_or_decision_is_refused(self):
        self.assertIs(self.act('approval.delete', 'D-0001')[1]['ok'], False)
        self.assertIs(self.act('approval.approve', 'D-9999')[1]['ok'], False)
        self.assertEqual(self.call('GET', '/api/decisions/D-9999')[0], 404)

    def test_a_bad_request_is_refused_with_no_receipt(self):
        headers = {'Content-Type': 'application/json'}
        self.assertEqual(self.call('POST', '/api/actions', b'{', headers)[0], 400)
        self.assertEqual(self.call('POST', '/api/actions', b'{"id": "r-1"}', headers)[0], 400)
        self.assertEqual(self.call('POST', '/api/actions', b'{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.call('POST', '/api/actions', b'x' * 5000, headers)[0], 413)

    def test_a_page_of_a_different_origin_or_host_cannot_use_the_api(self):
        body = json.dumps({'id': 'r-1', 'tool': 'approval.approve', 'arguments': {'decision_id': 'D-0001'}}).encode()
        headers = {'Content-Type': 'application/json', 'Origin': 'http://example.test'}
        self.assertEqual(self.call('POST', '/api/actions', body, headers)[0], 403)
        self.assertEqual(self.call('GET', '/api/decisions', headers={'Host': 'example.test'})[0], 403)
        self.assertEqual(self.decisions()[0]['status'], 'open')

    def test_the_server_gives_the_example_files_only(self):
        status, kind, _ = self.call('GET', '/examples/approval.html')
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('text/html'))
        self.assertEqual(self.call('GET', '/events')[0], 404)
        self.assertEqual(self.call('GET', '/tools/approval_server.py')[0], 404)
        self.assertEqual(self.call('GET', '/../CONSTITUTION.md')[0], 404)


if __name__ == '__main__':
    unittest.main()
