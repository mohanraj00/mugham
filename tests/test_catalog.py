"""Tests of tools/catalog.py. Each expected result comes from catalog/schema/README.md."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402

LOAN = {
    'format': 1, 'name': 'loan-card', 'version': '0.1.0', 'kind': 'component',
    'description': 'A synthetic library loan.', 'ai_content': True,
    'data': {
        'title': {'type': 'text', 'label': 'Title', 'required': True, 'max_length': 80},
        'due': {'type': 'date', 'label': 'Due date', 'required': True},
        'renewals': {'type': 'integer', 'label': 'Renewals', 'required': False, 'minimum': 0, 'maximum': 3},
        'status': {'type': 'enum', 'label': 'Status', 'required': False, 'values': ['on_loan', 'late']},
        'facts': {'type': 'list', 'label': 'Facts', 'required': False, 'max_items': 2,
                  'items': {'type': 'text', 'label': 'Fact', 'required': True, 'max_length': 40}},
    },
    'actions': {'renew': {'tool': 'library.renew', 'label': 'Renew', 'confirm': False,
                          'arguments': {'loan_id': {'type': 'text', 'label': 'Loan', 'required': True, 'max_length': 20}}}},
    'states': ['default', 'pending', 'done', 'error'],
    'tokens': ['color.surface', 'space.2'],
    'accessibility': {'role': 'article', 'name': {'field': 'title'}, 'keyboard': ['Tab'],
                      'forced_colors': True, 'reduced_motion': True},
}
GRID = {
    'format': 1, 'name': 'loan-grid', 'version': '0.1.0', 'kind': 'component',
    'description': 'A grid of loans.', 'ai_content': False,
    'data': {'label': {'type': 'text', 'label': 'Label', 'required': True, 'max_length': 40},
             'cards': {'type': 'list', 'label': 'Loans', 'required': True, 'max_items': 3,
                       'items': {'type': 'component', 'label': 'Loan', 'required': True, 'name': 'loan-card'}}},
    'states': ['default', 'empty'], 'tokens': [],
    'accessibility': {'role': 'list', 'name': {'field': 'label'}, 'keyboard': [], 'forced_colors': True, 'reduced_motion': True},
}
FILL = {'component': 'loan-card', 'version': '0.1.0',
        'data': {'title': 'Field guide to moss', 'due': '2026-12-01', 'renewals': 1, 'facts': ['Shelf 4', 'Floor 2']},
        'actions': [{'action': 'renew', 'arguments': {'loan_id': 'L-0001'}}]}


def changed(base, path, value):
    result = copy.deepcopy(base)
    target = result
    for key in path[:-1]:
        target = target[key]
    if value is KeyError:
        del target[path[-1]]
    else:
        target[path[-1]] = value
    return result


class ContractTest(unittest.TestCase):
    def errors(self, contract, catalog_map=None):
        return catalog.contract_errors(contract, 'loan-card.json' if contract.get('name') == 'loan-card' else None,
                                       catalog_map)

    def test_a_valid_contract_has_no_errors(self):
        self.assertEqual(self.errors(LOAN), [])

    def test_schema_errors_have_a_path(self):
        cases = [
            (('kind',), 'widget', 'kind'),
            (('version',), '1.0', 'version'),
            (('format',), 2, 'format'),
            (('data', 'title', 'max_length'), KeyError, 'data.title'),
            (('data', 'title', 'html'), True, 'data.title'),
            (('accessibility', 'forced_colors'), False, 'accessibility.forced_colors'),
            (('actions', 'renew', 'tool'), 'Run Anything', 'actions.renew'),
            (('tokens',), ['Color'], 'tokens[0]'),
            (('style',), 'x', 'style'),
        ]
        for path, value, where in cases:
            with self.subTest(path=path):
                found = self.errors(changed(LOAN, path, value))
                self.assertTrue(any(error.startswith(where) for error in found), found)

    def test_rule_1_name_agrees_with_file_name(self):
        self.assertIn('name: must agree with the file name other.json',
                      catalog.contract_errors(LOAN, 'other.json'))

    def test_rule_2_default_state(self):
        self.assertIn('states: must include default', self.errors(changed(LOAN, ('states',), ['pending', 'done', 'error'])))

    def test_rule_3_action_states(self):
        self.assertIn('states: a contract with actions must include pending, done and error',
                      self.errors(changed(LOAN, ('states',), ['default', 'done', 'error'])))

    def test_rule_4_name_field(self):
        self.assertIn('accessibility.name: the field must be a required text field',
                      self.errors(changed(LOAN, ('accessibility', 'name'), {'field': 'due'})))
        self.assertIn('accessibility.name: the field must be a required text field',
                      self.errors(changed(LOAN, ('accessibility', 'name'), {'field': 'missing'})))

    def test_rule_5_limits(self):
        self.assertIn('data.title: min_length is more than max_length',
                      self.errors(changed(LOAN, ('data', 'title', 'min_length'), 81)))
        self.assertIn('data.renewals: minimum is more than maximum',
                      self.errors(changed(LOAN, ('data', 'renewals', 'minimum'), 4)))
        self.assertIn('actions.renew.arguments.loan_id: min_length is more than max_length',
                      self.errors(changed(LOAN, ('actions', 'renew', 'arguments', 'loan_id', 'min_length'), 30)))

    def test_rule_6_component_fields(self):
        self.assertIn('data.cards.items: no contract has the name loan-card',
                      catalog.contract_errors(GRID, None, {'loan-grid': GRID}))
        self.assertEqual(catalog.contract_errors(GRID, None, {'loan-grid': GRID, 'loan-card': LOAN}), [])
        loop = changed(GRID, ('data', 'cards', 'items', 'name'), 'loan-grid')
        self.assertIn('data.cards.items: the contract contains itself through loan-grid',
                      catalog.contract_errors(loop, None, {'loan-grid': loop}))

    def test_the_validator_refuses_an_unknown_schema_keyword(self):
        with self.assertRaises(ValueError):
            catalog.schema_errors({}, {'type': 'object', 'format': 'email'})


class FillTest(unittest.TestCase):
    CATALOG = {'loan-card': LOAN, 'loan-grid': GRID}

    def errors(self, fill):
        return catalog.fill_errors(fill, self.CATALOG)

    def test_a_valid_fill_has_no_errors(self):
        self.assertEqual(self.errors(FILL), [])

    def test_an_undeclared_component_is_refused(self):
        self.assertEqual(self.errors(changed(FILL, ('component',), 'banner')),
                         ['component: no contract has the name banner'])

    def test_bad_fills(self):
        cases = [
            (('version',), '0.2.0', 'version: must be 0.1.0'),
            (('data', 'script'), 'x', 'data.script: the contract does not declare this field'),
            (('data', 'title'), KeyError, 'data.title: a required field is missing'),
            (('data', 'title'), 'x' * 81, 'data.title: more than 80 characters'),
            (('data', 'title'), 7, 'data.title: must be a string'),
            (('data', 'due'), '2026-02-30', 'data.due: must be a date as YYYY-MM-DD'),
            (('data', 'due'), '2026-2-3', 'data.due: must be a date as YYYY-MM-DD'),
            (('data', 'renewals'), True, 'data.renewals: must be an integer'),
            (('data', 'renewals'), 1.5, 'data.renewals: must be an integer'),
            (('data', 'renewals'), 9, 'data.renewals: more than the maximum 3'),
            (('data', 'status'), 'lost', 'data.status: must be one of on_loan, late'),
            (('data', 'facts'), ['a', 'b', 'c'], 'data.facts: more than 2 items'),
            (('data', 'facts'), ['a', 5], 'data.facts[1]: must be a string'),
            (('actions', 0, 'action'), 'delete', 'actions[0].action: the contract does not declare this action'),
            (('actions', 0, 'arguments', 'tool'), 'shell', 'actions[0].arguments.tool: the action does not declare this argument'),
            (('actions', 0, 'arguments', 'loan_id'), KeyError, 'actions[0].arguments.loan_id: a required argument is missing'),
            (('actions', 0, 'tool'), 'shell.run', 'actions[0]: unknown key tool'),
            (('style',), 'x', 'style: unknown key'),
        ]
        for path, value, expected in cases:
            with self.subTest(path=path):
                self.assertIn(expected, self.errors(changed(FILL, path, value)))

    def test_markup_in_text_stays_unchanged_data(self):
        for value in ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '&lt;b&gt;']:
            fill = changed(FILL, ('data', 'title'), value)
            before = json.dumps(fill)
            self.assertEqual(self.errors(fill), [])
            self.assertEqual(json.dumps(fill), before)

    def test_nested_component_fills(self):
        grid = {'component': 'loan-grid', 'version': '0.1.0', 'data': {'label': 'Loans', 'cards': [FILL, FILL]}}
        self.assertEqual(self.errors(grid), [])
        wrong = changed(grid, ('data', 'cards', 1, 'component'), 'loan-grid')
        self.assertIn('data.cards[1].component: must be loan-card', self.errors(wrong))
        bad = changed(grid, ('data', 'cards', 0, 'data', 'due'), 'soon')
        self.assertIn('data.cards[0].data.due: must be a date as YYYY-MM-DD', self.errors(bad))

    def test_a_final_newline_does_not_agree_with_a_pattern(self):
        self.assertEqual(self.errors(changed(FILL, ('component',), 'loan-card\n')),
                         ['component: does not agree with the pattern ^[a-z][a-z0-9]*(-[a-z0-9]+)*$'])

    def test_an_integral_float_is_an_integer(self):
        self.assertEqual(self.errors(changed(FILL, ('data', 'renewals'), 2.0)), [])

    def test_a_fill_that_is_not_an_object(self):
        self.assertEqual(self.errors([]), ['(fill): must be an object'])


class CatalogFolderTest(unittest.TestCase):
    def test_load_catalog_reads_each_contract(self):
        with tempfile.TemporaryDirectory() as work:
            folder = Path(work)
            (folder / 'schema').mkdir()
            (folder / 'loan-card.json').write_text(json.dumps(LOAN))
            (folder / 'loan-grid.json').write_text(json.dumps(GRID))
            contracts, errors = catalog.load_catalog(folder)
            self.assertEqual((sorted(contracts), errors), (['loan-card', 'loan-grid'], []))
            (folder / 'broken.json').write_text('{')
            self.assertTrue(catalog.load_catalog(folder)[1][0].startswith('broken.json: not valid JSON'))

    def test_the_project_catalog_is_valid(self):
        self.assertEqual(catalog.load_catalog(catalog.ROOT / 'catalog')[1], [])


if __name__ == '__main__':
    unittest.main()
