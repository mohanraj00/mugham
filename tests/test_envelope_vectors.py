"""The committed envelope vectors agree with tests/vectors/envelope/generate.py.

A hand edit of envelopes.json or streams.json without a change to the generator fails this test.
"""
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parent / 'vectors' / 'envelope'
sys.path.insert(0, str(HERE))
import generate  # noqa: E402


class EnvelopeVectorsTest(unittest.TestCase):
    def test_the_committed_files_are_the_output_of_the_generator(self):
        for name, text in generate.files().items():
            with self.subTest(file=name):
                self.assertEqual((HERE / name).read_text(encoding='utf-8'), text,
                                 f'{name} does not agree with generate.py. Run it with --write.')


if __name__ == '__main__':
    unittest.main()
