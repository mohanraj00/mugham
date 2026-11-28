#!/usr/bin/env python3
"""A second validator for conformance/run.py: the Python validator of tools/catalog.py.

It reads one request on each input line and writes one answer line, as conformance/README.md says. It has no
envelope reader, so it answers only the kinds fill, contract, short and resolve. tests/test_conformance.py runs it.
With --reword, it changes the words after the path of each error. With --empty, it gives no error.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402


def resolved(item, checked):
    contract, errors = catalog.resolve(item['contract'])
    if errors:
        return {'resolved': None, 'errors': errors}
    return {'resolved': contract, 'errors': catalog.contract_errors(contract, None, item['catalog']) if checked else []}


ANSWERS = {
    'fill': lambda item: {'errors': catalog.fill_errors(item['fill'], item['catalog'])},
    'contract': lambda item: {'errors': catalog.contract_errors(item['contract'], None, item['catalog'])},
    'short': lambda item: resolved(item, True),
    'resolve': lambda item: resolved(item, False),
}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        item = json.loads(line)
        answer = ANSWERS[item['kind']](item)
        if '--reword' in sys.argv[1:]:
            answer['errors'] = [error.split(': ', 1)[0] + ': different words' for error in answer['errors']]
        if '--empty' in sys.argv[1:]:
            answer['errors'] = []
        print(json.dumps({'id': item['id'], **answer}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
