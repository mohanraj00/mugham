#!/usr/bin/env python3
"""A local server for examples/thread.html, with the Python standard library only.

GET /events streams the synthetic events of examples/thread-events.json as server-sent events.
POST /actions is a synthetic API: it decides each request and gives its receipt.
Other GET paths give the files of src/, catalog/ and examples/ only.
The server listens on 127.0.0.1 only. All data is synthetic.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
SERVED = ('src', 'catalog', 'examples')
TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml'}
EVENTS = ROOT / 'examples' / 'thread-events.json'
MAX_BODY = 4096
# The synthetic API knows one tool and one loan.
TOOL = 'library.renew'
LOAN = 'L-0001'


def receipt(request, number):
    """Decide one request of the synthetic API. The kit does not decide. This API decides."""
    if not isinstance(request, dict) or not isinstance(request.get('id'), str) or not isinstance(request.get('arguments'), dict):
        return 400, {'error': 'The request must have an id and arguments.'}
    if request.get('tool') != TOOL:
        return 200, {'id': request['id'], 'ok': False, 'message': 'The API does not know this tool.'}
    if request['arguments'].get('loan_id') != LOAN:
        return 200, {'id': request['id'], 'ok': False, 'message': 'The API does not know this loan.'}
    return 200, {'id': request['id'], 'ok': True, 'message': 'The loan is renewed to 2026-12-08.', 'reference': 'R-%04d' % number}


class Handler(BaseHTTPRequestHandler):
    server_version = 'mugham-thread-example'
    delay = 1.0
    counter = 0
    lock = threading.Lock()

    def log_message(self, format, *args):
        pass

    def send(self, status, body, content_type):
        self.send_response(status)
        self.send_header('Content-Type', content_type + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def host_ok(self):
        # A page of a different host name cannot read this server, also after a DNS change of its name.
        port = self.server.server_address[1]
        return self.headers.get('Host') in ('127.0.0.1:%d' % port, 'localhost:%d' % port)

    def do_GET(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        path = self.path.split('?', 1)[0]
        if path == '/events':
            return self.events()
        if path == '/favicon.ico':
            return self.send(204, b'', 'text/plain')
        file = (ROOT / ('.' + path)).resolve()
        allowed = any(file.is_relative_to(ROOT / folder) and file != ROOT / folder for folder in SERVED)
        if not allowed or file.suffix not in TYPES or not file.is_file():
            return self.send(404, b'', 'text/plain')
        self.send(200, file.read_bytes(), TYPES[file.suffix])

    def events(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            for step in json.loads(EVENTS.read_text(encoding='utf-8')):
                time.sleep(step['delay_ms'] / 1000 * self.delay)
                self.wfile.write(b'data: ' + json.dumps(step['event']).encode() + b'\n\n')
                self.wfile.flush()
            # The end event tells the page to close the source, so the browser does not connect again.
            self.wfile.write(b'event: end\ndata: {}\n\n')
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        if self.path != '/actions':
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
        with self.lock:
            Handler.counter += 1
            number = Handler.counter
        status, body = receipt(request, number)
        self.send(status, json.dumps(body).encode(), 'application/json')


class Server(ThreadingHTTPServer):
    # A browser opens many connections at one time for the modules of a page. The default queue of 5 drops some.
    request_queue_size = 64
    daemon_threads = True


def make_server(port=0, delay=1.0):
    handler = type('ThreadHandler', (Handler,), {'delay': delay})
    return Server(('127.0.0.1', port), handler)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, default=8765, help='the port, or 0 for a free port')
    parser.add_argument('--no-delay', action='store_true', help='send the events with no delay, for the checks')
    args = parser.parse_args(argv)
    server = make_server(args.port, 0.0 if args.no_delay else 1.0)
    print('http://127.0.0.1:%d/examples/thread.html' % server.server_address[1], flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
