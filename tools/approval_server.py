#!/usr/bin/env python3
"""A fixture API for examples/approval.html, with the Python standard library only.

GET /api/decisions gives the open decisions. GET /api/decisions/<id> gives one decision.
POST /api/actions decides one approve or reject request and gives its receipt.
A second action on a decision gets a refusal. The fixture API owns the state, not the page.
Other GET paths give the files of src/, catalog/ and examples/ only, as tools/thread_server.py does.
The server listens on 127.0.0.1 only. All data is synthetic.
"""
import argparse
import copy
import json
import re
import sys
import threading

from thread_server import MAX_BODY, Handler as FileHandler, Server

# Each tool and the status that it gives to a decision.
TOOLS = {'approval.approve': 'approved', 'approval.reject': 'rejected'}
AUTHOR = {'type': 'agent', 'id': 'agent-intake', 'name': 'Intake agent'}
DECISION_PATH = re.compile(r'^/api/decisions/(D-\d{4})$')
DECISIONS = [
    {'id': 'D-0001', 'title': 'Raise the print budget of the east reading room', 'status': 'open', 'author': AUTHOR,
     'summary': 'The reading room asks for more print credits for the last month of the term.', 'due': '2026-12-01',
     'evidence': [{'label': 'Amount', 'value': '240 credits'}, {'label': 'Limit', 'value': '300 credits'},
                  {'label': 'Use last term', 'value': '212 credits'}, {'label': 'Source', 'value': 'Synthetic budget sheet, row 12'}]},
    {'id': 'D-0002', 'title': 'Open the north branch for two more hours on Saturday', 'status': 'open', 'author': AUTHOR,
     'summary': 'The branch asks to close at 18:00 and not at 16:00.', 'due': '2026-12-04',
     'evidence': [{'label': 'Visits last Saturday', 'value': '412'}, {'label': 'Staff on shift', 'value': '3 of 3'},
                  {'label': 'Source', 'value': 'Synthetic staffing rule 2'}]},
]


def decide(decisions, request, number):
    """Decide one request. The kit does not decide. This API decides, and it refuses a second action."""
    if not isinstance(request, dict) or not isinstance(request.get('id'), str) or not isinstance(request.get('arguments'), dict):
        return 400, {'error': 'The request must have an id and arguments.'}
    refusal = {'id': request['id'], 'ok': False}
    status = TOOLS.get(request.get('tool'))
    if status is None:
        return 200, {**refusal, 'message': 'The API does not know this tool.'}
    decision = decisions.get(request['arguments'].get('decision_id'))
    if decision is None:
        return 200, {**refusal, 'message': 'The API does not know this decision.'}
    if decision['status'] != 'open':
        return 200, {**refusal, 'message': 'The decision %s is already %s.' % (decision['id'], decision['status'])}
    decision['status'] = status
    return 200, {'id': request['id'], 'ok': True, 'message': 'The decision %s is %s.' % (decision['id'], status),
                 'reference': 'A-%04d' % number}


class Handler(FileHandler):
    server_version = 'mugham-approval-example'

    def json(self, status, body):
        self.send(status, json.dumps(body).encode(), 'application/json')

    def do_GET(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        path = self.path.split('?', 1)[0]
        state = self.server.state
        if path == '/api/decisions':
            with state['lock']:
                return self.json(200, {'decisions': [item for item in state['decisions'].values() if item['status'] == 'open']})
        match = DECISION_PATH.match(path)
        if match:
            with state['lock']:
                decision = state['decisions'].get(match.group(1))
                return self.json(200, decision) if decision else self.send(404, b'', 'text/plain')
        # The file server of the thread example also streams /events. This server has no event stream.
        if path == '/events':
            return self.send(404, b'', 'text/plain')
        return super().do_GET()

    def do_POST(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        if self.path != '/api/actions':
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
            status, body = decide(state['decisions'], request, state['receipts'] + 1)
            if body.get('ok'):
                state['receipts'] += 1
        self.json(status, body)


def make_server(port=0):
    server = Server(('127.0.0.1', port), Handler)
    # Each server has its own copy of the synthetic decisions, so each run starts with the same open decisions.
    server.state = {'lock': threading.Lock(), 'receipts': 0,
                    'decisions': {item['id']: item for item in copy.deepcopy(DECISIONS)}}
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, default=8766, help='the port, or 0 for a free port')
    args = parser.parse_args(argv)
    server = make_server(args.port)
    print('http://127.0.0.1:%d/examples/approval.html' % server.server_address[1], flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
