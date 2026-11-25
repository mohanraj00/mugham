"""The data grid contracts declare the columns, the rows and the typed cells. All data is synthetic."""
import unittest

from test_catalog_contracts import CATALOG, fill, outer
import catalog

CELLS = ['text-cell', 'number-cell', 'date-cell', 'choice-cell']
MARKUP = '<img src=x onerror=alert(1)>'
COLUMNS = [
    fill('data-grid-column', {'key': 'kind', 'label': 'Kind', 'type': 'choice', 'choices': ['Fixed', 'Variable']}),
    fill('data-grid-column', {'key': 'jan', 'label': 'January', 'type': 'number'}),
    fill('data-grid-column', {'key': 'due', 'label': 'Due date', 'type': 'date'}),
    fill('data-grid-column', {'key': 'note', 'label': 'Note', 'type': 'text', 'read_only': True}),
]


def row(*cells):
    return fill('data-grid-row', {'key': 'rent', 'label': 'Rent', 'cells': list(cells)})


ROW = row(fill('choice-cell', {'value': 'Fixed'}), fill('number-cell', {'value': 900}),
          fill('date-cell', {'value': '2026-12-01'}), fill('text-cell', {'value': 'Paid by transfer', 'read_only': True}))


def errors(**change):
    return catalog.fill_errors(outer('data-grid', {'label': 'Synthetic budget', 'columns': COLUMNS, 'rows': [ROW], **change}), CATALOG)


