"""Tests of the versioned conformance set in conformance/. The expected results come from mohanraj00/mugham#17 and
docs/decisions/0008-stable-contract.md, section 3 and the items I2 and I4.

tests/conformance.test.mjs runs the set against the kit. These tests run it against the Python validator.
"""
import contextlib
import io
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'conformance'))
import run  # noqa: E402

SET = ROOT / 'conformance' / 'v1'
VALIDATOR = [sys.executable, '-B', str(ROOT / 'tests' / 'conformance_validator.py')]
# The Python validator has no envelope reader.
KINDS = ['fill', 'contract', 'short', 'resolve']
# The grammar of an error path in catalog/schema/README.md. A key that a contract does not declare can have
# other characters. The cases of the set have no such key.
STEP = r'[A-Za-z0-9_-]+(?:\.\.\.)?'
PATH = r'(?:\((?:fill|contract)\)|%s(?:\.%s|\[[0-9]+\])*)' % (STEP, STEP)
RELEASE = re.compile(r'^## (\d+\.\d+\.\d+), \d{4}-\d{2}-\d{2}$', re.M)


def call(*args):
    """Run the runner with arguments and return its exit code and its report."""
    stream = io.StringIO()
    with contextlib.redirect_stdout(stream):
        code = run.main(list(args))
    return code, json.loads(stream.getvalue())


