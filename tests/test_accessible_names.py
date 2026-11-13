"""Each project component with a role gets its accessible name from a fixed text or from a field that cannot be blank.

The expected result comes from principle 7 of the constitution: each component works with a screen reader.
"""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import catalog  # noqa: E402


class AccessibleNameTest(unittest.TestCase):
    def test_the_name_field_is_required_and_not_empty(self):
        contracts, errors = catalog.load_catalog(ROOT / 'catalog')
        self.assertEqual(errors, [])
        self.assertTrue(contracts)
        for name, contract in contracts.items():
            accessibility = contract['accessibility']
            if accessibility['role'] == 'none':
                continue
            with self.subTest(component=name):
                if 'text' in accessibility['name']:
                    self.assertGreaterEqual(len(accessibility['name']['text'].strip()), 1)
                    continue
                field = contract['data'][accessibility['name']['field']]
                self.assertTrue(field['required'])
                self.assertGreaterEqual(field.get('min_length', 0), 1)


if __name__ == '__main__':
    unittest.main()
