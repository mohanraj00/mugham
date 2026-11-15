"""Expected fills and limits from catalog/table.json and catalog/table-row.json."""
from copy import deepcopy
import unittest

from test_catalog_contracts import CATALOG, fill, outer
import catalog


ROW = fill('table-row', {'cells': ['Plot A', 'North'], 'status': 'Ready'})
DATA = {'label': 'Sample rows', 'columns': ['Name', 'Area'], 'rows': [ROW],
        'status_values': ['Ready', 'Waiting'], 'sort_key': 0, 'sort_direction': 'ascending'}


class TableContractTest(unittest.TestCase):
    def test_default_empty_and_optional_fields(self):
        for data in [DATA, {**DATA, 'rows': []},
                     {'label': 'Sample rows', 'columns': ['Name'], 'rows': [fill('table-row', {'cells': ['']})]}]:
            self.assertEqual(catalog.fill_errors(outer('table', data), CATALOG), [])
        self.assertEqual(CATALOG['table']['states'], ['default', 'empty', 'refused'])

    def test_limits_and_types(self):
        cases = [({'columns': ['Name'] * 13}, 'data.columns: more than 12 items'),
                 ({'columns': ['']}, 'data.columns[0]: fewer than 1 characters'),
                 ({'columns': ['x' * 81]}, 'data.columns[0]: more than 80 characters'),
                 ({'rows': [ROW] * 501}, 'data.rows: more than 500 items'),
                 ({'sort_key': -1}, 'data.sort_key: less than the minimum 0'),
                 ({'sort_key': 12}, 'data.sort_key: more than the maximum 11'),
                 ({'sort_key': 0.5}, 'data.sort_key: must be an integer'),
                 ({'status_values': ['x'] * 21}, 'data.status_values: more than 20 items')]
        for change, error in cases:
            with self.subTest(change=change):
                self.assertEqual(catalog.fill_errors(outer('table', {**DATA, **change}), CATALOG), [error])

    def test_row_limits_and_nested_slots(self):
        for data, error in [({'cells': ['x'] * 13}, 'data.cells: more than 12 items'),
                            ({'cells': ['x' * 501]}, 'data.cells[0]: more than 500 characters'),
                            ({'cells': [1]}, 'data.cells[0]: must be a string'),
                            ({'cells': ['x'], 'status': ''}, 'data.status: fewer than 1 characters'),
                            ({'cells': ['x'], 'status': 'x' * 81}, 'data.status: more than 80 characters')]:
            self.assertEqual(catalog.fill_errors(outer('table-row', data), CATALOG), [error])
        row = outer('table-row', ROW['data'])
        self.assertTrue(catalog.fill_errors(outer('table', {**DATA, 'rows': [row]}), CATALOG))

    def test_markup_in_every_cell_header_and_status_is_text_data(self):
        markup = '<img src=x onerror=alert(1)><script>x</script>'
        data = deepcopy(DATA)
        data['columns'] = [markup, markup]
        data['rows'] = [fill('table-row', {'cells': [markup, markup], 'status': markup})]
        data['status_values'] = [markup]
        self.assertEqual(catalog.fill_errors(outer('table', data), CATALOG), [])

    def test_accessibility_contract(self):
        a11y = CATALOG['table']['accessibility']
        self.assertEqual(a11y['role'], 'group')
        self.assertEqual(a11y['name'], {'field': 'label'})
        self.assertEqual(a11y['keyboard'], ['Tab', 'Shift+Tab', 'Enter', 'Space'])
        self.assertTrue(a11y['forced_colors'])
        self.assertTrue(a11y['reduced_motion'])
