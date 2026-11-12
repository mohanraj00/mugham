"""Tests of .github/workflows/release.yml. The expected results come from mohanraj00/mugham#36 and docs/decisions/0004-package.md."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
TEXT = (ROOT / '.github/workflows/release.yml').read_text(encoding='utf-8')


class ReleaseWorkflowTest(unittest.TestCase):
    def test_each_action_is_pinned_to_a_full_sha(self):
        uses = re.findall(r'^\s*-?\s*uses:\s*(\S+)', TEXT, re.M)
        self.assertTrue(uses)
        for item in uses:
            self.assertRegex(item, r'^[\w.-]+/[\w./-]+@[0-9a-f]{40}$')

    def test_no_package_is_published(self):
        for word in ('npm publish', 'npm ', 'packages: write', 'id-token', 'pypi', 'docker push'):
            self.assertNotIn(word, TEXT)

    def test_the_byte_check_runs_before_the_upload(self):
        self.assertLess(TEXT.index('tools/build.py --check'), TEXT.index('gh release upload'))

    def test_the_release_tag_goes_in_through_env(self):
        self.assertNotIn('run: gh release upload "${{', TEXT)
        run_lines = [x for x in TEXT.splitlines() if 'github.event' in x and 'run:' in x]
        self.assertEqual(run_lines, [])


if __name__ == '__main__':
    unittest.main()
