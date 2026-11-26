"""The kit source has no markup sink. Data goes only into text nodes, through src/render/dom.js."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SINKS = re.compile(r'innerHTML|outerHTML|insertAdjacentHTML|setHTMLUnsafe|parseHTMLUnsafe|createContextualFragment|'
                   r'document\.write|DOMParser|\beval\s*\(|new\s+Function|srcdoc|\.href\s*=|javascript:|'
                   r'setAttribute\(\s*[\'"]on|\.on[a-z]+\s*=|import\s*\(')


# The editor reads only the body of an inert document. It copies only the data from the allow-list walk.
INERT_PASTE = ('src/primitives/rich-text-field-model.js',
               "return new DOMParser().parseFromString(source, 'text/html').body;")


class SinkTest(unittest.TestCase):
    def test_no_markup_sink_in_src(self):
        found = []
        for path in sorted((ROOT / 'src').rglob('*.js')):
            for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
                if SINKS.search(line) and (path.relative_to(ROOT).as_posix(), line.strip()) != INERT_PASTE:
                    found.append('%s:%d: %s' % (path.relative_to(ROOT), number, line.strip()))
        self.assertEqual(found, [])

    def test_the_pattern_finds_each_sink(self):
        for line in ['a.innerHTML = b', 'x.insertAdjacentHTML(1, 2)', 'eval (s)', 'new Function(s)', 'a.onclick = f',
                     "el.setAttribute('onload', x)", 'link.href = url', 'await import(name)']:
            self.assertTrue(SINKS.search(line), line)


if __name__ == '__main__':
    unittest.main()
