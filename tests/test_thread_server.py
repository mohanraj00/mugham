"""Tests of tools/thread_server.py and examples/thread-events.json. Each expected result comes from
src/thread/README.md and from issue #5: two people, two agents, a refused component and one action."""
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
import thread_server  # noqa: E402


class ThreadServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = thread_server.make_server(0, 0.0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def call(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, response.getheader('Content-Type', ''), data

    def post(self, request, headers=None):
        body = json.dumps(request).encode()
        return self.call('POST', '/actions', body, {'Content-Type': 'application/json', **(headers or {})})

    def test_the_events_are_the_script_in_order_and_then_an_end_event(self):
        status, kind, data = self.call('GET', '/events')
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('text/event-stream'))
        blocks = data.decode().strip().split('\n\n')
        script = json.loads((ROOT / 'examples/thread-events.json').read_text(encoding='utf-8'))
        self.assertEqual([json.loads(block[len('data: '):]) for block in blocks[:-1]], [step['event'] for step in script])
        self.assertEqual(blocks[-1], 'event: end\ndata: {}')

    def test_the_script_has_two_people_two_agents_a_refused_component_and_one_action(self):
        script = [step['event'] for step in json.loads((ROOT / 'examples/thread-events.json').read_text(encoding='utf-8'))]
        actors = {(event['metadata']['mugham']['actor']['type'], event['metadata']['mugham']['actor']['id'])
                  for event in script if 'metadata' in event}
        self.assertEqual(sorted(kind for kind, _ in actors), ['agent', 'agent', 'human', 'human'])
        fills = [event['content']['fill']['component'] for event in script if event['type'] == 'ACTIVITY_SNAPSHOT']
        catalog = {path.stem for path in (ROOT / 'catalog').glob('*.json')}
        self.assertEqual([name for name in fills if name not in catalog], ['banner'])
        self.assertEqual(fills.count('action-button'), 1)
        self.assertGreaterEqual(fills.count('card'), 2, 'the agent streams the card in more than one snapshot')

    def test_a_known_request_gets_a_receipt_with_a_reference(self):
        status, kind, data = self.post({'id': 'q-1', 'tool': 'library.renew', 'arguments': {'loan_id': 'L-0001'}})
        self.assertEqual(status, 200)
        self.assertTrue(kind.startswith('application/json'))
        receipt = json.loads(data)
        self.assertEqual((receipt['id'], receipt['ok']), ('q-1', True))
        self.assertRegex(receipt['reference'], r'^R-\d{4}$')

    def test_the_api_refuses_an_unknown_tool_or_loan(self):
        for request in [{'id': 'q-2', 'tool': 'library.delete', 'arguments': {'loan_id': 'L-0001'}},
                        {'id': 'q-3', 'tool': 'library.renew', 'arguments': {'loan_id': 'L-9999'}}]:
            status, _, data = self.post(request)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(data)['ok'], False)
        self.assertEqual(self.post({'tool': 'library.renew'})[0], 400)

    def test_the_api_refuses_a_bad_request(self):
        self.assertEqual(self.post({'id': 'q'}, {'Origin': 'http://example.test'})[0], 403)
        self.assertEqual(self.call('POST', '/actions', b'{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.call('POST', '/actions', b'x' * 5000, {'Content-Type': 'application/json'})[0], 413)
        self.assertEqual(self.call('POST', '/actions', b'{', {'Content-Type': 'application/json'})[0], 400)
        self.assertEqual(self.call('POST', '/other', b'{}', {'Content-Type': 'application/json'})[0], 404)

    def test_a_different_host_name_is_refused(self):
        self.assertEqual(self.call('GET', '/examples/thread.html', headers={'Host': 'example.test:%d' % self.port})[0], 403)
        self.assertEqual(self.post({'id': 'q'}, {'Host': 'example.test'})[0], 403)

    def test_only_the_served_folders_are_served(self):
        self.assertEqual(self.call('GET', '/examples/thread.html')[0], 200)
        self.assertEqual(self.call('GET', '/src/thread/index.js')[0], 200)
        for path in ['/tools/thread_server.py', '/src/../tools/build.py', '/README.md', '/.git/config', '/src', '/examples/missing.js']:
            self.assertEqual(self.call('GET', path)[0], 404, path)


def hold(port):
    """Hold a port open on 127.0.0.1. Give None if another process already holds it."""
    sock = socket.socket()
    try:
        sock.bind(('127.0.0.1', port))
    except OSError:
        sock.close()
        return None
    sock.listen()
    return sock


def start(*args):
    return subprocess.Popen([sys.executable, '-B', str(ROOT / 'tools' / 'thread_server.py'), '--no-delay', *args],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


class ThreadServerPortTest(unittest.TestCase):
    def test_a_busy_default_port_gives_a_free_port_and_a_working_url(self):
        held = hold(8765)  # If another process holds 8765, the condition of the test is true already.
        process = start()
        try:
            url = process.stdout.readline().strip()
            self.assertRegex(url, r'^http://127\.0\.0\.1:\d+/examples/thread\.html$')
            port = int(url.split(':')[2].split('/')[0])
            self.assertNotEqual(port, 8765)
            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
            connection.request('GET', '/examples/thread.html')
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
        self.assertNotIn('Traceback', err)


if __name__ == '__main__':
    unittest.main()