class ManifestTest(unittest.TestCase):
    def test_the_manifest_gives_the_sha256_of_each_file_of_the_set(self):
        manifest = json.loads((SET / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(manifest), ['files', 'format', 'kit', 'set'])
        self.assertEqual((manifest['format'], manifest['set']), (1, 1))
        self.assertEqual(sorted(manifest['files']),
                         ['catalog/contracts.json', 'catalog/fills.json', 'catalog/resolved.json', 'catalog/short.json',
                          'envelope/envelopes.json', 'envelope/generate.py', 'envelope/streams.json'])
        self.assertEqual(run.read_manifest(SET), manifest)

    def test_the_committed_manifest_is_the_output_of_the_runner(self):
        text = (SET / 'manifest.json').read_text(encoding='utf-8')
        self.assertEqual(run.manifest_text(SET, json.loads(text)['kit']), text,
                         'Run python3 -B conformance/run.py --write-manifest.')

    def test_the_kit_version_of_the_manifest_agrees_with_the_changelog(self):
        # The manifest names the release that the set goes out with. With an Unreleased section, that release is
        # the newest release or a later one. With no such section, it is the newest release.
        changelog = (ROOT / 'CHANGELOG.md').read_text(encoding='utf-8')
        newest = run.version(RELEASE.search(changelog).group(1))
        kit = run.version(run.read_manifest(SET)['kit'])
        if '\n## Unreleased\n' in changelog:
            self.assertGreaterEqual(kit, newest)
        else:
            self.assertEqual(kit, newest)

    def test_each_case_has_a_since_key_that_is_not_after_the_kit_version(self):
        manifest = run.read_manifest(SET)
        cases = run.load_cases(SET, manifest, ROOT)
        self.assertEqual({case['kind'] for case in cases}, set(run.KINDS))
        for case in cases:
            with self.subTest(case=case['id']):
                self.assertLessEqual(run.version(case['since']), run.version(manifest['kit']))
        for name in ('catalog/fills.json', 'catalog/contracts.json', 'catalog/short.json',
                     'envelope/envelopes.json', 'envelope/streams.json'):
            for item in json.loads((SET / name).read_text(encoding='utf-8'))['cases']:
                with self.subTest(file=name, case=item['name']):
                    self.assertEqual(list(item)[:2], ['name', 'since'])


class ChangedSetTest(unittest.TestCase):
    """Runs of a copy of the set. Each test changes the copy."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.set = Path(self.tmp.name) / 'v1'
        shutil.copytree(SET, self.set, ignore=shutil.ignore_patterns('__pycache__'))

    def tearDown(self):
        self.tmp.cleanup()

    def change(self, name, edit):
        path = self.set / name
        value = json.loads(path.read_text(encoding='utf-8'))
        edit(value)
        path.write_text(json.dumps(value), encoding='utf-8')

    def write_manifest(self, kit):
        (self.set / 'manifest.json').write_text(run.manifest_text(self.set, kit), encoding='utf-8')

    def test_a_changed_file_stops_the_run(self):
        self.change('catalog/fills.json', lambda value: value['cases'].pop())
        with self.assertRaisesRegex(run.Stop, 'the SHA-256 does not agree with the manifest: catalog/fills.json'):
            run.run(self.set, VALIDATOR, kinds=['fill'])

    def test_an_added_file_and_a_removed_file_stop_the_run(self):
        (self.set / 'catalog/more.json').write_text('{}', encoding='utf-8')
        (self.set / 'catalog/short.json').unlink()
        with self.assertRaisesRegex(run.Stop, 'a file is not in the manifest: catalog/more.json. '
                                              'a file of the manifest is not in the set: catalog/short.json.'):
            run.run(self.set, VALIDATOR, kinds=['fill'])

    def test_a_link_in_the_set_stops_the_run(self):
        (self.set / 'catalog/link.json').symlink_to(self.set / 'catalog/fills.json')
        with self.assertRaisesRegex(run.Stop, 'not a regular file'):
            run.run(self.set, VALIDATOR, kinds=['fill'])

    def test_since_selects_the_cases_of_a_release_and_the_earlier_releases(self):
        def later(value):
            value['cases'][0]['since'] = '1.1.0'
            value['cases'][1]['since'] = '1.2.0'
        self.change('catalog/fills.json', later)
        self.write_manifest('1.2.0')
        count = len(json.loads((self.set / 'catalog/fills.json').read_text(encoding='utf-8'))['cases'])
        for since, expected in ((None, count), ('1.2.0', count), ('1.1.0', count - 1), ('1.0.0', count - 2)):
            with self.subTest(since=since):
                report = run.run(self.set, VALIDATOR, since=since, kinds=['fill'])
                self.assertEqual((report['passed'], report['cases']), (True, {'fill': expected}))
        with self.assertRaisesRegex(run.Stop, 'the run has no case'):
            run.run(self.set, VALIDATOR, since='0.9.0', kinds=['fill'])

    def test_a_case_with_no_valid_since_key_stops_the_run(self):
        self.change('catalog/contracts.json', lambda value: value['cases'][0].update(since='1.0'))
        self.write_manifest('1.0.0')
        with self.assertRaisesRegex(run.Stop, 'not a release version'):
            run.run(self.set, VALIDATOR, kinds=['contract'])

    def test_a_changed_expected_error_fails_its_case(self):
        def edit(value):
            case = next(item for item in value['cases'] if item['errors'])
            case['errors'] = ['data.other: a different path']
        self.change('catalog/fills.json', edit)
        self.write_manifest('1.0.0')
        report = run.run(self.set, VALIDATOR, kinds=['fill'])
        self.assertFalse(report['passed'])
        self.assertEqual(len(report['failed']), 1)
        self.assertEqual(report['failed'][0]['expected'], {'errors': ['data.other']})


class RunTest(unittest.TestCase):
    def test_the_python_validator_passes_with_paths_and_with_full_texts(self):
        counts = None
        for full_text in (False, True):
            with self.subTest(full_text=full_text):
                report = run.run(SET, VALIDATOR, kit=ROOT, kinds=KINDS, full_text=full_text)
                self.assertEqual((report['passed'], report['failed'], report['skipped']), (True, [], {}))
                self.assertEqual(report['compared'], 'full error texts' if full_text else 'error paths')
                self.assertTrue(all(report['cases'][kind] > 0 for kind in KINDS))
                counts = counts or report['cases']
                self.assertEqual(report['cases'], counts)

    def test_the_default_compares_only_the_paths(self):
        # Decision 0008, owner answer 3: the path of an error is stable, and the words after it are not.
        command = VALIDATOR + ['--reword']
        self.assertTrue(run.run(SET, command, kinds=['fill', 'contract'])['passed'])
        report = run.run(SET, command, kinds=['fill', 'contract'], full_text=True)
        self.assertFalse(report['passed'])
        with_errors = sum(1 for case in run.load_cases(SET, run.read_manifest(SET))
                          if case['kind'] in ('fill', 'contract') and case['expected']['errors'])
        self.assertEqual(len(report['failed']), with_errors)

    def test_a_validator_that_accepts_each_input_fails(self):
        report = run.run(SET, VALIDATOR + ['--empty'], kinds=['fill'])
        self.assertFalse(report['passed'])
        self.assertTrue(report['failed'])
        self.assertEqual(report['failed'][0]['got'], {'errors': []})

    def test_the_catalog_kind_needs_a_kit(self):
        report = run.run(SET, VALIDATOR, kinds=KINDS)
        self.assertEqual(report['skipped'], {'resolve': 'this kind needs --kit'})
        self.assertEqual(report['cases']['resolve'], 0)

    def test_a_missing_answer_fails_its_case(self):
        report = run.run(SET, [sys.executable, '-c', 'import sys; sys.stdin.read()'], kinds=['contract'])
        self.assertFalse(report['passed'])
        self.assertEqual({item['problem'] for item in report['failed']}, {'the command gave no answer'})

    def test_a_command_problem_stops_the_run(self):
        for code, message in (('raise SystemExit(3)', 'stopped with the code 3'),
                              ('print("no json")', 'output line 1 of the command is not JSON'),
                              ('print("{}")', 'output line 1 of the command has no id'),
                              ('print(\'{"id": "other#0"}\')', 'an id that is not in the run: other#0'),
                              ('print(\'{"id": "a"}\\n{"id": "a"}\')', 'two answers for the id a')):
            with self.subTest(code=code):
                with self.assertRaisesRegex(run.Stop, message):
                    run.run(SET, [sys.executable, '-c', 'import sys; sys.stdin.read(); ' + code], kinds=['contract'])
        with self.assertRaisesRegex(run.Stop, 'cannot start the command'):
            run.run(SET, [str(ROOT / 'no-such-command')], kinds=['contract'])

    def test_the_command_line(self):
        validator = ' '.join(VALIDATOR[1:])
        code, report = call('--validator', sys.executable + ' ' + validator, '--kind', 'contract')
        self.assertEqual((code, report['passed'], report['cases']), (0, True, {'contract': 20}))
        code, report = call('--validator', sys.executable + ' ' + validator + ' --empty', '--kind', 'contract')
        self.assertEqual((code, report['passed']), (1, False))
        for args, message in ((['--kind', 'fill'], 'give --kit, --validator or the two'),
                              (['--validator', ' '], 'the validator command is empty'),
                              (['--validator', 'x', '--set', '../v1'], 'not the name of a set'),
                              (['--validator', 'x', '--set', 'v2'], 'the set has no folder'),
                              (['--validator', 'x', '--since', '1.0'], 'not a release version'),
                              (['--validator', 'x', '--timeout', '0'], 'the time limit must be 1 second or more')):
            with self.subTest(args=args):
                code, report = call(*args)
                self.assertEqual((code, report['passed']), (2, False))
                self.assertIn(message, report['error'])

    def test_a_number_above_the_float_range_stays_a_json_number(self):
        self.assertEqual(run.json_line({'a': [float('inf'), -float('inf'), 1.5, True, None, 'x']}),
                         '{"a": [1e999, -1e999, 1.5, true, null, "x"]}')
        with self.assertRaises(run.Stop):
            run.json_line(float('nan'))

    def test_json_true_is_not_equal_to_1(self):
        self.assertTrue(run.same({'a': [1, 1.0]}, {'a': [1.0, 1]}))
        self.assertFalse(run.same(True, 1))
        self.assertFalse(run.same({'a': None}, {}))
        self.assertFalse(run.same([1, 2], [2, 1]))


class ErrorPathTest(unittest.TestCase):
    def test_each_expected_error_starts_with_a_path_then_a_colon_and_a_space(self):
        # The kit tests compare the errors of the two validators with these texts, so the two give this form.
        count = 0
        for name in ('catalog/fills.json', 'catalog/contracts.json', 'catalog/short.json'):
            for item in json.loads((SET / name).read_text(encoding='utf-8'))['cases']:
                for error in item['errors']:
                    count += 1
                    with self.subTest(file=name, error=error):
                        self.assertRegex(error, r'(?s)\A%s: .+\Z' % PATH)
        for item in json.loads((SET / 'envelope/streams.json').read_text(encoding='utf-8'))['cases']:
            for error in item['expected']['errors']:
                count += 1
                with self.subTest(error=error):
                    self.assertRegex(error, r'(?s)\A%s: .+\Z' % PATH)
        self.assertGreater(count, 150)

    def test_the_path_of_an_error_is_the_text_before_the_first_colon_and_space(self):
        self.assertEqual(run.path_of('data.items[2].id: must be a text: of 1 character'), 'data.items[2].id')
        self.assertEqual(run.path_of('(fill): must be an object'), '(fill)')
        self.assertEqual(run.path_of('no path'), 'no path')
        self.assertEqual(run.paths_only({'result': {'errors': ['b: x', 'a: y'], 'parts': [{'errors': ['c: z']}]}}),
                         {'result': {'errors': ['a', 'b'], 'parts': [{'errors': ['c']}]}})


if __name__ == '__main__':
    unittest.main()
