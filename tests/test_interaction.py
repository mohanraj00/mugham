"""The interaction details of the kit. The expected results come from issue 101 and src/components/interaction.md.

tests/browser/states.js checks each state in a browser. This file checks the source and the doc.
"""
import json
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

    def test_each_icon_uses_a_fixed_path_from_the_kit(self):
        icons = re.search(r'const ICONS = Object\.freeze\(\{([^}]*)\}\);', DOM).group(1)
        paths = dict(re.findall(r"(\w+): '([^']+)'", icons))
        self.assertEqual(set(paths), {'chevron', 'check', 'cross', 'edit', 'delete', 'send', 'retry'})
        self.assertEqual(paths['chevron'], 'M3.5 6 8 10.5 12.5 6')
        self.assertEqual(len(set(paths.values())), len(paths))
        self.assertIn('Object.hasOwn(ICONS, name)', DOM)
        self.assertIn("path.setAttribute('d', ICONS[name])", DOM)
        self.assertIn("['aria-hidden', 'true']", DOM)

        contract = json.loads(text(ROOT / 'catalog/action-button.json'))
        icon_field = contract['data']['icon']
        self.assertEqual(icon_field['type'], 'enum')
        self.assertCountEqual(icon_field['values'], paths.keys() - {'chevron'})

        components_path = ROOT / 'src/components/index.js'
        components = text(components_path)
        button_start = components.index('\nexport class MuActionButton ')
        button_end = components.index('\n}', button_start)
        check_start = components.index('\n  check(data) {', button_start, button_end)
        check = components[check_start:components.index('\n  }', check_start, button_end)]
        self.assertLess(check.index('const { description, icon, display } = this.action;'),
                        check.index('if (data.icon !== icon)'))
        render_start = components.index('\n  render(data) {', button_start, button_end)
        render_end = components.index('\n  }', render_start, button_end)

        declarations = {
            ROOT / 'src/actions/action.js': 'get icon(',
            ROOT / 'src/render/dom.js': 'function icon(',
        }
        literal_call = re.compile(r"icon\('([^']*)'\)")
        fill_calls = 0
        for path in SOURCES:
            source = text(path)
            for call in re.finditer(r'\b(?:(?:function|get)\s+)?icon\s*\(', source):
                if call.group() == declarations.get(path):
                    continue
                start = call.start()
                if source.startswith('icon(data.icon)', start):
                    self.assertEqual(path, components_path)
                    self.assertTrue(render_start < start < render_end, 'icon(data.icon) must be in MuActionButton.render')
                    fill_calls += 1
                else:
                    literal = literal_call.match(source, start)
                    self.assertIsNotNone(literal, f'{path.name}: {source[start:].splitlines()[0]}')
                    self.assertIn(literal.group(1), paths, path.name)
        self.assertEqual(fill_calls, 1)

        base = text(ROOT / 'src/primitives/base.js')
        fill_check = base.index('fillErrors(value, CONTRACTS)')
        other_checks = base.index(
            'if (errors.length === 0) errors.push(...authorErrors(value, this.#actor), ...this.check(value.data));'
        )
        refusal = base.index('if (errors.length) {\n      this.refuse(errors);\n      return;\n    }')
        self.assertLess(fill_check, other_checks)
        self.assertLess(other_checks, refusal)
        self.assertLess(refusal, base.index('this.render('))

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
