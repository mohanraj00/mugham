"""Tests of tools/build.py. Each expected result comes from docs/decisions/0001-build-tools.md."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import build  # noqa: E402


def git(root, *args):
    subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True)


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / 'repo'
        (self.root / 'src/kit').mkdir(parents=True)
        (self.root / 'catalog').mkdir()
        (self.root / 'LICENSE').write_text('License text.\n')
        (self.root / 'src/kit/b.js').write_text('export const b = 2;\n')
        (self.root / 'src/kit/a.js').write_text('export const a = 1;\n')
        (self.root / 'catalog/card.json').write_text('{"name": "card"}\n')
        (self.root / 'src/untracked.js').write_text('not in git\n')
        git(self.root, 'init', '-q')
        git(self.root, 'add', 'LICENSE', 'src/kit', 'catalog')

    def tearDown(self):
        self.tmp.cleanup()

    def out(self, name):
        return Path(self.tmp.name) / name

    def test_two_builds_give_the_same_bytes(self):
        first = build.build(self.root, self.out('one'), epoch=1700000000)
        os.utime(self.root / 'src/kit/a.js', (1, 1))
        second = build.build(self.root, self.out('two'), epoch=1700000000)
        self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_only_tracked_files_in_sorted_order(self):
        archive = build.build(self.root, self.out('one'), epoch=0)
        with tarfile.open(archive) as tar:
            names = tar.getnames()
        self.assertEqual(names, ['mugham/LICENSE', 'mugham/catalog/card.json', 'mugham/manifest.json',
                                 'mugham/src/kit/a.js', 'mugham/src/kit/b.js'])

    def test_fixed_metadata(self):
        archive = build.build(self.root, self.out('one'), epoch=1234)
        with tarfile.open(archive) as tar:
            for member in tar.getmembers():
                self.assertEqual((member.uid, member.gid, member.uname, member.gname), (0, 0, '', ''))
                self.assertEqual((member.mode, member.mtime), (0o644, 1234))

    def test_manifest_has_the_sha256_of_each_file(self):
        archive = build.build(self.root, self.out('one'), epoch=0)
        with tarfile.open(archive) as tar:
            manifest = json.load(tar.extractfile('mugham/manifest.json'))
        self.assertEqual(sorted(manifest['files']), ['LICENSE', 'catalog/card.json', 'src/kit/a.js', 'src/kit/b.js'])
        self.assertEqual(manifest['files']['src/kit/a.js'], hashlib.sha256(b'export const a = 1;\n').hexdigest())

    def test_a_source_change_changes_the_bytes(self):
        first = build.build(self.root, self.out('one'), epoch=0).read_bytes()
        (self.root / 'src/kit/a.js').write_text('export const a = 3;\n')
        second = build.build(self.root, self.out('two'), epoch=0).read_bytes()
        self.assertNotEqual(first, second)

    def test_check_passes_for_a_clean_tree(self):
        self.assertEqual(build.check(self.root, epoch=0, stream=io.StringIO()), 0)

    def test_output_directory_must_be_empty(self):
        out = self.out('one')
        out.mkdir()
        (out / 'old').write_text('x')
        with self.assertRaises(SystemExit):
            build.build(self.root, out, epoch=0)


if __name__ == '__main__':
    unittest.main()
