"""Expected fills and limits from catalog/chart.json and catalog/chart-series.json."""
from copy import deepcopy
import unittest

from test_catalog_contracts import CATALOG, VALID, fill, outer
import catalog


class ChartContractTest(unittest.TestCase):
    def test_each_type_and_the_maximum_data_size(self):
        for kind in ['bar', 'line', 'stacked_bar']:
            data = {**VALID['chart'], 'type': kind, 'categories': ['Week'] * 50,
                    'series': [fill('chart-series', {'label': 'Received', 'values': [-10**12, 10**12] * 25})] * 6}
            self.assertEqual(catalog.fill_errors(outer('chart', data), CATALOG), [])

    def test_chart_limits(self):
        for change, error in [({'type': 'pie'}, 'data.type: must be one of bar, line, stacked_bar'),
                              ({'categories': ['Week'] * 51}, 'data.categories: more than 50 items'),
                              ({'categories': ['']}, 'data.categories[0]: fewer than 1 characters'),
                              ({'categories': ['x' * 81]}, 'data.categories[0]: more than 80 characters'),
                              ({'series': VALID['chart']['series'] * 7}, 'data.series: more than 6 items')]:
            self.assertEqual(catalog.fill_errors(outer('chart', {**VALID['chart'], **change}), CATALOG), [error])

    def test_series_limits_and_number_types(self):
        for value in ['12', True, None, float('nan'), float('inf'), -float('inf')]:
            self.assertEqual(catalog.fill_errors(outer('chart-series', {'label': 'Count', 'values': [value]}), CATALOG),
                             ['data.values[0]: must be a number'])
        for values, error in [([0] * 51, 'data.values: more than 50 items'),
                              ([10**12 + 1], 'data.values[0]: more than the maximum 1000000000000'),
                              ([-10**12 - 1], 'data.values[0]: less than the minimum -1000000000000')]:
            self.assertEqual(catalog.fill_errors(outer('chart-series', {'label': 'Count', 'values': values}), CATALOG), [error])
        nested = outer('chart-series', VALID['chart-series'])
        self.assertTrue(catalog.fill_errors(outer('chart', {**VALID['chart'], 'series': [nested]}), CATALOG))

    def test_markup_in_every_label_is_text_data(self):
        data = deepcopy(VALID['chart'])
        markup = '<img src=x onerror=alert(1)>'
        for key in ['title', 'units', 'x_label', 'y_label']:
            data[key] = markup
        data['categories'] = [markup]
        data['series'][0]['data']['label'] = markup
        self.assertEqual(catalog.fill_errors(outer('chart', data), CATALOG), [])

    def test_accessibility_contract(self):
        a11y = CATALOG['chart']['accessibility']
        self.assertEqual(a11y['role'], 'group')
        self.assertEqual(a11y['name'], {'field': 'title'})
        self.assertEqual(a11y['keyboard'], ['Tab', 'Shift+Tab', 'Enter', 'Space',
                                          'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'])
        self.assertTrue(a11y['forced_colors'])
        self.assertTrue(a11y['reduced_motion'])
