"""The docs panel of the example pages. The expected results come from issue 100.

examples/docs.json gives the events, the actions, a sample fill and the links of each component. The panel
reads the keys from the contract, so this file has no copy of them.
"""
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import catalog  # noqa: E402

EXAMPLES = ROOT / 'examples'
DOCS = json.loads((EXAMPLES / 'docs.json').read_text(encoding='utf-8'))
LIST = json.loads((EXAMPLES / 'examples.json').read_text(encoding='utf-8'))
CATALOG, ERRORS = catalog.load_catalog(ROOT / 'catalog')
SOURCE = '\n'.join(path.read_text(encoding='utf-8') for path in sorted((ROOT / 'src').rglob('*.js')))
# Each component that has an element of the kit: its class has a static component name.
ELEMENTS = set(re.findall(r"static component = '([a-z-]+)'", SOURCE))
# The application contracts that the examples register, by the name of the contract.
APPLICATION = {json.loads(path.read_text(encoding='utf-8'))['name'] for path in EXAMPLES.rglob('*.json')
               if path.name not in ('docs.json', 'examples.json') and 'name' in json.loads(path.read_text(encoding='utf-8'))}
HOW_TO = ['Bind an action', 'Read a receipt', 'Show an error']
PARTS = [DOCS['thread'], DOCS['application'], *DOCS['components'].values()]


def anchors(path):
    """Return the heading anchors of a Markdown file, as GitHub makes them."""
    heads = re.findall(r'^#+ (.+)$', path.read_text(encoding='utf-8'), re.M)
    return {re.sub(r'[^a-z0-9 -]', '', head.lower()).replace(' ', '-') for head in heads}


class ExampleDocsTest(unittest.TestCase):
    def test_each_element_of_the_kit_has_docs(self):
        self.assertEqual(ERRORS, [])
        self.assertEqual(set(DOCS['components']), ELEMENTS)
        self.assertLessEqual(ELEMENTS, set(CATALOG))

    def test_each_sample_is_a_valid_fill_of_its_contract(self):
        for name, docs in DOCS['components'].items():
            with self.subTest(component=name):
                self.assertEqual(docs['sample']['component'], name)
                self.assertEqual(catalog.fill_errors(docs['sample'], CATALOG), [])

    def test_each_element_name_is_an_element_of_the_kit(self):
        for name, docs in DOCS['components'].items():
            with self.subTest(component=name):
                self.assertRegex(SOURCE, r"\['%s', Mu[A-Za-z]+\]" % re.escape(docs['element']))
        self.assertEqual(DOCS['thread']['element'], 'mu-thread')

    def test_each_event_is_an_event_of_the_kit(self):
        for docs in PARTS:
            for name, text in docs['events']:
                with self.subTest(event=name):
                    self.assertIn("CustomEvent('%s'" % name, SOURCE)
                    self.assertRegex(text, r'^[A-Z].+\.$')
        for name, docs in DOCS['components'].items():
            self.assertIn('mu-refused', [event for event, _ in docs['events']], name)

    def test_each_part_gives_its_actions(self):
        for docs in PARTS:
            self.assertRegex(docs['actions'], r'^[A-Z].+\.$')
        for name in ('action-button', 'editable-form', 'form-card', 'data-grid'):
            self.assertIn('mu-action', [event for event, _ in DOCS['components'][name]['events']], name)

    def test_each_link_goes_to_a_doc_and_a_guide_of_the_repository(self):
        for docs in PARTS:
            path, _, anchor = docs['doc']['path'].partition('#')
            with self.subTest(doc=docs['doc']['path']):
                self.assertTrue((ROOT / path).is_file())
                if anchor:
                    self.assertIn(anchor, anchors(ROOT / path))
            self.assertIn(docs['guide'], DOCS['guides'])
        for guide in DOCS['guides'].values():
            self.assertTrue((ROOT / guide['path']).is_file(), guide['path'])
        # The links open the docs on the page of the repository. The README gives the same repository.
        self.assertEqual(DOCS['repository'], 'https://github.com/mohanraj00/mugham/blob/main/')
        self.assertIn('https://github.com/mohanraj00/mugham', (ROOT / 'README.md').read_text(encoding='utf-8'))

    def test_the_inputs_the_forms_the_table_and_the_grid_have_a_how_to_part(self):
        for name in ('field', 'long-text-field', 'number-field', 'date-field', 'choice-field', 'toggle-field', 'editable-form', 'form-card',
                     'table', 'data-grid'):
            with self.subTest(component=name):
                self.assertEqual([title for title, _ in DOCS['components'][name]['howto']], HOW_TO)

    def test_each_example_names_its_components_and_each_one_has_docs(self):
        for group in LIST['groups']:
            for example in group['examples']:
                with self.subTest(example=example['name']):
                    self.assertTrue(example['components'])
                    self.assertEqual(len(set(example['components'])), len(example['components']))
                    for name in example['components']:
                        self.assertTrue(name == 'thread' or name in DOCS['components'] or name in APPLICATION, name)

    def test_the_panel_reads_the_keys_from_the_contract_and_writes_only_text(self):
        text = (EXAMPLES / 'docs.js').read_text(encoding='utf-8')
        self.assertIn("from '../src/render/registry.js'", text)
        self.assertIn('Object.entries(contract.data)', text)
        for sink in ('innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write'):
            self.assertNotIn(sink, text)
        # The docs file has no copy of a contract key: no part has a data or keys entry.
        for docs in PARTS:
            self.assertLessEqual(set(docs), {'element', 'doc', 'guide', 'events', 'actions', 'sample', 'howto'})


if __name__ == '__main__':
    unittest.main()
