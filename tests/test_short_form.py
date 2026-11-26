"""The short form of a contract (format 3) and the defaults of the catalog. See catalog/schema/README.md.

tests/vectors/short.json holds the cases that the Python resolver and the browser resolver share.
tests/vectors/resolved.json holds the full form of each catalog contract. It started as the exact content of
the catalog files before issue 103, which were in the full form.
"""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402

VECTORS = Path(__file__).parent / 'vectors'
SHORT = json.loads((VECTORS / 'short.json').read_text(encoding='utf-8'))
RESOLVED = json.loads((VECTORS / 'resolved.json').read_text(encoding='utf-8'))
FILES = {path.stem: json.loads(path.read_text(encoding='utf-8')) for path in sorted((catalog.ROOT / 'catalog').glob('*.json'))}
MINIMUM = {'name': 'seed-tray', 'description': 'A tray of seedlings.', 'data': {}}


def ordered(value):
    """Return the JSON text of value. Two values with the same text have the same keys in the same order."""
    return json.dumps(value)


def stated_paths(contract):
    """Yield the path of each key that a short contract states, down to the keys of a field and of a list item."""
    for key, value in contract.items():
        yield (key,)
        if key in ('slots', 'accessibility'):
            yield from ((key, name) for name in value)
        if key == 'data':
            for name, field in value.items():
                yield from (('data', name, part) for part in field)
                yield from (('data', name, 'items', part) for part in field.get('items', {}))


def without(contract, path):
    result = copy.deepcopy(contract)
    parent = result
    for key in path[:-1]:
        parent = parent[key]
    del parent[path[-1]]
    if not parent and len(path) == 2:
        del result[path[0]]
    return result


class ShortFormTest(unittest.TestCase):
    def test_both_contract_forms_give_the_same_roles_and_keys(self):
        def accessibility(schema):
            return schema['properties']['accessibility']['properties']

        full = accessibility(catalog.CONTRACT_SCHEMA)
        short = accessibility(catalog.SHORT_SCHEMA)
        self.assertEqual(full['role']['enum'], short['role']['enum'])
        self.assertEqual(full['keyboard']['items']['enum'], short['keyboard']['items']['enum'])
        self.assertIn('slider', full['role']['enum'])
        self.assertIn('combobox', full['role']['enum'])
        self.assertTrue({'PageUp', 'PageDown'} <= set(full['keyboard']['items']['enum']))

    def test_both_contract_forms_accept_checkbox_and_switch_roles(self):
        for role in ('checkbox', 'switch'):
            with self.subTest(role=role):
                short = {
                    'name': 'notice-toggle',
                    'description': 'A yes or no control for a notice.',
                    'data': {'label': {'type': 'text', 'required': True, 'min_length': 1, 'size': 'line'}},
                    'accessibility': {'role': role, 'name': {'field': 'label'}},
                }
                full, errors = catalog.resolve(short)
                self.assertEqual(errors, [])
                self.assertEqual(catalog.contract_errors(full), [])
                self.assertEqual(full['accessibility']['role'], role)
                self.assertEqual(full['accessibility']['name'], {'field': 'label'})

    def test_each_shared_case(self):
        for case in SHORT['cases']:
            with self.subTest(case=case['name']):
                before = ordered(case['contract'])
                full, errors = catalog.resolve(case['contract'])
                if not errors:
                    # A case with no resolved key has a short form with no error and a full form with errors.
                    if 'resolved' in case:
                        self.assertEqual(ordered(full), ordered(case['resolved']))
                    errors = catalog.contract_errors(full, None, SHORT['catalog'])
                self.assertEqual(errors, case['errors'])
                self.assertEqual(ordered(case['contract']), before, 'the resolver changed the contract')

    def test_the_result_is_a_copy_of_the_defaults(self):
        full, _ = catalog.resolve(MINIMUM)
        full['slots']['authorship']['required'] = False
        full['accessibility']['keyboard'].append('Tab')
        full['tokens'].append('space.1')
        self.assertEqual(ordered(catalog.resolve(MINIMUM)[0]), ordered(SHORT['cases'][0]['resolved']))

    def test_the_defaults_file_is_valid(self):
        self.assertEqual(catalog.defaults_errors(), [])

    def test_a_bad_defaults_file_gives_errors(self):
        cases = [
            (('sizes', 'short'), 0, 'sizes.short: less than the minimum 1'),
            (('sizes', 'Wide'), 10, 'sizes.Wide: the key name does not agree with the pattern ^[a-z][a-z0-9]*$'),
            (('field', 'required'), 'no', 'field.required: must be true or false'),
            (('contract', 'states'), ['empty'], 'states: must include default'),
            (('contract', 'slots'), {}, 'slots.authorship: a contract with ai_content must declare a required authorship slot'),
            (('contract', 'accessibility'), {'role': 'none'}, 'accessibility: missing key keyboard'),
            (('theme',), 'x', 'theme: unknown key'),
        ]
        for path, value, error in cases:
            with self.subTest(path=path):
                defaults = copy.deepcopy(catalog.DEFAULTS)
                parent = defaults
                for key in path[:-1]:
                    parent = parent[key]
                parent[path[-1]] = value
                self.assertIn(error, catalog.defaults_errors(defaults))


