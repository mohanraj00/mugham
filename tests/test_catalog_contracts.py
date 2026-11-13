"""Each contract in catalog/ accepts a valid fill and refuses invalid fills. The fills are synthetic."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402

CATALOG, ERRORS = catalog.load_catalog(catalog.ROOT / 'catalog')


def fill(component, data):
    return {'component': component, 'version': '0.1.0', 'data': data}


FACT = fill('fact', {'label': 'Shelf', 'value': 'B-14'})
CARD = fill('card', {'title': 'Field guide to moss', 'date': '2026-12-01', 'date_label': 'Due', 'facts': [FACT, FACT]})
AUTHOR = {'type': 'agent', 'id': 'agent-check'}
CITE = {'source': 'Synthetic loan rules', 'locator': 'https://example.org/rules/loans'}


def outer(name, data):
    """An outer fill. It fills the authorship slot if the contract declares one."""
    result = fill(name, data)
    if 'authorship' in CATALOG[name].get('slots', {}):
        result['slots'] = {'authorship': AUTHOR}
    return result


VALID = {
    'text': {'text': 'Weather at sea', 'variant': 'caption'},
    'button': {'label': 'Renew', 'emphasis': 'secondary', 'disabled': False},
    'field': {'name': 'shelf', 'label': 'Shelf code', 'value': 'B-14', 'hint': 'A letter and a number.'},
    'stack': {'label': 'Loan details', 'direction': 'row', 'gap': 'small'},
    'grid': {'label': 'Reading list', 'min_column': 'wide'},
    'fact': FACT['data'],
    'card': CARD['data'],
    'action-button': {'label': 'Renew', 'description': 'Renew the loan for two weeks.'},
    'editable-form': {'title': 'Loan details', 'submit_label': 'Save', 'fields': [fill('field', {'name': 'shelf', 'label': 'Shelf code'})]},
    'card-grid': {'label': 'Loans', 'cards': [CARD]},
    'citation': {'quote': 'A short loan can get one renewal.'},
}


class CatalogContractTest(unittest.TestCase):
    def test_the_catalog_is_valid_and_complete(self):
        self.assertEqual(ERRORS, [])
        self.assertEqual(sorted(CATALOG), sorted(VALID))

    def test_each_contract_accepts_a_valid_fill(self):
        for name, data in VALID.items():
            with self.subTest(name=name):
                self.assertEqual(catalog.fill_errors(outer(name, data), CATALOG), [])

    def test_each_contract_refuses_an_undeclared_field(self):
        for name, data in VALID.items():
            with self.subTest(name=name):
                self.assertEqual(catalog.fill_errors(outer(name, {**data, 'html': '<b>x</b>'}), CATALOG),
                                 ['data.html: the contract does not declare this field'])

    def test_each_required_field_is_required(self):
        for name, contract in CATALOG.items():
            for key, field in contract['data'].items():
                if not field['required']:
                    continue
                with self.subTest(name=name, field=key):
                    data = {k: v for k, v in VALID[name].items() if k != key}
                    self.assertIn('data.%s: a required field is missing' % key, catalog.fill_errors(outer(name, data), CATALOG))

    def test_each_text_field_has_a_limit(self):
        for name, contract in CATALOG.items():
            for key, field in contract['data'].items():
                if field['type'] != 'text':
                    continue
                with self.subTest(name=name, field=key):
                    data = {**VALID[name], key: 'x' * (field['max_length'] + 1)}
                    self.assertIn('data.%s: more than %d characters' % (key, field['max_length']),
                                  catalog.fill_errors(outer(name, data), CATALOG))

    def test_markup_in_each_text_field_is_accepted_as_text(self):
        for name, contract in CATALOG.items():
            for key, field in contract['data'].items():
                if field['type'] == 'text':
                    with self.subTest(name=name, field=key):
                        value = '<img src=x onerror=alert(1)>'[:field['max_length']]
                        self.assertEqual(catalog.fill_errors(outer(name, {**VALID[name], key: value}), CATALOG), [])

    def test_each_contract_with_ai_content_requires_the_authorship_slot(self):
        for name, contract in CATALOG.items():
            with self.subTest(name=name):
                self.assertEqual(contract.get('slots', {}).get('authorship', {}).get('required', False), contract['ai_content'])
                errors = catalog.fill_errors(fill(name, VALID[name]), CATALOG)
                self.assertEqual(errors, ['slots.authorship: a required slot is missing'] if contract['ai_content'] else [])

    def test_each_slot_accepts_a_filled_value_and_markup_as_text(self):
        markup = '<img src=x onerror=alert(1)>'
        for name, contract in CATALOG.items():
            declared = contract.get('slots', {})
            if not declared:
                continue
            with self.subTest(name=name):
                slots = {'authorship': {**AUTHOR, 'name': markup}, 'citation': {'source': markup, 'locator': CITE['locator'] + '?q=<b>x</b>'}}
                filled = {**fill(name, VALID[name]), 'slots': {key: slots[key] for key in declared}}
                self.assertEqual(catalog.fill_errors(filled, CATALOG), [])

    def test_a_nested_fill_of_a_different_component_is_refused(self):
        self.assertIn('data.cards[0].component: must be card',
                      catalog.fill_errors(fill('card-grid', {'label': 'Loans', 'cards': [FACT]}), CATALOG))

    def test_the_citation_uses_the_locator_rule_of_the_citation_slot(self):
        # The citation component has no locator field of its own. Its source and locator are in the citation slot.
        self.assertNotIn('locator', CATALOG['citation']['data'])
        base = outer('citation', VALID['citation'])
        self.assertEqual(catalog.fill_errors(base, CATALOG), [])
        self.assertEqual(catalog.fill_errors({**base, 'slots': {'authorship': AUTHOR, 'citation': CITE}}, CATALOG), [])
        no_locator = {**base, 'slots': {'authorship': AUTHOR, 'citation': {'source': CITE['source']}}}
        self.assertEqual(catalog.fill_errors(no_locator, CATALOG), ['slots.citation: missing key locator'])
        for locator in ['http://example.org/rules', 'javascript:alert(1)', 'https://person@example.org/rules', 'rules page 4']:
            with self.subTest(locator=locator):
                bad = {**base, 'slots': {'authorship': AUTHOR, 'citation': {**CITE, 'locator': locator}}}
                errors = catalog.fill_errors(bad, CATALOG)
                self.assertEqual(len(errors), 1)
                self.assertTrue(errors[0].startswith('slots.citation.locator: does not agree with the pattern'), errors)

    def test_a_kit_component_declares_no_tool(self):
        # The application binds each tool in code. A fill cannot select one. See catalog/README.md.
        for name, contract in CATALOG.items():
            self.assertNotIn('actions', contract, name)


if __name__ == '__main__':
    unittest.main()
