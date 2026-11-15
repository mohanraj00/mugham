"""The status contract accepts four states and short text. All data is synthetic."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import catalog  # noqa: E402

CATALOG, ERRORS = catalog.load_catalog(catalog.ROOT / 'catalog')
AUTHOR = {'type': 'agent', 'id': 'agent-check'}


def fill(data):
    return {'component': 'status', 'version': '0.1.0', 'data': data, 'slots': {'authorship': AUTHOR}}


class StatusContractTest(unittest.TestCase):
    def test_each_declared_state_is_valid(self):
        self.assertEqual(ERRORS, [])
        self.assertEqual(CATALOG['status']['data']['state']['values'], ['pending', 'passed', 'failed', 'unknown'])
        for state in ['pending', 'passed', 'failed', 'unknown']:
            with self.subTest(state=state):
                self.assertEqual(catalog.fill_errors(fill({'state': state, 'text': 'Synthetic check A.'}), CATALOG), [])

    def test_an_undeclared_state_is_refused(self):
        for state in ['complete', 'Passed', '', '<b>passed</b>', None, 1, True, {}]:
            with self.subTest(state=state):
                self.assertEqual(catalog.fill_errors(fill({'state': state, 'text': 'Synthetic check A.'}), CATALOG),
                                 ['data.state: must be one of pending, passed, failed, unknown'])

    def test_the_text_limits_count_code_points(self):
        for text in ['A', 'A' * 200, '𝔸' * 200, '<img src=x onerror=alert(1)>']:
            with self.subTest(text=text):
                self.assertEqual(catalog.fill_errors(fill({'state': 'pending', 'text': text}), CATALOG), [])
        for text, error in [('', 'fewer than 1 characters'), ('𝔸' * 201, 'more than 200 characters'),
                            (7, 'must be a string')]:
            with self.subTest(text=text):
                self.assertEqual(catalog.fill_errors(fill({'state': 'pending', 'text': text}), CATALOG),
                                 ['data.text: ' + error])

    def test_the_contract_declares_a_name_and_media_support(self):
        self.assertEqual(CATALOG['status']['accessibility'], {
            'role': 'group', 'name': {'field': 'text'}, 'keyboard': [],
            'forced_colors': True, 'reduced_motion': True,
        })


if __name__ == '__main__':
    unittest.main()
