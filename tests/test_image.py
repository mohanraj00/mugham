"""The image contract declares data only. Page code owns origins and the text alternative rule."""
import unittest

from test_catalog_contracts import CATALOG, outer
import catalog


DATA = {'url': '/examples/floor-plan.svg', 'alt': 'Two rooms with a door.', 'width': 480, 'height': 320}


class ImageContractTest(unittest.TestCase):
    def errors(self, **change):
        return catalog.fill_errors(outer('image', {**DATA, **change}), CATALOG)

    def test_the_states_and_accessibility_come_from_the_contract(self):
        contract = CATALOG['image']
        self.assertEqual(contract['states'], ['default', 'loading', 'error', 'refused'])
        self.assertEqual(contract['accessibility'], {
            'role': 'group', 'name': {'text': 'Image'},
            'keyboard': ['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape'],
            'forced_colors': True, 'reduced_motion': True})
        self.assertEqual(contract['slots'], {'authorship': {'required': True}})

    def test_the_dimensions_are_bounded_integers(self):
        for key in ['width', 'height']:
            for value, reason in [(0, 'less than the minimum 1'), (4097, 'more than the maximum 4096'),
                                  (1.5, 'must be an integer'), ('480', 'must be an integer')]:
                with self.subTest(key=key, value=value):
                    self.assertEqual(self.errors(**{key: value}), ['data.%s: %s' % (key, reason)])
            for value in [1, 4096]:
                self.assertEqual(self.errors(**{key: value}), [])

    def test_a_fill_cannot_set_origins_or_request_options(self):
        for key in ['allowedOrigins', 'origins', 'srcset', 'referrerpolicy', 'style']:
            self.assertEqual(self.errors(**{key: 'untrusted'}),
                             ['data.%s: the contract does not declare this field' % key])

    def test_the_element_checks_the_conditional_alternative_and_the_url(self):
        # The format cannot compare fields or read page policy. The browser checks these rules.
        self.assertEqual(self.errors(alt='', decorative=True), [])
        self.assertEqual(self.errors(alt=''), [])
        self.assertEqual(self.errors(url='data:image/svg+xml,bad'), [])
        self.assertEqual(self.errors(decorative='true'), ['data.decorative: must be true or false'])
        self.assertEqual(self.errors(caption=''), ['data.caption: fewer than 1 characters'])


if __name__ == '__main__':
    unittest.main()