def json_blocks(path):
    import re
    # A block that does not start with a brace is a part of a contract, not a contract.
    text = (catalog.ROOT / path).read_text(encoding='utf-8')
    return [json.loads(block) for block in re.findall(r'^```json\n(\{.*?)^```$', text, re.M | re.S)]


class DocsTest(unittest.TestCase):
    def test_the_example_of_the_format_document_resolves_to_its_full_form(self):
        blocks = json_blocks('catalog/schema/README.md')
        short, full = next((a, b) for a, b in zip(blocks, blocks[1:]) if a.get('name') == 'seed-tray')
        self.assertEqual(sorted(short), ['data', 'description', 'name', 'states'])
        resolved, errors = catalog.resolve(short)
        self.assertEqual(errors, [])
        self.assertEqual(ordered(resolved), ordered(full))
        self.assertEqual(catalog.contract_errors(full, 'seed-tray.json', {}), [])

    def test_the_sizes_of_the_format_document_are_the_sizes_of_the_defaults_file(self):
        import re
        text = (catalog.ROOT / 'catalog/schema/README.md').read_text(encoding='utf-8')
        table = {name: int(value) for name, value in re.findall(r'^\| `([a-z]+)` \| ([0-9]+) \|$', text, re.M)}
        self.assertEqual(table, catalog.DEFAULTS['sizes'])
        self.assertEqual(catalog.DEFAULTS['sizes'], {'short': 40, 'line': 80, 'title': 120, 'summary': 200, 'long': 2000})

    def test_the_minimum_contract_of_the_component_workflow_is_valid(self):
        (minimum,) = json_blocks('.agents/skills/component-workflow/SKILL.md')
        self.assertEqual(sorted(minimum), ['data', 'description', 'name'])
        full, errors = catalog.resolve(minimum)
        self.assertEqual(errors, [])
        self.assertEqual(catalog.contract_errors(full, 'seed-tray.json', {}), [])


class CatalogFormTest(unittest.TestCase):
    def test_the_resolved_catalog_is_equal_to_the_recorded_full_form(self):
        contracts, errors = catalog.load_catalog(catalog.ROOT / 'catalog')
        self.assertEqual(errors, [])
        self.assertEqual(sorted(contracts), sorted(RESOLVED))
        for name, full in RESOLVED.items():
            with self.subTest(contract=name):
                # The comparison is key for key, in order, and value for value.
                self.assertEqual(ordered(contracts[name]), ordered(full))

    def test_each_recorded_contract_is_a_valid_full_contract(self):
        for name, full in RESOLVED.items():
            with self.subTest(contract=name):
                self.assertEqual(full['format'], 2)
                self.assertEqual(catalog.contract_errors(full, name + '.json', RESOLVED), [])

    def test_each_catalog_file_has_the_short_form(self):
        for name, contract in FILES.items():
            with self.subTest(contract=name):
                self.assertNotIn('format', contract)
                self.assertEqual(catalog.schema_errors(contract, catalog.SHORT_SCHEMA), [])

    def test_no_catalog_file_states_a_default(self):
        sizes = set(catalog.DEFAULTS['sizes'].values())
        for name, contract in FILES.items():
            full = ordered(catalog.resolve(contract)[0])
            for path in stated_paths(contract):
                with self.subTest(contract=name, key='.'.join(path)):
                    if path[-1] == 'max_length':
                        parent = contract['data'][path[1]] if len(path) == 3 else contract['data'][path[1]]['items']
                        self.assertNotIn(parent['max_length'], sizes, 'use the size name')
                    changed, errors = catalog.resolve(without(contract, path))
                    self.assertTrue(errors or ordered(changed) != full, 'the key states a default')

    def test_the_catalog_has_fewer_lines_than_the_full_form(self):
        lines = sum(len(path.read_text(encoding='utf-8').splitlines()) for path in (catalog.ROOT / 'catalog').glob('*.json'))
        full = sum(len(json.dumps(contract, indent=2).splitlines()) for contract in RESOLVED.values())
        self.assertLess(lines, full)

    def test_a_folder_with_the_two_forms_loads(self):
        import tempfile
        with tempfile.TemporaryDirectory() as work:
            folder = Path(work)
            (folder / 'loan-card.json').write_text(json.dumps(SHORT['catalog']['loan-card']), encoding='utf-8')
            (folder / 'seed-tray.json').write_text(json.dumps({**MINIMUM, 'data': {
                'loan': {'type': 'component', 'name': 'loan-card'}}}), encoding='utf-8')
            (folder / 'seed-label.json').write_text(json.dumps({'name': 'seed-label', 'description': 'A label.', 'data': {
                'text': {'type': 'text', 'size': 'huge'}}}), encoding='utf-8')
            (folder / 'seed-row.json').write_text(json.dumps({'name': 'seed-row', 'description': 'A row.', 'data': {
                'label': {'type': 'component', 'name': 'seed-label'}}}), encoding='utf-8')
            contracts, errors = catalog.load_catalog(folder)
        self.assertEqual(sorted(contracts), ['loan-card', 'seed-tray'])
        self.assertEqual(contracts['seed-tray']['data']['loan'], {'type': 'component', 'label': 'Loan', 'required': False, 'name': 'loan-card'})
        self.assertEqual(errors, ['seed-label.json: data.text.size: no size has the name huge',
                                  'seed-row.json: data.label: no valid contract has the name seed-label'])


if __name__ == '__main__':
    unittest.main()
