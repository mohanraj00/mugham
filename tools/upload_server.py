#!/usr/bin/env python3
"""A fixture API for examples/upload.html, with the Python standard library only.

POST /api/tickets/T-2041/files takes one file as the request body and gives its receipt.
GET /api/tickets/T-2041/files lists the name and the size of each file that the API keeps.
The API decides. It checks the type, the name, the size, the count and the first bytes of each file again,
because a page can send any request. It keeps each file in memory only and writes no file.
Other GET paths give the files of src/, catalog/ and examples/ only, as tools/thread_server.py does.
The server listens on 127.0.0.1 only. All data is synthetic.
"""
import argparse
import json
import re
import sys
import threading
from urllib.parse import unquote

from thread_server import Handler as FileHandler, Server

TICKET = 'T-2041'
FILES_PATH = '/api/tickets/%s/files' % TICKET
# The limits of the API. examples/upload.js binds the same limits for the control.
MAX_SIZE = 2000000
MAX_FILES = 3
# The API discards a body up to this size. It does not read a larger body.
MAX_DISCARD = 4 * MAX_SIZE
MEDIA_TYPE = 'application/pdf'
REQUEST_ID = re.compile(r'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
MAX_NAME = 255


def decide(files, request_id, name, media_type, data):
    """Decide one file. The kit does not decide. This API decides, and it gives a receipt for each request."""
    refusal = {'id': request_id, 'ok': False}
    if media_type != MEDIA_TYPE or not name.lower().endswith('.pdf') or len(name) <= len('.pdf'):
        return {**refusal, 'message': 'The API accepts only PDF files.'}
    if not data.startswith(b'%PDF-'):
        return {**refusal, 'message': 'The content of the file is not a PDF document.'}
    if len(files) >= MAX_FILES:
        return {**refusal, 'message': 'The ticket already has %d files.' % MAX_FILES}
    if any(item['name'] == name for item in files):
        return {**refusal, 'message': 'The ticket already has a file with this name.'}
    reference = 'F-%04d' % (len(files) + 1)
    files.append({'reference': reference, 'name': name, 'size': len(data), 'data': data})
    return {'id': request_id, 'ok': True, 'message': 'The file is on ticket %s.' % TICKET, 'reference': reference}


class Handler(FileHandler):
    server_version = 'mugham-upload-example'

    def json(self, status, body):
        self.send(status, json.dumps(body).encode(), 'application/json')

    def do_GET(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        path = self.path.split('?', 1)[0]
        if path == FILES_PATH:
            state = self.server.state
            with state['lock']:
                # The list has no content of a file.
                return self.json(200, {'files': [{key: item[key] for key in ('reference', 'name', 'size')} for item in state['files']]})
        # The file server of the thread example also streams /events. This server has no event stream.
        if path == '/events':
            return self.send(404, b'', 'text/plain')
        return super().do_GET()

    def do_POST(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        if self.path != FILES_PATH:
            return self.send(404, b'', 'text/plain')
        # Only a page of this server can send a file.
        origin = self.headers.get('Origin')
        if origin is not None and origin != 'http://%s' % self.headers.get('Host', ''):
            return self.send(403, b'', 'text/plain')
        request_id = self.headers.get('X-Request-Id', '')
        try:
            name = unquote(self.headers.get('X-File-Name', ''), errors='strict')
        except UnicodeDecodeError:
            name = ''
        if not REQUEST_ID.match(request_id) or not name or len(name) > MAX_NAME or '/' in name or '\\' in name or '\x00' in name:
            return self.send(400, b'', 'text/plain')
        try:
            size = int(self.headers.get('Content-Length', ''))
        except ValueError:
            return self.send(411, b'', 'text/plain')
        if size < 0:
            return self.send(400, b'', 'text/plain')
        # The API does not keep a body that is larger than its limit. It discards a body of a moderate size,
        # so that the page gets the receipt. It closes the connection for a larger body.
        if size > MAX_DISCARD:
            self.close_connection = True
            return self.send(413, b'', 'text/plain')
        if size > MAX_SIZE:
            left = size
            while left > 0:
                chunk = self.rfile.read(min(left, 65536))
                if not chunk:
                    break
                left -= len(chunk)
            return self.json(200, {'id': request_id, 'ok': False, 'message': 'The file is larger than the limit of 2 MB.'})
        data = self.rfile.read(size)
        media_type = self.headers.get('Content-Type', '').split(';')[0].strip().lower()
        state = self.server.state
        with state['lock']:
            body = decide(state['files'], request_id, name, media_type, data)
        self.json(200, body)


def make_server(port=0):
    server = Server(('127.0.0.1', port), Handler)
    # Each server keeps its files in this list only. The list is empty at the start, and it goes away with the server.
    server.state = {'lock': threading.Lock(), 'files': []}
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, default=8767, help='the port, or 0 for a free port')
    args = parser.parse_args(argv)
    server = make_server(args.port)
    print('http://127.0.0.1:%d/examples/upload.html' % server.server_address[1], flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
