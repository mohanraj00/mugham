"""The Python validator gives the expected errors for each shared case in tests/vectors/fills.json."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402

VECTORS = json.loads((Path(__file__).parent / 'vectors' / 'fills.json').read_text(encoding='utf-8'))


class VectorTest(unittest.TestCase):
    def test_each_contract_of_the_vectors_is_valid(self):
        for name, contract in VECTORS['catalog'].items():
            self.assertEqual(catalog.contract_errors(contract, name + '.json', VECTORS['catalog']), [], name)

    def test_each_case(self):
        for case in VECTORS['cases']:
            with self.subTest(case=case['name']):
                self.assertEqual(catalog.fill_errors(case['fill'], VECTORS['catalog']), case['errors'])


if __name__ == '__main__':
    unittest.main()
