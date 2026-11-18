"""The default page style, src/styles/page.css. The expected results come from issue 98.

The style uses only the kit tokens, loads no font and makes no request. Each example page uses it.
"""
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import tokens  # noqa: E402

STYLE = ROOT / 'src' / 'styles' / 'page.css'
TEXT = re.sub(r'/\*.*?\*/', '', STYLE.read_text(encoding='utf-8'), flags=re.S)
FORCED = TEXT[TEXT.index('@media (forced-colors: active)'):]
NORMAL = TEXT[:TEXT.index('@media (forced-colors: active)')]
SYSTEM = {'Canvas', 'CanvasText', 'LinkText', 'ButtonFace', 'ButtonText', 'Highlight', 'GrayText'}
COLOR = re.compile(r'(?:^|[;{\s])(?:color|background|background-color|border|border-color|border-block-start|border-block-end|'
                   r'border-inline-start|outline|outline-color|box-shadow)\s*:\s*([^;}]+)')
# The words of a color value that are not a color: a width, a line style, a position and the value of the parent.
PLAIN = re.compile(r'^(?:0|-?[0-9.]+(?:px|rem|em)|solid|dashed|inset|none|inherit)$')


class PageStyleTest(unittest.TestCase):
    def test_each_property_of_the_style_is_a_kit_token(self):
        names = {tokens.css_name(name) for name in tokens.load()['tokens']}
        used = set(re.findall(r'var\((--[a-z0-9-]+)', TEXT))
        self.assertTrue(used)
        self.assertLessEqual(used, names)
        self.assertNotIn(',', ''.join(re.findall(r'var\(([^)]*)\)', TEXT)), 'a var() has no fallback value')

    def test_each_color_outside_forced_colors_comes_from_a_token(self):
        self.assertIsNone(re.search(r'#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(', NORMAL))
        for value in COLOR.findall(NORMAL):
            for word in re.sub(r'var\([^)]*\)', '', value).split():
                with self.subTest(value=value.strip()):
                    self.assertRegex(word, PLAIN)

    def test_forced_colors_uses_only_system_colors(self):
        self.assertNotIn('var(', FORCED)
        for value in COLOR.findall(FORCED):
            for word in value.split():
                with self.subTest(value=value.strip()):
                    self.assertTrue(word in SYSTEM or PLAIN.match(word), word)
        for needed in ('Canvas', 'CanvasText', 'LinkText', 'ButtonText', 'Highlight'):
            self.assertIn(needed, FORCED)

    def test_the_style_makes_no_request_and_loads_no_font(self):
        for word in ('url(', '@import', '@font-face', 'http:', 'https:', 'expression('):
            self.assertNotIn(word, TEXT)

    def test_reduced_motion_removes_each_transition(self):
        block = NORMAL[NORMAL.index('@media (prefers-reduced-motion: reduce)'):]
        self.assertIn('transition: none !important', block)
        self.assertIn('animation: none !important', block)
        for value in re.findall(r'transition:\s*([^;}]+)', NORMAL[:NORMAL.index('@media (prefers-reduced-motion: reduce)')]):
            self.assertIn('var(--mu-motion-fast)', value)

    def test_the_style_sets_the_parts_of_a_page(self):
        for selector in ('body {', 'body > header {', 'body > header, body > main, body > footer {', 'h1 {', 'h2 {', 'h3 {',
                         'a {', 'code, kbd, samp, pre {', ':focus-visible {'):
            self.assertIn(selector, TEXT)
        self.assertIn('var(--mu-size-page)', TEXT)

    def test_each_example_page_uses_the_default_style_after_the_tokens(self):
        pages = sorted((ROOT / 'examples').rglob('*.html'))
        self.assertGreater(len(pages), 25)
        for page in pages:
            with self.subTest(page=str(page.relative_to(ROOT))):
                links = re.findall(r'<link rel="stylesheet" href="([^"]+)">', page.read_text(encoding='utf-8'))
                up = '../' * (len(page.relative_to(ROOT).parts) - 1)
                self.assertEqual(links[:2], [up + 'src/tokens/tokens.css', up + 'src/styles/page.css'])

    def test_the_example_style_sheets_set_no_color_and_no_type(self):
        # src/styles/page.css gives the page style. An example style sheet holds only layout and the token names.
        for path in (ROOT / 'examples' / 'page.css', ROOT / 'examples' / 'apps' / 'app.css'):
            text = path.read_text(encoding='utf-8')
            with self.subTest(path=path.name):
                self.assertNotRegex(text, r'(?m)^\s*(?:body|html|a|h1|:focus-visible)\s*[{,]')
                self.assertIsNone(re.search(r'#[0-9a-fA-F]{3,8}\b|\brgba?\(', text))


if __name__ == '__main__':
    unittest.main()
