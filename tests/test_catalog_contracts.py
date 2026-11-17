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
LINE = fill('form-line', {'line': '2.1', 'field': fill('number-field', {'name': 'adults', 'label': 'Adults', 'value': 2})})
LINE_READ_ONLY = fill('form-line', {'line': '2.3', 'read_only': True,
                                    'field': fill('number-field', {'name': 'household', 'label': 'Household size', 'value': 3})})
SECTION = fill('form-section', {'title': 'Household', 'lines': [LINE, LINE_READ_ONLY]})
CITE = {'source': 'Synthetic loan rules', 'locator': 'https://example.org/rules/loans'}
CHANGE = fill('diff-change', {'label': 'Shelf', 'change': 'changed', 'before': 'B-14', 'after': 'C-02'})
PART = fill('diff-part', {'title': 'Loan', 'changes': [CHANGE]})
SPAN = fill('rich-span', {'text': 'Keep the tray dry.'})
PARAGRAPH = fill('rich-paragraph', {'content': [SPAN]})


def outer(name, data):
    """An outer fill. It fills the authorship slot if the contract declares one."""
    result = fill(name, data)
    slots = CATALOG[name].get('slots', {})
    if 'authorship' in slots:
        result['slots'] = {'authorship': AUTHOR}
    if slots.get('citation', {}).get('required'):
        result['slots']['citation'] = CITE
    return result


VALID = {
    'text': {'text': 'Weather at sea', 'variant': 'caption'},
    'button': {'label': 'Renew', 'emphasis': 'secondary', 'disabled': False},
    'field': {'name': 'shelf', 'label': 'Shelf code', 'value': 'B-14', 'hint': 'A letter and a number.'},
    'long-text-field': {'name': 'note', 'label': 'Note', 'value': 'Keep dry.\nNo sun.', 'hint': 'Two lines at most.'},
    'number-field': {'name': 'copies', 'label': 'Copies', 'value': 3, 'minimum': 1, 'maximum': 12, 'typed': True},
    'date-field': {'name': 'due', 'label': 'Due date', 'value': '2026-12-01', 'earliest': '2026-11-01', 'latest': '2027-02-28'},
    'choice-field': {'name': 'branch', 'label': 'Branch', 'value': 'North', 'choices': ['North', 'South', 'Harbor']},
    'stack': {'label': 'Loan details', 'direction': 'row', 'gap': 'small'},
    'grid': {'label': 'Reading list', 'min_column': 'wide'},
    'fact': FACT['data'],
    'card': CARD['data'],
    'action-button': {'label': 'Renew', 'description': 'Renew the loan for two weeks.'},
    'editable-form': {'title': 'Loan details', 'submit_label': 'Save', 'fields': [fill('field', {'name': 'shelf', 'label': 'Shelf code'})]},
    'card-grid': {'label': 'Loans', 'cards': [CARD]},
    'form-line': {'line': '2.1', 'field': fill('number-field', {'name': 'adults', 'label': 'Adults', 'value': 2})},
    'form-section': {'title': 'Household', 'lines': [LINE, LINE_READ_ONLY]},
    'form-card': {'title': 'Membership form', 'submit_label': 'Send changes', 'sections': [SECTION]},
    'citation': {'quote': 'A short loan can get one renewal.'},
    'source-status': {'label': 'Tool library', 'state': 'stale', 'checked': '2026-11-15T09:30:00.000Z', 'reason': 'The device is offline.'},
    'excerpt': {'passage': 'A short loan can get one renewal of seven days.', 'span_start': 13, 'span_end': 32},
    'diff-change': CHANGE['data'],
    'diff-part': PART['data'],
    'diff': {'title': 'Loan rules, version 3 to version 4', 'before_label': 'Version 3', 'after_label': 'Version 4', 'parts': [PART]},
    'table': {'label': 'Sample rows', 'columns': ['Name'], 'rows': [fill('table-row', {'cells': ['Plot A']})]},
    'table-row': {'cells': ['Plot A'], 'status': 'Ready'},
    'status': {'state': 'pending', 'text': 'Synthetic check A.'},
    'image': {'url': '/examples/floor-plan.svg', 'alt': 'Two rooms with a door.', 'width': 480, 'height': 320},
    'chart': {'title': 'Weekly tickets', 'type': 'bar', 'categories': ['Week 1'], 'series': [fill('chart-series', {'label': 'Received', 'values': [12]})], 'units': 'tickets', 'x_label': 'Week', 'y_label': 'Count'},
    'chart-series': {'label': 'Received', 'values': [12]},
    'rich-text': {'blocks': [PARAGRAPH]},
    'rich-paragraph': PARAGRAPH['data'],
    'rich-heading': {'level': 1, 'content': [SPAN]},
    'rich-list': {'ordered': True, 'items': [PARAGRAPH]},
    'rich-code': {'text': 'make check'},
    'rich-quote': {'paragraphs': [PARAGRAPH]},
    'rich-span': {'text': 'Keep the tray dry.', 'mark': 'strong'},
    'rich-link': {'text': 'Synthetic rules', 'url': 'https://example.org/rules'},
    'upload': {'label': 'Attach receipts', 'help': 'Add the receipts of the ticket.', 'accept': ['application/pdf', '.pdf'],
               'max_size': 2000000, 'max_files': 3},
}


