#!/usr/bin/env python3
"""A fixture API for examples/cards/queue.html, with the Python standard library only.

GET /api/tools gives the tools of a synthetic tool library. POST /api/actions decides one reserve request and
gives its receipt. The API does an action one time for each key: a second request with a known key gets the
receipt of the first request again, with the id of the new request.
GET /api/log gives each request that the API got and each key that it did, for the checks.
POST /api/control changes the fixture: {"service": "down"} closes each connection with no answer until
{"service": "up"}, and {"lose_receipts": 1} does the next action but closes the connection before the receipt.
Other GET paths give the files of src/, catalog/ and examples/ only, as tools/thread_server.py does.
The server listens on 127.0.0.1 only. All data is synthetic.
"""
import argparse
import copy
import json
import sys
import threading

from thread_server import MAX_BODY, Handler as FileHandler, Server

TOOL = 'tool.reserve'
# The drill is reserved at the start, so a reserve request for it gets a rejection.
TOOLS = [
    {'id': 'T-01', 'name': 'Ladder', 'shelf': 'A', 'reserved': False},
    {'id': 'T-02', 'name': 'Drill', 'shelf': 'B', 'reserved': True},
    {'id': 'T-03', 'name': 'Garden fork', 'shelf': 'A', 'reserved': False},
    {'id': 'T-04', 'name': 'Hand saw', 'shelf': 'C', 'reserved': False},
]


def text(value, limit=128):
    return isinstance(value, str) and 0 < len(value) <= limit


def decide(state, request):
    """Decide one request. The kit does not decide. This API decides, one time for each key."""
    if not isinstance(request, dict) or not text(request.get('id')) or not text(request.get('key')) \
            or not isinstance(request.get('arguments'), dict):
        return 400, {'error': 'The request must have an id, a key and arguments.'}
    tool_id = request['arguments'].get('tool_id')
    state['requests'].append({'id': request['id'], 'key': request['key'], 'tool_id': tool_id if text(tool_id) else None})
    known = state['receipts'].get(request['key'])
    if known is not None:
        return 200, {**known, 'id': request['id']}
    receipt = {'key': request['key'], 'ok': False}
    tool = state['tools'].get(tool_id) if text(tool_id) else None
    if request.get('tool') != TOOL:
        receipt['message'] = 'The API does not know this tool name.'
    elif tool is None:
        receipt['message'] = 'The API does not know this tool.'
    elif tool['reserved']:
        receipt['message'] = 'The tool %s is already reserved.' % tool['id']
    else:
        tool['reserved'] = True
        state['applied'].append(request['key'])
        receipt.update(ok=True, message='The tool %s is reserved.' % tool['id'], reference='B-%04d' % len(state['applied']))
    state['receipts'][request['key']] = receipt
    return 200, {**receipt, 'id': request['id']}


def control(state, change):
    """Change the fixture. Returns the new settings, or None if the change is not valid."""
    if not isinstance(change, dict) or not change or set(change) - {'service', 'lose_receipts'}:
        return None
    if 'service' in change and change['service'] not in ('up', 'down'):
        return None
    lose = change.get('lose_receipts', 0)
    if isinstance(lose, bool) or not isinstance(lose, int) or not 0 <= lose <= 10:
        return None
    if 'service' in change:
        state['down'] = change['service'] == 'down'
    if 'lose_receipts' in change:
        state['lose'] = lose
    return {'service': 'down' if state['down'] else 'up', 'lose_receipts': state['lose']}


class Handler(FileHandler):
    server_version = 'mugham-queue-example'

    def json(self, status, body):
        self.send(status, json.dumps(body).encode(), 'application/json')

    def drop(self):
        """Close the connection with no answer, as a network that fails does."""
        self.close_connection = True

    def do_GET(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        path = self.path.split('?', 1)[0]
        state = self.server.state
        with state['lock']:
            if state['down']:
                return self.drop()
            if path == '/api/tools':
                return self.json(200, {'tools': list(state['tools'].values())})
            if path == '/api/log':
                return self.json(200, {'requests': state['requests'], 'applied': state['applied']})
        # The file server of the thread example also streams /events. This server has no event stream.
        if path == '/events':
            return self.send(404, b'', 'text/plain')
        return super().do_GET()

    def do_POST(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        if self.path not in ('/api/actions', '/api/control'):
            return self.send(404, b'', 'text/plain')
        # Only a page of this server can send a request.
        origin = self.headers.get('Origin')
        if origin is not None and origin != 'http://%s' % self.headers.get('Host', ''):
            return self.send(403, b'', 'text/plain')
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.send(415, b'', 'text/plain')
        try:
            size = int(self.headers.get('Content-Length', ''))
        except ValueError:
            return self.send(411, b'', 'text/plain')
        if size < 0 or size > MAX_BODY:
            return self.send(413, b'', 'text/plain')
        try:
            request = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError):
            return self.send(400, b'', 'text/plain')
        state = self.server.state
        with state['lock']:
            if self.path == '/api/control':
                settings = control(state, request)
                return self.json(200, settings) if settings else self.send(400, b'', 'text/plain')
            if state['down']:
                return self.drop()
            status, body = decide(state, request)
            # The API did the action, but the receipt does not come back.
            if status == 200 and state['lose'] > 0:
                state['lose'] -= 1
                return self.drop()
        self.json(status, body)


def make_server(port=0):
    server = Server(('127.0.0.1', port), Handler)
    # Each server has its own copy of the synthetic tools, so each run starts with the same state.
    server.state = {'lock': threading.Lock(), 'tools': {item['id']: item for item in copy.deepcopy(TOOLS)},
                    'receipts': {}, 'requests': [], 'applied': [], 'down': False, 'lose': 0}
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, default=8769, help='the port, or 0 for a free port')
    args = parser.parse_args(argv)
    server = make_server(args.port)
    print('http://127.0.0.1:%d/examples/cards/queue.html' % server.server_address[1], flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
