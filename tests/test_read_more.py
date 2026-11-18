"""The clamp limits come from the three text contracts. All data is synthetic."""
import unittest

from test_catalog_contracts import CATALOG, outer
import catalog


class ReadMoreContractTest(unittest.TestCase):
    def test_clamp_is_optional_and_has_a_small_integer_limit(self):
        cases = {'text': {'text': 'A short note.'},
                 'excerpt': {'passage': 'A short note.', 'span_start': 0, 'span_end': 1},
                 'rich-text': {'blocks': []}}
        for name, data in cases.items():
            with self.subTest(name=name):
                self.assertEqual(CATALOG[name]['data']['clamp'], {
                    'type': 'integer', 'label': 'Initial lines', 'required': False, 'minimum': 1, 'maximum': 20})
                self.assertEqual(catalog.fill_errors(outer(name, data), CATALOG), [])
                for value in [1, 3, 20]:
                    self.assertEqual(catalog.fill_errors(outer(name, {**data, 'clamp': value}), CATALOG), [])
                for value, reason in [(0, 'less than the minimum 1'), (-1, 'less than the minimum 1'),
                                      (21, 'more than the maximum 20'), (1.5, 'must be an integer'),
                                      ('3', 'must be an integer'), (None, 'must be an integer'), (True, 'must be an integer')]:
                    self.assertEqual(catalog.fill_errors(outer(name, {**data, 'clamp': value}), CATALOG),
                                     ['data.clamp: ' + reason])
                self.assertTrue(catalog.fill_errors(outer(name, {**data, 'read_more_label': 'Other'}), CATALOG))
