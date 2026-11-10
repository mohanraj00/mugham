"""Tests of tools/tokens.py and of src/tokens/tokens.json. The expected results come from issue #2 and WCAG 2.2."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402
import tokens  # noqa: E402

# Text pairs need 4.5:1. Borders and the focus ring need 3:1 (WCAG 2.2, 1.4.3 and 1.4.11).
PAIRS = [('color.text', 'color.surface', 4.5), ('color.text-muted', 'color.surface', 4.5),
         ('color.on-accent', 'color.accent', 4.5), ('color.accent', 'color.surface', 4.5),
         ('color.danger', 'color.surface', 4.5), ('color.border', 'color.surface', 3.0),
         ('color.focus', 'color.surface', 3.0)]


class TokensTest(unittest.TestCase):
    def setUp(self):
        self.data = tokens.load()

    def test_the_project_tokens_are_valid(self):
        self.assertEqual(tokens.errors(self.data), [])

    def test_each_token_has_a_light_and_a_dark_value(self):
        for name, value in self.data['tokens'].items():
            self.assertEqual(sorted(value), ['dark', 'light'], name)

    def test_contrast(self):
        for theme in ('light', 'dark'):
            for front, back, minimum in PAIRS:
                with self.subTest(theme=theme, front=front):
                    ratio = tokens.contrast(self.data['tokens'][front][theme], self.data['tokens'][back][theme])
                    self.assertGreaterEqual(ratio, minimum)

    def test_contrast_formula(self):
        self.assertAlmostEqual(tokens.contrast('#000000', '#ffffff'), 21.0, places=2)
        self.assertAlmostEqual(tokens.contrast('#777777', '#ffffff'), 4.48, places=2)

    def test_unsafe_values_are_refused(self):
        for value in ['red; background: url(x)', '}', 'expression(1)', '#fff</style>', 'url(https://x.test/a)', '']:
            with self.subTest(value=value):
                data = {'format': 1, 'tokens': {'color.text': {'light': value, 'dark': '#000000'}}}
                self.assertTrue(tokens.errors(data))

    def test_a_token_without_a_dark_value_is_refused(self):
        self.assertIn('color.text: must have exactly a light value and a dark value',
                      tokens.errors({'format': 1, 'tokens': {'color.text': {'light': '#000000'}}}))

    def test_two_names_for_one_css_property_are_refused(self):
        data = {'format': 1, 'tokens': {'color.text-muted': {'light': '#000000', 'dark': '#000000'},
                                        'color.text.muted': {'light': '#000000', 'dark': '#000000'}}}
        self.assertIn('color.text.muted: has the same CSS name as another token', tokens.errors(data))

    def test_the_css_file_agrees_with_the_tokens(self):
        self.assertEqual(tokens.CSS.read_text(encoding='utf-8'), tokens.css(self.data))

    def test_the_css_has_both_themes_and_reduced_motion(self):
        css = tokens.css(self.data)
        self.assertIn('--mu-color-text: #1b1d21;', css)
        self.assertIn('@media (prefers-color-scheme: dark)', css)
        self.assertIn(':root[data-mu-theme="dark"]', css)
        self.assertIn('@media (prefers-reduced-motion: reduce)', css)
        self.assertIn('--mu-motion-fast: 0ms;', css)

    def test_each_contract_token_exists(self):
        contracts, errors = catalog.load_catalog(catalog.ROOT / 'catalog')
        self.assertEqual(errors, [])
        for name, contract in contracts.items():
            for token in contract['tokens']:
                self.assertIn(token, self.data['tokens'], name)


if __name__ == '__main__':
    unittest.main()
