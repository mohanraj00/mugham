"""The rich text contracts declare a tree of typed nodes. A fill gives data only. All data is synthetic."""
import unittest

from test_catalog_contracts import CATALOG, fill, outer
import catalog

BLOCKS = ['rich-paragraph', 'rich-heading', 'rich-list', 'rich-code', 'rich-quote']
INLINE = ['rich-span', 'rich-link']
NODES = BLOCKS + INLINE
MARKUP = '<img src=x onerror=alert(1)><script>alert(1)</script>'
SPAN = fill('rich-span', {'text': 'Keep the tray dry.'})
LINK = fill('rich-link', {'text': 'Synthetic rules', 'url': 'https://example.org/rules'})
PARAGRAPH = fill('rich-paragraph', {'content': [SPAN, LINK]})


def errors(blocks):
    return catalog.fill_errors(outer('rich-text', {'blocks': blocks}), CATALOG)


class RichTextContractTest(unittest.TestCase):
    def test_the_node_types_are_a_fixed_list(self):
        self.assertEqual(sorted(name for name in CATALOG if name.startswith('rich-') and not CATALOG[name].get('field')), sorted(['rich-text'] + NODES))
        self.assertEqual(CATALOG['rich-text']['data']['blocks']['items']['names'], BLOCKS)
        for name, key in [('rich-paragraph', 'content'), ('rich-heading', 'content')]:
            self.assertEqual(CATALOG[name]['data'][key]['items']['names'], INLINE)
        self.assertEqual(CATALOG['rich-list']['data']['items']['items']['name'], 'rich-paragraph')
        self.assertEqual(CATALOG['rich-quote']['data']['paragraphs']['items']['name'], 'rich-paragraph')

    def test_each_node_declares_only_its_attributes(self):
        declared = {'rich-text': ['blocks', 'clamp'], 'rich-paragraph': ['content'], 'rich-heading': ['level', 'content'],
                    'rich-list': ['ordered', 'items'], 'rich-code': ['text'], 'rich-quote': ['paragraphs'],
                    'rich-span': ['text', 'mark'], 'rich-link': ['text', 'url']}
        for name, keys in declared.items():
            with self.subTest(name=name):
                self.assertEqual(list(CATALOG[name]['data']), keys)

    def test_a_tree_with_each_node_type_is_valid(self):
        blocks = [
            fill('rich-heading', {'level': 1, 'content': [SPAN]}),
            PARAGRAPH,
            fill('rich-list', {'ordered': True, 'items': [PARAGRAPH, PARAGRAPH]}),
            fill('rich-list', {'items': [PARAGRAPH]}),
            fill('rich-code', {'text': 'make check\n'}),
            fill('rich-quote', {'paragraphs': [PARAGRAPH]}),
            fill('rich-paragraph', {'content': [fill('rich-span', {'text': 'x', 'mark': mark}) for mark in ['emphasis', 'strong', 'code']]}),
        ]
        self.assertEqual(errors(blocks), [])
        self.assertEqual(errors([]), [])

    def test_an_unknown_node_type_is_refused(self):
        self.assertEqual(errors([fill('rich-table', {'rows': []})]),
                         ['data.blocks[0].component: must be ' + ' or '.join(BLOCKS)])
        self.assertEqual(errors([SPAN]), ['data.blocks[0].component: must be ' + ' or '.join(BLOCKS)])
        self.assertEqual(errors([fill('rich-paragraph', {'content': [PARAGRAPH]})]),
                         ['data.blocks[0].data.content[0].component: must be rich-span or rich-link'])
        self.assertEqual(errors([fill('rich-paragraph', {'content': [fill('image', {})]})]),
                         ['data.blocks[0].data.content[0].component: must be rich-span or rich-link'])
        self.assertEqual(errors([fill('rich-list', {'items': [SPAN]})]),
                         ['data.blocks[0].data.items[0].component: must be rich-paragraph'])
        self.assertEqual(errors([fill('rich-quote', {'paragraphs': [fill('rich-code', {'text': 'x'})]})]),
                         ['data.blocks[0].data.paragraphs[0].component: must be rich-paragraph'])

    def test_no_node_can_set_a_style_a_class_a_handler_or_an_undeclared_attribute(self):
        valid = {'rich-paragraph': {'content': [SPAN]}, 'rich-heading': {'level': 1, 'content': [SPAN]},
                 'rich-list': {'items': [PARAGRAPH]}, 'rich-code': {'text': 'x'}, 'rich-quote': {'paragraphs': [PARAGRAPH]}}
        for key in ['style', 'class', 'onclick', 'href', 'id', 'html', 'target']:
            for name, data in valid.items():
                with self.subTest(name=name, key=key):
                    self.assertEqual(errors([fill(name, {**data, key: 'x'})]),
                                     ['data.blocks[0].data.%s: the contract does not declare this field' % key])
            for node in [SPAN, LINK]:
                with self.subTest(name=node['component'], key=key):
                    bad = fill(node['component'], {**node['data'], key: 'x'})
                    self.assertEqual(errors([fill('rich-paragraph', {'content': [bad]})]),
                                     ['data.blocks[0].data.content[0].data.%s: the contract does not declare this field' % key])

    def test_a_node_takes_the_slots_of_the_rich_text(self):
        nested = {**PARAGRAPH, 'slots': {'authorship': {'type': 'human', 'id': 'person-1'}}}
        self.assertEqual(errors([nested]), ['data.blocks[0].slots: a nested fill takes the slots of its outer fill'])
        self.assertEqual(catalog.fill_errors(fill('rich-text', {'blocks': [PARAGRAPH]}), CATALOG),
                         ['slots.authorship: a required slot is missing'])

    def test_markup_and_a_script_address_are_text_for_the_validator(self):
        # The validator reads no string as markup. The element refuses a link that the page does not permit.
        blocks = [fill('rich-paragraph', {'content': [fill('rich-span', {'text': MARKUP}),
                                                      fill('rich-link', {'text': MARKUP, 'url': 'javascript:alert(1)'})]}),
                  fill('rich-code', {'text': MARKUP})]
        self.assertEqual(errors(blocks), [])

    def test_the_limits_come_from_the_contracts(self):
        cases = [
            ([PARAGRAPH] * 101, 'data.blocks: more than 100 items'),
            ([fill('rich-paragraph', {'content': [SPAN] * 51})], 'data.blocks[0].data.content: more than 50 items'),
            ([fill('rich-list', {'items': [PARAGRAPH] * 51})], 'data.blocks[0].data.items: more than 50 items'),
            ([fill('rich-quote', {'paragraphs': [PARAGRAPH] * 21})], 'data.blocks[0].data.paragraphs: more than 20 items'),
            ([fill('rich-heading', {'level': 0, 'content': [SPAN]})], 'data.blocks[0].data.level: less than the minimum 1'),
            ([fill('rich-heading', {'level': 4, 'content': [SPAN]})], 'data.blocks[0].data.level: more than the maximum 3'),
            ([fill('rich-heading', {'level': '1', 'content': [SPAN]})], 'data.blocks[0].data.level: must be an integer'),
            ([fill('rich-code', {'text': ''})], 'data.blocks[0].data.text: fewer than 1 characters'),
            ([fill('rich-code', {'text': 'x' * 10001})], 'data.blocks[0].data.text: more than 10000 characters'),
            ([fill('rich-list', {'ordered': 'yes', 'items': [PARAGRAPH]})], 'data.blocks[0].data.ordered: must be true or false'),
            ([fill('rich-paragraph', {'content': [fill('rich-span', {'text': 'x', 'mark': 'underline'})]})],
             'data.blocks[0].data.content[0].data.mark: must be one of emphasis, strong, code'),
            ([fill('rich-paragraph', {'content': [fill('rich-span', {'text': 'x' * 2001})]})],
             'data.blocks[0].data.content[0].data.text: more than 2000 characters'),
            ([fill('rich-paragraph', {'content': [fill('rich-link', {'text': 'x' * 201, 'url': 'https://example.org/'})]})],
             'data.blocks[0].data.content[0].data.text: more than 200 characters'),
            ([fill('rich-paragraph', {'content': [fill('rich-link', {'text': 'x', 'url': 'https://example.org/' + 'x' * 2000})]})],
             'data.blocks[0].data.content[0].data.url: more than 2000 characters'),
        ]
        for blocks, error in cases:
            with self.subTest(error=error):
                self.assertEqual(errors(blocks), [error])
        self.assertEqual(errors([PARAGRAPH] * 100), [])

    def test_the_states_and_the_accessibility_come_from_the_contracts(self):
        self.assertEqual(CATALOG['rich-text']['states'], ['default', 'empty', 'refused'])
        self.assertEqual(CATALOG['rich-text']['accessibility'], {
            'role': 'none', 'keyboard': ['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape'],
            'forced_colors': True, 'reduced_motion': True})
        self.assertEqual(CATALOG['rich-link']['accessibility'], {
            'role': 'button', 'name': {'field': 'text'}, 'keyboard': ['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape'],
            'forced_colors': True, 'reduced_motion': True})
        for name in ['rich-text'] + NODES:
            self.assertTrue(CATALOG[name]['ai_content'], name)


if __name__ == '__main__':
    unittest.main()
