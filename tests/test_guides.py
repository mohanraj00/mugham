"""Doc tests of docs/guides/. The expected results come from issue #63.

Each code block of a guide is an exact part of a file that a check runs. tests/browser/guides.mjs, which
tools/browser_check.mjs runs, opens each page of examples/guides/ and checks the results that the guides give.
"""
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT / 'tests'))
import tokens  # noqa: E402
from test_tokens import PAIRS  # noqa: E402

GUIDES = ROOT / 'docs' / 'guides'
NAMES = ['contracts.md', 'assemble.md', 'theme.md', 'agents.md']
BLOCK = re.compile(r'(?:^<!-- source: (?P<source>\S+) -->\n)?^```(?P<lang>\w*)\n(?P<code>.*?)^```$', re.M | re.S)
# A source of a guide block is a file that a check runs or reads.
SOURCES = ('examples/guides/', 'catalog/')
# A shell block can only hold these commands. Each one runs in the README quickstart or in make check.
COMMANDS = {'python3 -m http.server 8000', 'make check', 'node tools/browser_check.mjs', 'python3 -B -m unittest tests.test_guides'}
THEME_CSS = ROOT / 'examples' / 'guides' / 'theme.css'


def blocks(name):
    return list(BLOCK.finditer((GUIDES / name).read_text(encoding='utf-8')))


def declarations(text):
    return dict(re.findall(r'(--mu-[a-z0-9-]+):\s*([^;]+);', text))


class GuidesTest(unittest.TestCase):
    def test_the_four_guides_exist(self):
        self.assertEqual(sorted(path.name for path in GUIDES.glob('*.md')), sorted(NAMES + ['README.md']))

    def test_each_code_block_is_part_of_a_checked_file(self):
        runner = (ROOT / 'tests' / 'browser' / 'guides.mjs').read_text(encoding='utf-8')
        for name in NAMES:
            for match in blocks(name):
                code, lang, source = match['code'], match['lang'], match['source']
                with self.subTest(guide=name, block=code[:60]):
                    if lang == 'sh':
                        self.assertIsNone(source)
                        self.assertLessEqual(set(code.strip().splitlines()), COMMANDS)
                        continue
                    if lang == 'text':
                        # An expected output. The browser check of the guide pages has each line.
                        self.assertIsNone(source)
                        for line in code.strip().splitlines():
                            self.assertIn("'%s'" % line, runner)
                        continue
                    self.assertIsNotNone(source, 'a code block needs a source comment')
                    self.assertTrue(source.startswith(SOURCES), source)
                    self.assertIn(code, (ROOT / source).read_text(encoding='utf-8'))

    def test_each_guide_page_has_a_browser_check(self):
        runner = (ROOT / 'tests' / 'browser' / 'guides.mjs').read_text(encoding='utf-8')
        self.assertIn('guideChecks', (ROOT / 'tools' / 'browser_check.mjs').read_text(encoding='utf-8'))
        for page in sorted((ROOT / 'examples' / 'guides').glob('*.html')):
            with self.subTest(page=page.name):
                self.assertIn("'examples/guides/%s'" % page.name, runner)

    def test_the_theming_guide_names_each_token_and_part(self):
        guide = (GUIDES / 'theme.md').read_text(encoding='utf-8')
        for name in declarations(tokens.CSS.read_text(encoding='utf-8')):
            with self.subTest(token=name):
                self.assertTrue('`%s`' % name in guide, name)
        parts = set()
        for path in (ROOT / 'src').rglob('*.js'):
            parts |= set(re.findall(r"part: '([a-z-]+)'", path.read_text(encoding='utf-8')))
        for part in sorted(parts):
            with self.subTest(part=part):
                self.assertTrue('`%s`' % part in guide, part)

    def test_the_second_theme_passes_the_contrast_pairs(self):
        text = re.sub(r'/\*.*?\*/', '', THEME_CSS.read_text(encoding='utf-8'), flags=re.S)
        kit = tokens.load()['tokens']
        names = {tokens.css_name(name): name for name in kit}
        # The rules that set a token. The light rule has the plain container selector.
        rules = [(selector.strip(), body) for selector, body in re.findall(r'([^{}]+)\{([^{}]*)\}', text) if declarations(body)]
        light = [body for selector, body in rules if selector == '.theme-forest']
        dark = [body for selector, body in rules if selector != '.theme-forest']
        self.assertEqual(len(light), 1)
        self.assertEqual(len(dark), 2)
        self.assertEqual(declarations(dark[0]), declarations(dark[1]))
        for theme, body in (('light', light[0]), ('dark', dark[0])):
            values = {name: value[theme] for name, value in kit.items()}
            for prop, value in declarations(body).items():
                with self.subTest(theme=theme, token=prop):
                    self.assertIn(prop, names)
                    if prop.startswith('--mu-color-'):
                        self.assertRegex(value, r'^#[0-9a-f]{6}$')
                    values[names[prop]] = value
            for front, back, minimum in PAIRS:
                with self.subTest(theme=theme, front=front, back=back):
                    self.assertGreaterEqual(tokens.contrast(values[front], values[back]), minimum)

    def test_the_readmes_link_each_guide(self):
        readme = (ROOT / 'README.md').read_text(encoding='utf-8')
        self.assertIn('\n## Docs\n', readme)
        self.assertLess(readme.index('\n## Docs\n'), readme.index('\n## Highlights\n'))
        source = (ROOT / 'src' / 'README.md').read_text(encoding='utf-8')
        for name in NAMES:
            with self.subTest(guide=name):
                self.assertIn('(docs/guides/%s)' % name, readme)
                self.assertIn('(../docs/guides/%s)' % name, source)


if __name__ == '__main__':
    unittest.main()
