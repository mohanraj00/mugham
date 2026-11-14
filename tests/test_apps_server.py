"""Tests of tools/apps_server.py. Each expected result comes from issue #67: the fixture API owns the state of each
app, gives a receipt for each action, refuses a bad or a second action, and serves only the files of the kit."""
import http.client
import json
from pathlib import Path
import socket
import subprocess
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import apps_server  # noqa: E402


class AppsServerTest(unittest.TestCase):
    def setUp(self):
        # Each test gets a new server, so each test starts with the same synthetic state.
        self.server = apps_server.make_server(0)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.number = 0

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

    def get(self, path):
        status, data = self.call('GET', path)
        self.assertEqual(status, 200, path)
        return json.loads(data)

    def act(self, tool, **arguments):
        self.number += 1
        status, data = self.call('POST', '/api/actions', json.dumps({'id': 'q-%d' % self.number, 'tool': tool, 'arguments': arguments}),
                                 {'Content-Type': 'application/json'})
        self.assertEqual(status, 200)
        receipt = json.loads(data)
        self.assertEqual(receipt['id'], 'q-%d' % self.number)
        return receipt

    def actors(self, events):
        return [event['metadata']['mugham']['actor']['type'] for event in events if 'metadata' in event]

    def test_each_app_page_and_its_folder_url_are_served(self):
        for app in apps_server.APPS:
            self.assertEqual(self.call('GET', '/examples/apps/%s/' % app)[0], 200, app)
            self.assertEqual(self.call('GET', '/examples/apps/%s/index.html' % app)[0], 200, app)
        self.assertEqual(self.call('GET', '/examples/apps/')[0], 200)

    def test_only_the_served_folders_and_known_api_paths_are_served(self):
        for path in ['/tools/apps_server.py', '/README.md', '/examples/apps/../../tools/apps_server.py', '/events',
                     '/api/support/tickets/T-9999/events', '/api/changes/CR-999/events', '/api/inspection/I-0001/events', '/api/other']:
            self.assertEqual(self.call('GET', path)[0], 404, path)
        self.assertEqual(self.call('GET', '/examples/apps/', headers={'Host': 'example.org'})[0], 403)

    def test_a_reply_has_a_receipt_and_the_ticket_is_answered_one_time(self):
        tickets = self.get('/api/support/tickets')['tickets']
        self.assertEqual([item['id'] for item in tickets], ['T-2041', 'T-2042', 'T-2043', 'T-2044'])
        self.assertTrue(all(item['status'] == 'open' for item in tickets))
        events = self.get('/api/support/tickets/T-2041/events')['events']
        self.assertEqual(set(self.actors(events)), {'human', 'agent'})
        receipt = self.act('desk.send_reply', ticket_id='T-2041', reply='Hello Ines, we refunded 3.40 to your card.')
        self.assertTrue(receipt['ok'])
        self.assertRegex(receipt['reference'], r'^MSG-\d{4}$')
        self.assertIn('edits of a person', receipt['message'])
        self.assertEqual(self.get('/api/support/tickets')['tickets'][0]['status'], 'answered')
        after = self.get('/api/support/tickets/T-2041/events')['events']
        self.assertEqual(after[:len(events)], events)
        self.assertIn('system', self.actors(after[len(events):]))
        second = self.act('desk.send_reply', ticket_id='T-2041', reply='Again')
        self.assertFalse(second['ok'])
        self.assertIn('already answered', second['message'])
        self.assertFalse(self.act('desk.send_reply', ticket_id='T-2042', reply='  ')['ok'])

    def test_a_change_decision_has_a_receipt_and_goes_in_the_log(self):
        self.assertEqual(self.get('/api/changes/log')['log'], [])
        events = self.get('/api/changes/CR-311/events')['events']
        excerpts = [event['content']['fill'] for event in events if event.get('content', {}).get('fill', {}).get('component') == 'excerpt']
        self.assertEqual(len(excerpts), 2)
        for excerpt in excerpts:
            self.assertLess(excerpt['data']['span_start'], excerpt['data']['span_end'])
            self.assertLessEqual(excerpt['data']['span_end'], len(excerpt['data']['passage']))
            self.assertTrue(excerpt['slots']['citation']['locator'].startswith('https://example.org/'))
        receipt = self.act('change.approve', change_id='CR-311')
        self.assertTrue(receipt['ok'])
        self.assertRegex(receipt['reference'], r'^CHG-\d{4}$')
        self.assertEqual(self.get('/api/changes/log')['log'], [{'change': 'CR-311', 'title': 'Run route 12 every 15 minutes on Saturday',
                                                                'status': 'approved', 'reference': receipt['reference']}])
        refused = self.act('change.reject', change_id='CR-311')
        self.assertFalse(refused['ok'])
        self.assertIn('already approved', refused['message'])
        self.assertTrue(self.act('change.reject', change_id='CR-312')['ok'])
        self.assertFalse(self.act('change.approve', change_id='CR-999')['ok'])

    def test_the_inspection_needs_valid_findings_before_it_closes(self):
        path = '/api/inspection/I-0417/events'
        events = self.get(path)['events']
        self.assertFalse(self.act('inspection.close', inspection_id='I-0417')['ok'])
        bad = self.act('inspection.save_findings', inspection_id='I-0417', pressure='4.2', seal='fine', note='')
        self.assertFalse(bad['ok'])
        self.assertIn('ok, worn or leak', bad['message'])
        self.assertFalse(self.act('inspection.save_findings', inspection_id='I-0417', pressure='high', seal='ok', note='')['ok'])
        self.assertEqual(self.get(path)['events'], events)
        saved = self.act('inspection.save_findings', inspection_id='I-0417', pressure='4.2', seal='Worn', note='Seal is dry.')
        self.assertTrue(saved['ok'])
        after = self.get(path)['events']
        self.assertEqual(after[:len(events)], events)
        # The new events replace the checklist and add the close button, at the end of the list.
        fills = [event['content']['fill'] for event in after[len(events):] if 'content' in event]
        items = {item['data']['label']: item['data']['result'] for item in fills[0]['data']['items']}
        self.assertEqual((items['Outlet pressure'], items['Valve V3 seal']), ('pass', 'attention'))
        self.assertEqual(fills[1]['component'], 'action-button')
        closed = self.act('inspection.close', inspection_id='I-0417')
        self.assertTrue(closed['ok'])
        self.assertRegex(closed['reference'], r'^INS-\d{4}$')
        self.assertFalse(self.act('inspection.close', inspection_id='I-0417')['ok'])
        self.assertFalse(self.act('inspection.save_findings', inspection_id='I-0417', pressure='4', seal='ok', note='')['ok'])

    def test_a_bad_request_gets_no_receipt(self):
        headers = {'Content-Type': 'application/json'}
        self.assertEqual(self.call('POST', '/api/actions', '{"tool": "x"}', headers)[0], 400)
        self.assertEqual(self.call('POST', '/api/actions', 'x' * 5000, headers)[0], 413)
        self.assertEqual(self.call('POST', '/api/actions', '{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.call('POST', '/api/actions', '{}', {**headers, 'Origin': 'http://example.org'})[0], 403)
        self.assertFalse(self.act('other.tool')['ok'])


class AppsServerPortTest(unittest.TestCase):
    def test_a_busy_chosen_port_gives_one_clear_line_and_a_non_zero_exit(self):
        held = socket.socket()
        held.bind(('127.0.0.1', 0))
        held.listen()
        port = held.getsockname()[1]
        try:
            process = subprocess.run([sys.executable, '-B', str(ROOT / 'tools' / 'apps_server.py'), '--port', str(port)],
                                     capture_output=True, text=True, timeout=20)
        finally:
            held.close()
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(process.stdout, '')
        self.assertEqual(len(process.stderr.strip().splitlines()), 1, process.stderr)
        self.assertIn('--port', process.stderr)


if __name__ == '__main__':
    unittest.main()
