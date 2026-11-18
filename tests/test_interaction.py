"""The interaction details of the kit. The expected results come from issue 101 and src/components/interaction.md.

tests/browser/states.js checks each state in a browser. This file checks the source and the doc.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCES = sorted((ROOT / 'src').rglob('*.js'))
DOC = (ROOT / 'src' / 'components' / 'interaction.md').read_text(encoding='utf-8')
DOM = (ROOT / 'src' / 'render' / 'dom.js').read_text(encoding='utf-8')
EMPTY = re.compile(r"part: 'empty' \}, '([^']+)'\)")
CONSTANT = re.compile(r"^const (DIFF_EMPTY(?:_PART)?) = '([^']+)';$", re.M)


def text(path):
    return path.read_text(encoding='utf-8')


class InteractionTest(unittest.TestCase):
    def test_each_transition_uses_the_motion_token(self):
        found = 0
        for path in SOURCES:
            for value in re.findall(r'transition:\s*([^;}]+)', text(path)):
                if value.strip() == 'none !important':
                    continue
                found += 1
                for part in value.split(','):
                    self.assertTrue(part.strip().endswith('var(--mu-motion-fast)'), f'{path.name}: {value}')
        self.assertGreaterEqual(found, 3)

    def test_reduced_motion_stops_each_transition_and_each_animation(self):
        rule = DOM[DOM.index('@media (prefers-reduced-motion: reduce)'):]
        self.assertIn('*, *::before, *::after { transition: none !important; animation: none !important; }', rule)

    def test_the_base_style_gives_each_control_state(self):
        for rule in [
            ':focus-visible { outline: 2px solid var(--mu-color-focus); outline-offset: 2px; }',
            'button:hover:not(:disabled, [aria-disabled="true"]), summary:hover {',
            'button:active:not(:disabled, [aria-disabled="true"]), summary:active {',
            'button:disabled, button[aria-disabled="true"] { cursor: not-allowed; opacity: 0.6; }',
            'button[aria-busy="true"] { cursor: progress; }',
        ]:
            self.assertIn(rule, DOM)

    def test_no_component_sets_its_own_focus_ring_color(self):
        for path in SOURCES:
            for value in re.findall(r'outline:\s*([^;}]+)', text(path)):
                if 'solid' in value:
                    self.assertIn(value.strip(), ['2px solid var(--mu-color-focus)', '1px solid Highlight'], path.name)

    def test_the_doc_gives_each_empty_text_of_the_source(self):
        texts = []
        for path in SOURCES:
            source = text(path)
            texts += EMPTY.findall(source)
            texts += [value for _, value in CONSTANT.findall(source)]
        self.assertGreaterEqual(len(set(texts)), 7)
        for value in texts:
            with self.subTest(text=value):
                self.assertIn(f'`{value}`', DOC)
                # A state name, then what the person does next.
                self.assertGreaterEqual(len([part for part in value.split('. ') if part]), 2)

    def test_the_doc_gives_the_next_step_of_a_refusal(self):
        value = re.search(r"export const REFUSED_NEXT = '([^']+)';", DOM).group(1)
        self.assertIn(f'`{value}`', DOC)
        for path in ['src/primitives/base.js', 'src/thread/index.js']:
            self.assertIn('REFUSED_NEXT', text(ROOT / path))

    def test_an_icon_is_a_fixed_path_and_takes_no_data(self):
        icons = re.search(r'const ICONS = Object\.freeze\(\{([^}]*)\}\);', DOM).group(1)
        self.assertEqual(re.findall(r"(\w+): '([^']+)'", icons), [('chevron', 'M3.5 6 8 10.5 12.5 6')])
        self.assertIn("['aria-hidden', 'true']", DOM)
        for path in SOURCES:
            for name in re.findall(r"\bicon\('([^']*)'\)", text(path)):
                self.assertEqual(name, 'chevron', path.name)

    def test_the_copy_control_writes_only_to_the_clipboard_after_a_press(self):
        body = DOM[DOM.index('export function copyControl'):DOM.index('// Shared rules for each primitive')]
        self.assertIn("button.addEventListener('click'", body)
        self.assertEqual(body.count('navigator.clipboard.writeText'), 1)
        self.assertLess(body.index('await navigator.clipboard.writeText'), body.index("show('Copied', 'Copied')"))
        for path in SOURCES:
            if path.name != 'dom.js':
                self.assertNotIn('navigator.clipboard', text(path), path.name)


if __name__ == '__main__':
    unittest.main()
