#!/usr/bin/env python3
"""A local file server for the examples, with the Python standard library only.

GET gives the files of src/, catalog/ and examples/ only. The server has no API.
The server listens on 127.0.0.1 only.

Do not use `python3 -m http.server` for the examples. Its queue holds 5 connections, and a browser
opens a new connection for each module of a page. The queue becomes full and some modules do not load.
"""
import argparse
import sys

from thread_server import FileHandler, Server

DEFAULT_PORT = 8000
# The first example of the README quickstart.
START = '/examples/primitives.html'


def make_server(port=0):
    return Server(('127.0.0.1', port), FileHandler)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, help='the port, or 0 for a free port. The default is %d, or a free port if it is busy' % DEFAULT_PORT)
    args = parser.parse_args(argv)
    try:
        server = make_server(DEFAULT_PORT if args.port is None else args.port)
    except OSError as error:
        if args.port is not None:
            print('The server cannot use port %d: %s. Choose a different port with the --port option.' % (args.port, error.strerror or error), file=sys.stderr)
            return 1
        server = make_server(0)
    print('http://127.0.0.1:%d%s' % (server.server_address[1], START), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
