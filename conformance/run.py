#!/usr/bin/env python3
"""Run the conformance set of the stable contract against a kit or against a second validator.

conformance/README.md gives the steps and the format of a request line and an answer line. This runner uses only
the Python standard library. It reads the cases as data and runs no code from them.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shlex
import subprocess
import sys

HERE = Path(__file__).resolve().parent
MANIFEST = 'manifest.json'
MANIFEST_FORMAT = 1
KINDS = ['fill', 'contract', 'short', 'resolve', 'envelope', 'stream']
# The kinds that need the files of a kit: the input of each case is a contract file of the kit catalog.
KIT_KINDS = ['resolve']
VERSION = re.compile(r'(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})')
SET = re.compile(r'v[1-9][0-9]{0,3}')
# The names that a tool can leave in the set folder. They are not files of the set.
IGNORED = {'__pycache__', '.DS_Store'}


class Stop(Exception):
    """A problem that stops the run before a result: a wrong argument, a damaged set or a failed command."""


def version(text):
    """Return a release version as three numbers, or stop."""
    if not isinstance(text, str) or not VERSION.fullmatch(text):
        raise Stop('not a release version of the form 1.2.3: %r' % (text,))
    return tuple(int(part) for part in text.split('.'))


def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise Stop('cannot read %s: %s' % (path, error))


def set_files(folder):
    """Return the relative path of each file of the set, in sorted order. The manifest is not in the list."""
    found = []
    for path in sorted(folder.rglob('*')):
        relative = path.relative_to(folder)
        if IGNORED & set(relative.parts) or path.is_dir() and not path.is_symlink():
            continue
        if path.is_symlink() or not path.is_file():
            raise Stop('not a regular file: %s' % path)
        if relative.as_posix() != MANIFEST:
            found.append(relative.as_posix())
    return found


def digests(folder):
    return {name: hashlib.sha256((folder / name).read_bytes()).hexdigest() for name in set_files(folder)}


def manifest_text(folder, kit):
    version(kit)
    value = {'format': MANIFEST_FORMAT, 'set': int(folder.name[1:]), 'kit': kit, 'files': digests(folder)}
    return json.dumps(value, indent=2, sort_keys=True) + '\n'


def read_manifest(folder):
    """Return the manifest of the set, or stop if a file of the set does not agree with it."""
    manifest = read_json(folder / MANIFEST)
    if not isinstance(manifest, dict) or manifest.get('format') != MANIFEST_FORMAT:
        raise Stop('the manifest does not have the format %d' % MANIFEST_FORMAT)
    if manifest.get('set') != int(folder.name[1:]):
        raise Stop('the manifest is not the manifest of the set %s' % folder.name)
    version(manifest.get('kit'))
    listed, found = manifest.get('files'), digests(folder)
    if not isinstance(listed, dict):
        raise Stop('the manifest has no list of files')
    problems = ['a file is not in the manifest: ' + name for name in sorted(set(found) - set(listed))]
    problems += ['a file of the manifest is not in the set: ' + name for name in sorted(set(listed) - set(found))]
    problems += ['the SHA-256 does not agree with the manifest: ' + name
                 for name in sorted(set(listed) & set(found)) if listed[name] != found[name]]
    if problems:
        raise Stop('the set does not agree with its manifest. ' + ' '.join(problem + '.' for problem in problems))
    return manifest


def kit_contracts(kit):
    """Return the content of each contract file of the kit catalog, by name."""
    folder = Path(kit) / 'catalog'
    if not folder.is_dir():
        raise Stop('the kit has no catalog folder: %s' % folder)
    return {path.stem: read_json(path) for path in sorted(folder.glob('*.json'))}


def load_cases(folder, manifest, kit=None):
    """Return each case of the set as a request and its expected answer."""
    cases = []

    def add(kind, file, index, item, request, expected):
        since = item.get('since')
        version(since)
        cases.append({'id': '%s#%d' % (file, index), 'kind': kind, 'name': item['name'], 'since': since,
                      'request': request, 'expected': expected})

    fills = read_json(folder / 'catalog/fills.json')
    for index, item in enumerate(fills['cases']):
        add('fill', 'catalog/fills.json', index, item, {'catalog': fills['catalog'], 'fill': item['fill']},
            {'errors': item['errors']})
    contracts = read_json(folder / 'catalog/contracts.json')
    for index, item in enumerate(contracts['cases']):
        add('contract', 'catalog/contracts.json', index, item,
            {'catalog': contracts['catalog'], 'contract': item['contract']}, {'errors': item['errors']})
    short = read_json(folder / 'catalog/short.json')
    for index, item in enumerate(short['cases']):
        expected = {'errors': item['errors']}
        if 'resolved' in item:
            expected['resolved'] = item['resolved']
        add('short', 'catalog/short.json', index, item, {'catalog': short['catalog'], 'contract': item['contract']},
            expected)
    if kit is not None:
        # The full form of each catalog contract belongs to the release of the set, not to an earlier release.
        resolved, files = read_json(folder / 'catalog/resolved.json'), kit_contracts(kit)
        for index, name in enumerate(sorted(set(resolved) | set(files))):
            item = {'name': 'the full form of the catalog contract ' + name, 'since': manifest['kit']}
            add('resolve', 'catalog/resolved.json', index, item, {'contract': files.get(name)},
                {'errors': [], 'resolved': resolved.get(name)})
    envelopes = read_json(folder / 'envelope/envelopes.json')
    for index, item in enumerate(envelopes['cases']):
        add('envelope', 'envelope/envelopes.json', index, item, {'envelope': item['envelope']},
            {'result': item['result']})
    streams = read_json(folder / 'envelope/streams.json')
    for index, item in enumerate(streams['cases']):
        add('stream', 'envelope/streams.json', index, item, {'events': item['events']}, {'result': item['expected']})
    return cases


def path_of(error):
    """Return the path of an error text: the text before the first colon and space."""
    return error.split(': ', 1)[0] if isinstance(error, str) else error


def paths_only(value):
    """Return value with each list of error texts as the sorted list of its paths."""
    if isinstance(value, dict):
        return {key: sorted(path_of(item) for item in item_list) if key == 'errors' and is_texts(item_list)
                else paths_only(item_list) for key, item_list in value.items()}
    if isinstance(value, list):
        return [paths_only(item) for item in value]
    return value


def is_texts(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def same(left, right):
    """Tell if two JSON values are equal. true is not equal to 1, as in JSON."""
    if type(left) is not type(right) and not (isinstance(left, (int, float)) and isinstance(right, (int, float))
                                               and not isinstance(left, bool) and not isinstance(right, bool)):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(same(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    return left == right


def json_line(value):
    """Return the JSON text of value on one line. A number above the float range stays a number of JSON."""
    if isinstance(value, float) and not math.isfinite(value):
        if value != value:
            raise Stop('a case has a value that is not a number')
        return '1e999' if value > 0 else '-1e999'
    if isinstance(value, dict):
        return '{' + ', '.join(json.dumps(key) + ': ' + json_line(item) for key, item in value.items()) + '}'
    if isinstance(value, list):
        return '[' + ', '.join(json_line(item) for item in value) + ']'
    return json.dumps(value)


def answers(command, cases, timeout):
    """Send each request on one input line of the command and return its answers by id."""
    lines = ''.join(json_line({'id': case['id'], 'kind': case['kind'], **case['request']}) + '\n' for case in cases)
    try:
        result = subprocess.run(command, input=lines.encode('utf-8'), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=timeout)
    except subprocess.TimeoutExpired:
        raise Stop('the command gave no result in %d seconds' % timeout)
    except OSError as error:
        raise Stop('cannot start the command: %s' % error)
    if result.returncode != 0:
        tail = result.stderr.decode('utf-8', 'replace').strip().splitlines()[-5:]
        raise Stop('the command stopped with the code %d. %s' % (result.returncode, ' | '.join(tail)))
    found = {}
    # A line ends only at a line feed. A text of an answer can contain a different line break character.
    for number, line in enumerate(result.stdout.decode('utf-8', 'replace').split('\n'), 1):
        if not line.strip():
            continue
        try:
            answer = json.loads(line)
        except ValueError:
            raise Stop('output line %d of the command is not JSON' % number)
        if not isinstance(answer, dict) or not isinstance(answer.get('id'), str):
            raise Stop('output line %d of the command has no id' % number)
        if answer['id'] in found:
            raise Stop('the command gave two answers for the id %s' % answer['id'])
        found[answer['id']] = answer
    return found


def failure(case, answer, full_text):
    """Return None if the answer agrees with the expected answer of the case. If not, return a description."""
    if answer is None:
        return {'id': case['id'], 'name': case['name'], 'problem': 'the command gave no answer'}
    expected = case['expected']
    got = {key: answer.get(key) for key in expected}
    left, right = (expected, got) if full_text else (paths_only(expected), paths_only(got))
    if same(left, right):
        return None
    return {'id': case['id'], 'name': case['name'], 'expected': left, 'got': right}


def run(folder, command, kit=None, since=None, kinds=None, full_text=False, timeout=120):
    """Run the set in folder and return the report."""
    manifest = read_manifest(folder)
    limit = version(since) if since else None
    kinds = list(kinds or KINDS)
    skipped = {}
    if kit is None:
        skipped = {kind: 'this kind needs --kit' for kind in kinds if kind in KIT_KINDS}
    needs_kit = any(kind in KIT_KINDS for kind in kinds)
    cases = [case for case in load_cases(folder, manifest, kit if needs_kit else None) if case['kind'] in kinds]
    if limit:
        cases = [case for case in cases if version(case['since']) <= limit]
    if not cases:
        raise Stop('the run has no case. Change --since or --kind')
    found = answers(command, cases, timeout)
    unknown = sorted(set(found) - {case['id'] for case in cases})
    if unknown:
        raise Stop('the command gave an answer for an id that is not in the run: %s' % unknown[0])
    failed = [item for item in (failure(case, found.get(case['id']), full_text) for case in cases) if item]
    counts = {kind: sum(1 for case in cases if case['kind'] == kind) for kind in kinds}
    return {'passed': not failed, 'set': folder.name, 'kit': manifest['kit'],
            'compared': 'full error texts' if full_text else 'error paths', 'since': since, 'cases': counts,
            'skipped': skipped, 'failed': failed}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--kit', help='the folder of a kit, with its src and catalog folders')
    parser.add_argument('--validator', help='the command of a second validator. It reads requests and writes answers')
    parser.add_argument('--set', default='v1', help='the folder of the set, for example v1')
    parser.add_argument('--since', help='run only the cases of this release and the earlier releases')
    parser.add_argument('--kind', action='append', choices=KINDS, help='run only this kind. You can give it again')
    parser.add_argument('--full-text', action='store_true', help='compare the full error texts, not only the paths')
    parser.add_argument('--timeout', type=int, default=120, help='the time limit of the command, in seconds')
    parser.add_argument('--write-manifest', metavar='RELEASE', nargs='?', const='',
                        help='for a maintainer: write the manifest of the set again. RELEASE changes its kit release')
    args = parser.parse_args(argv)
    try:
        if not SET.fullmatch(args.set):
            raise Stop('not the name of a set: %r' % args.set)
        folder = HERE / args.set
        if not folder.is_dir():
            raise Stop('the set has no folder: %s' % folder)
        if args.write_manifest is not None:
            kit = args.write_manifest or read_json(folder / MANIFEST).get('kit')
            (folder / MANIFEST).write_text(manifest_text(folder, kit), encoding='utf-8')
            print(folder / MANIFEST)
            return 0
        if args.validator:
            command = shlex.split(args.validator)
            if not command:
                raise Stop('the validator command is empty')
        elif args.kit:
            command = ['node', str(HERE / 'kit.mjs'), args.kit]
        else:
            raise Stop('give --kit, --validator or the two')
        if args.timeout < 1:
            raise Stop('the time limit must be 1 second or more')
        report = run(folder, command, args.kit, args.since, args.kind, args.full_text, args.timeout)
    except Stop as stop:
        print(json.dumps({'passed': False, 'error': str(stop)}, indent=2))
        return 2
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