class CatalogContractTest(unittest.TestCase):
    def test_a_form_accepts_each_input_type_and_no_other_component(self):
        inputs = ['field', 'long-text-field', 'number-field', 'date-field', 'choice-field']
        form = {'title': 'Loan details', 'submit_label': 'Save', 'fields': [fill(name, VALID[name]) for name in inputs]}
        self.assertEqual(catalog.fill_errors(outer('editable-form', form), CATALOG), [])
        other = {**form, 'fields': [fill('button', VALID['button'])]}
        self.assertEqual(catalog.fill_errors(outer('editable-form', other), CATALOG),
                         ['data.fields[0].component: must be ' + ' or '.join(inputs)])

    def test_a_form_card_permits_more_than_20_fields(self):
        lines = [fill('form-line', {'field': fill('field', {'name': 'line_%d' % i, 'label': 'Line %d' % i})}) for i in range(25)]
        sections = [fill('form-section', {'title': 'Part %d' % i, 'lines': lines[i * 9:(i + 1) * 9]}) for i in range(3)]
        card = {'title': 'Membership form', 'submit_label': 'Send changes', 'sections': sections}
        self.assertEqual(catalog.fill_errors(outer('form-card', card), CATALOG), [])

    def test_a_form_line_accepts_only_the_input_types(self):
        line = {'field': fill('button', VALID['button'])}
        self.assertEqual(catalog.fill_errors(outer('form-line', line), CATALOG),
                         ['data.field.component: must be field or long-text-field or number-field or date-field or choice-field'])

    def test_a_number_and_a_date_field_refuse_a_value_of_a_different_type(self):
        self.assertIn('data.value: must be a number',
                      catalog.fill_errors(fill('number-field', {**VALID['number-field'], 'value': '3'}), CATALOG))
        self.assertIn('data.value: must be a date as YYYY-MM-DD',
                      catalog.fill_errors(fill('date-field', {**VALID['date-field'], 'value': '2026-02-30'}), CATALOG))

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
                self.assertEqual(errors[:1], ['slots.authorship: a required slot is missing'] if contract['ai_content'] else [])

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

    def test_the_excerpt_requires_the_citation_slot_and_its_locator_rule(self):
        # The excerpt has no locator field of its own. The citation slot gives the source and the locator.
        self.assertNotIn('locator', CATALOG['excerpt']['data'])
        base = outer('excerpt', VALID['excerpt'])
        self.assertEqual(catalog.fill_errors(base, CATALOG), [])
        self.assertEqual(catalog.fill_errors({**base, 'slots': {'authorship': AUTHOR}}, CATALOG),
                         ['slots.citation: a required slot is missing'])
        bad = {**base, 'slots': {'authorship': AUTHOR, 'citation': {**CITE, 'locator': 'http://example.org/rules'}}}
        errors = catalog.fill_errors(bad, CATALOG)
        self.assertEqual(len(errors), 1)
        self.assertTrue(errors[0].startswith('slots.citation.locator: does not agree with the pattern'), errors)

    def test_the_excerpt_span_positions_are_integers_in_the_limits(self):
        base = outer('excerpt', VALID['excerpt'])
        cases = [
            ({'span_start': -1}, 'data.span_start: less than the minimum 0'),
            ({'span_end': 0}, 'data.span_end: less than the minimum 1'),
            ({'span_end': 2001}, 'data.span_end: more than the maximum 2000'),
            ({'span_start': 1.5}, 'data.span_start: must be an integer'),
            ({'span_end': '9'}, 'data.span_end: must be an integer'),
            ({'passage': ''}, 'data.passage: fewer than 1 characters'),
        ]
        for change, error in cases:
            with self.subTest(change=change):
                self.assertEqual(catalog.fill_errors({**base, 'data': {**base['data'], **change}}, CATALOG), [error])

    def test_the_source_status_has_the_four_states_of_the_interface(self):
        # docs/contracts/data-source.md: ready, stale, empty and error.
        self.assertEqual(CATALOG['source-status']['data']['state']['values'], ['ready', 'stale', 'empty', 'error'])
        self.assertFalse(CATALOG['source-status']['ai_content'])
        self.assertEqual(catalog.fill_errors(fill('source-status', {'label': 'Tool library', 'state': 'offline'}), CATALOG),
                         ['data.state: must be one of ready, stale, empty, error'])

    def test_a_diff_has_up_to_20_parts_of_200_changes(self):
        large = fill('diff-part', {'title': 'Loan', 'changes': [CHANGE] * 200})
        base = outer('diff', VALID['diff'])
        self.assertEqual(catalog.fill_errors({**base, 'data': {**base['data'], 'parts': [large] * 20}}, CATALOG), [])
        cases = [
            ({'parts': [PART] * 21}, 'data.parts: more than 20 items'),
            ({'parts': [fill('diff-part', {'title': 'Loan', 'changes': [CHANGE] * 201})]}, 'data.parts[0].data.changes: more than 200 items'),
            ({'parts': [CHANGE]}, 'data.parts[0].component: must be diff-part'),
        ]
        for change, error in cases:
            with self.subTest(error=error):
                self.assertEqual(catalog.fill_errors({**base, 'data': {**base['data'], **change}}, CATALOG), [error])

    def test_a_diff_change_has_one_of_four_kinds(self):
        for kind in ('added', 'removed', 'changed', 'unchanged'):
            with self.subTest(kind=kind):
                self.assertEqual(catalog.fill_errors(fill('diff-change', {'label': 'Shelf', 'change': kind}), CATALOG), [])
        self.assertEqual(catalog.fill_errors(fill('diff-change', {'label': 'Shelf', 'change': 'moved'}), CATALOG),
                         ['data.change: must be one of added, removed, changed, unchanged'])

    def test_a_kit_component_declares_no_tool(self):
        # The application binds each tool in code. A fill cannot select one. See catalog/README.md.
        for name, contract in CATALOG.items():
            self.assertNotIn('actions', contract, name)


if __name__ == '__main__':
    unittest.main()
