"""The editor uses a rich text fill as its value."""
import unittest

from test_catalog_contracts import CATALOG
import catalog


class RichTextFieldTest(unittest.TestCase):
    def test_the_value_uses_the_existing_contract(self):
        contract = CATALOG['rich-text-field']
        self.assertTrue(contract['field'])
        self.assertEqual(contract['data']['value']['name'], 'rich-text')
        self.assertEqual(contract['data']['value']['type'], 'component')
        rich = {'component': 'rich-text', 'version': '0.1.0', 'data': {'blocks': []}}
        field = {'component': 'rich-text-field', 'version': '0.1.0',
                 'data': {'label': 'Library note', 'value': rich}}
        self.assertEqual(catalog.fill_errors(field, CATALOG), [])
        field['data']['value'] = '<p>Library note</p>'
        self.assertTrue(catalog.fill_errors(field, CATALOG))
