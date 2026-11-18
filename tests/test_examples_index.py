"""The index of the examples and the frame of each example page. The expected results come from issue 99."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / 'examples'
LIST = json.loads((EXAMPLES / 'examples.json').read_text(encoding='utf-8'))
ENTRIES = [(group, example) for group in LIST['groups'] for example in group['examples']]
# The groups that issue 99 names, in the order of the index.
GROUPS = ['Cards and actions', 'Inputs and forms', 'Tables and grids', 'Evidence', 'Chat thread', 'Media', 'Apps', 'Guides']
# These two pages are lists of examples, not examples.
LISTS = {'index.html', 'apps/index.html'}


def file_of(path):
    return EXAMPLES / (path + 'index.html' if path.endswith('/') else path)


class ExamplesIndexTest(unittest.TestCase):
    def test_the_index_has_the_groups_of_the_issue(self):
        self.assertEqual([group['title'] for group in LIST['groups']], GROUPS)
        self.assertEqual(len({group['id'] for group in LIST['groups']}), len(GROUPS))

    def test_each_entry_has_a_name_one_sentence_and_a_link(self):
        for group, example in ENTRIES:
            with self.subTest(example=example['name']):
                self.assertLessEqual(set(example), {'name', 'path', 'text', 'needs', 'components'})
                self.assertRegex(example['name'], r'^[A-Z][A-Za-z ]{2,30}$')
                self.assertRegex(example['text'], r'^[A-Z].{20,140}\.$')
                self.assertTrue(file_of(example['path']).is_file(), example['path'])
                self.assertTrue(example['path'].startswith(group['id'] + '/'), 'an example is in the folder of its group')
        self.assertEqual(len({example['name'] for _, example in ENTRIES}), len(ENTRIES))

    def test_the_index_lists_each_example_page_one_time(self):
        pages = {str(path.relative_to(EXAMPLES)) for path in EXAMPLES.rglob('*.html')} - LISTS
        listed = [str(file_of(example['path']).relative_to(EXAMPLES)) for _, example in ENTRIES]
        self.assertEqual(sorted(listed), sorted(pages))

    def test_no_example_page_is_in_the_root_folder(self):
        self.assertEqual(sorted(path.name for path in EXAMPLES.glob('*.html')), ['index.html'])

    def test_a_fixture_command_names_a_tool_of_the_repository(self):
        for _, example in ENTRIES:
            if 'needs' in example:
                with self.subTest(example=example['name']):
                    match = re.fullmatch(r'python3 (?:-B )?(tools/[a-z_]+\.py)', example['needs'])
                    self.assertIsNotNone(match)
                    self.assertTrue((ROOT / match[1]).is_file())

    def test_each_example_page_loads_the_frame(self):
        for path in sorted(EXAMPLES.rglob('*.html')):
            relative = path.relative_to(EXAMPLES)
            if str(relative) == 'index.html':
                continue
            with self.subTest(page=str(relative)):
                up = '../' * (len(relative.parts) - 1)
                self.assertIn('<script type="module" src="%sframe.js"></script>' % up, path.read_text(encoding='utf-8'))

    def test_the_index_and_the_frame_write_only_text(self):
        for name in ('index.js', 'frame.js'):
            text = (EXAMPLES / name).read_text(encoding='utf-8')
            for sink in ('innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write'):
                self.assertNotIn(sink, text, name)

    def test_the_readme_starts_at_the_index_page(self):
        readme = (ROOT / 'README.md').read_text(encoding='utf-8')
        first = re.search(r'http://localhost:8000/examples/[^`\s]*', readme)
        self.assertEqual(first[0], 'http://localhost:8000/examples/')
        for _, example in ENTRIES:
            if 'needs' not in example and not example['path'].startswith('guides/'):
                with self.subTest(example=example['name']):
                    self.assertIn('examples/' + example['path'], readme)


if __name__ == '__main__':
    unittest.main()