class DataGridContractTest(unittest.TestCase):
    def test_the_contract_declares_the_columns_the_rows_and_the_cells(self):
        self.assertEqual(list(CATALOG['data-grid']['data']), ['label', 'columns', 'rows'])
        self.assertEqual(list(CATALOG['data-grid-column']['data']), ['key', 'label', 'type', 'read_only', 'choices'])
        self.assertEqual(CATALOG['data-grid-column']['data']['type']['values'], ['text', 'number', 'date', 'choice'])
        self.assertEqual(list(CATALOG['data-grid-row']['data']), ['key', 'label', 'cells'])
        self.assertEqual(CATALOG['data-grid-row']['data']['cells']['items']['names'], CELLS)
        for name, kind in zip(CELLS, ['text', 'number', 'date', 'text']):
            with self.subTest(name=name):
                self.assertEqual(list(CATALOG[name]['data']), ['value', 'read_only'])
                self.assertEqual(CATALOG[name]['data']['value']['type'], kind)
                self.assertFalse(CATALOG[name]['data']['value']['required'])
                self.assertEqual(CATALOG[name]['data']['read_only']['type'], 'boolean')

    def test_a_grid_with_each_cell_type_is_valid(self):
        self.assertEqual(errors(), [])
        empty = row(fill('choice-cell', {}), fill('number-cell', {}), fill('date-cell', {}), fill('text-cell', {'value': ''}))
        self.assertEqual(errors(rows=[empty]), [])
        self.assertEqual(errors(rows=[]), [])

    def test_a_cell_value_has_the_type_of_its_contract(self):
        cases = [
            (fill('number-cell', {'value': '900'}), 'data.rows[0].data.cells[1].data.value: must be a number'),
            (fill('number-cell', {'value': True}), 'data.rows[0].data.cells[1].data.value: must be a number'),
            (fill('date-cell', {'value': '2026-02-30'}), 'data.rows[0].data.cells[1].data.value: must be a date as YYYY-MM-DD'),
            (fill('text-cell', {'value': 900}), 'data.rows[0].data.cells[1].data.value: must be a string'),
            (fill('text-cell', {'value': 'x' * 501}), 'data.rows[0].data.cells[1].data.value: more than 500 characters'),
            (fill('choice-cell', {'value': ''}), 'data.rows[0].data.cells[1].data.value: fewer than 1 characters'),
            (fill('number-cell', {'value': 900, 'read_only': 'yes'}), 'data.rows[0].data.cells[1].data.read_only: must be true or false'),
            (fill('number-cell', {'value': 900, 'formula': '=A1'}), 'data.rows[0].data.cells[1].data.formula: the contract does not declare this field'),
            (fill('button', {'label': 'x'}), 'data.rows[0].data.cells[1].component: must be ' + ' or '.join(CELLS)),
        ]
        for cell, error in cases:
            with self.subTest(error=error):
                self.assertEqual(errors(rows=[row(ROW['data']['cells'][0], cell)]), [error])

    def test_the_limits_come_from_the_contracts(self):
        column = COLUMNS[1]
        cases = [
            ({'columns': [column] * 31}, 'data.columns: more than 30 items'),
            ({'rows': [ROW] * 201}, 'data.rows: more than 200 items'),
            ({'rows': [row(*[fill('number-cell', {})] * 31)]}, 'data.rows[0].data.cells: more than 30 items'),
            ({'label': ''}, 'data.label: fewer than 1 characters'),
            ({'columns': [fill('data-grid-column', {'key': 'x', 'label': 'X', 'type': 'formula'})]},
             'data.columns[0].data.type: must be one of text, number, date, choice'),
            ({'columns': [fill('data-grid-column', {'key': 'x', 'label': 'X', 'type': 'choice', 'choices': ['a'] * 21})]},
             'data.columns[0].data.choices: more than 20 items'),
            ({'columns': [fill('data-grid-column', {'key': '', 'label': 'X', 'type': 'text'})]}, 'data.columns[0].data.key: fewer than 1 characters'),
            ({'columns': [ROW]}, 'data.columns[0].component: must be data-grid-column'),
            ({'rows': [column]}, 'data.rows[0].component: must be data-grid-row'),
        ]
        for change, error in cases:
            with self.subTest(error=error):
                self.assertEqual(errors(**change), [error])
        # 50 rows and 12 columns are in the limits.
        months = [fill('data-grid-column', {'key': 'm%d' % i, 'label': 'Month %d' % i, 'type': 'number'}) for i in range(12)]
        rows = [fill('data-grid-row', {'key': 'r%d' % i, 'label': 'Line %d' % i, 'cells': [fill('number-cell', {'value': i})] * 12}) for i in range(50)]
        self.assertEqual(errors(columns=months, rows=rows), [])

    def test_markup_in_each_header_and_cell_is_text_for_the_validator(self):
        columns = [fill('data-grid-column', {'key': 'a', 'label': MARKUP, 'type': 'text'}),
                   fill('data-grid-column', {'key': 'b', 'label': MARKUP, 'type': 'choice', 'choices': [MARKUP]})]
        rows = [fill('data-grid-row', {'key': 'r', 'label': MARKUP, 'cells': [fill('text-cell', {'value': MARKUP}), fill('choice-cell', {'value': MARKUP})]})]
        self.assertEqual(errors(label=MARKUP, columns=columns, rows=rows), [])

    def test_a_fill_names_no_tool_and_no_formula(self):
        for key in ['tool', 'action', 'formula', 'editable']:
            with self.subTest(key=key):
                self.assertEqual(errors(**{key: 'x'}), ['data.%s: the contract does not declare this field' % key])

    def test_the_element_checks_the_rules_between_the_fields(self):
        # The format cannot compare a cell with its column. tests/browser/data-grid.js checks these rules.
        self.assertEqual(errors(rows=[row(fill('number-cell', {'value': 1}))]), [])
        self.assertEqual(errors(columns=[COLUMNS[1], COLUMNS[1]]), [])

    def test_the_states_and_the_accessibility_come_from_the_contract(self):
        self.assertEqual(CATALOG['data-grid']['states'], ['default', 'empty', 'disabled', 'pending', 'error', 'refused'])
        self.assertEqual(CATALOG['data-grid']['accessibility'], {
            'role': 'group', 'name': {'field': 'label'},
            'keyboard': ['Tab', 'Shift+Tab', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Space'],
            'forced_colors': True, 'reduced_motion': True})


if __name__ == '__main__':
    unittest.main()
