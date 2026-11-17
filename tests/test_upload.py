"""The upload contract declares the label, the accepted types, the size limit, the file count and the states.
The expected results come from issue #74. All data is synthetic."""
from pathlib import Path
import re
import unittest

from test_catalog_contracts import CATALOG, outer
import catalog

ROOT = Path(__file__).resolve().parents[1]
MARKUP = '<img src=x onerror=alert(1)>'
DATA = {'label': 'Attach receipts', 'help': 'Add the receipts of the ticket.', 'accept': ['application/pdf', '.pdf'],
        'max_size': 2000000, 'max_files': 3}


def errors(**change):
    return catalog.fill_errors(outer('upload', {**DATA, **change}), CATALOG)


class UploadContractTest(unittest.TestCase):
    def test_the_contract_declares_the_label_the_limits_and_the_states(self):
        contract = CATALOG['upload']
        self.assertEqual(list(contract['data']), ['label', 'help', 'accept', 'max_size', 'max_files'])
        self.assertEqual([key for key, field in contract['data'].items() if field['required']], ['label'])
        self.assertEqual(contract['data']['accept']['type'], 'list')
        self.assertEqual(contract['data']['max_size']['type'], 'integer')
        self.assertEqual(contract['data']['max_files']['type'], 'integer')
        self.assertEqual(contract['states'], ['default', 'disabled', 'pending', 'done', 'error', 'refused'])
        self.assertEqual(contract['accessibility']['role'], 'group')
        self.assertEqual(contract['accessibility']['keyboard'], ['Tab', 'Shift+Tab', 'Enter', 'Space'])
        self.assertTrue(contract['accessibility']['forced_colors'])
        self.assertTrue(contract['accessibility']['reduced_motion'])

    def test_an_upload_is_ai_content_with_a_named_author(self):
        self.assertTrue(CATALOG['upload']['ai_content'])
        self.assertTrue(CATALOG['upload']['slots']['authorship']['required'])
        fill = outer('upload', DATA)
        del fill['slots']
        self.assertEqual(catalog.fill_errors(fill, CATALOG), ['slots.authorship: a required slot is missing'])

    def test_a_fill_gives_the_label_and_the_help_text(self):
        self.assertEqual(errors(), [])
        self.assertEqual(catalog.fill_errors(outer('upload', {'label': 'Attach receipts'}), CATALOG), [])
        # Text is data. The element shows it as text, and tests/browser/upload.js checks that.
        self.assertEqual(errors(label=MARKUP, help=MARKUP), [])

    def test_a_fill_cannot_set_a_target(self):
        for key in ['target', 'tool', 'url', 'arguments', 'action', 'files', 'preview']:
            with self.subTest(key=key):
                self.assertEqual(errors(**{key: 'ticket.attach'}), ['data.%s: the contract does not declare this field' % key])

    def test_the_limits_of_a_fill_have_the_type_and_the_range_of_the_contract(self):
        cases = [
            ({'label': ''}, 'data.label: fewer than 1 characters'),
            ({'label': 'x' * 81}, 'data.label: more than 80 characters'),
            ({'help': 'x' * 201}, 'data.help: more than 200 characters'),
            ({'accept': 'application/pdf'}, 'data.accept: must be a list'),
            ({'accept': ['application/pdf'] * 21}, 'data.accept: more than 20 items'),
            ({'accept': ['x']}, 'data.accept[0]: fewer than 2 characters'),
            ({'max_size': 0}, 'data.max_size: less than the minimum 1'),
            ({'max_size': 1000000001}, 'data.max_size: more than the maximum 1000000000'),
            ({'max_size': '2000000'}, 'data.max_size: must be an integer'),
            ({'max_files': 0}, 'data.max_files: less than the minimum 1'),
            ({'max_files': 21}, 'data.max_files: more than the maximum 20'),
            ({'max_files': 1.5}, 'data.max_files: must be an integer'),
        ]
        for change, error in cases:
            with self.subTest(error=error):
                self.assertEqual(errors(**change), [error])


class UploadSourceTest(unittest.TestCase):
    """The kit never reads the content of a file, shows no preview and sends no data."""

    def setUp(self):
        self.source = (ROOT / 'src' / 'components' / 'upload.js').read_text(encoding='utf-8')

    def test_the_control_has_no_call_that_reads_the_content_of_a_file(self):
        for word in ['FileReader', 'arrayBuffer', 'createObjectURL', 'readAs', '.text(', '.stream(', 'file.slice(', '.bytes(', 'createImageBitmap']:
            with self.subTest(word=word):
                self.assertFalse(word in self.source, word)

    def test_the_control_has_no_preview_element(self):
        elements = set(re.findall(r"el\('([a-z0-9]+)'", self.source))
        self.assertEqual(elements, {'div', 'p', 'button', 'input', 'ul', 'li', 'span'})

    def test_the_control_sends_no_data(self):
        for word in ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'FormData', 'import(']:
            with self.subTest(word=word):
                self.assertFalse(word in self.source, word)


if __name__ == '__main__':
    unittest.main()
