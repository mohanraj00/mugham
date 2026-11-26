"""Check warnings for page rules that hide guardrail parts."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from catalog import ROOT, load_catalog  # noqa: E402
from theme_parts import hiding_rules  # noqa: E402


class ThemePartsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contracts, errors = load_catalog(ROOT / 'catalog')
        if errors:
            raise AssertionError(errors)

    def test_warns_for_hidden_guardrails_and_exports(self):
        css = """
          @media (max-width: 40rem) {
            .compact mu-action-button::part(status) { display: none; }
          }
          mu-card-grid.condensed::part(card-status) { visibility: hidden !important; }
          mu-upload::part(reference), mu-form-card::part(note) { opacity: 0; }
          mu-range-field::part(handle-label) { visibility: collapse; }
        """
        self.assertEqual(list(hiding_rules(css, self.contracts)), [
            ('.compact mu-action-button::part(status)', 'status'),
            ('mu-card-grid.condensed::part(card-status)', 'card-status'),
            ('mu-upload::part(reference)', 'reference'),
            ('mu-form-card::part(note)', 'note'),
            ('mu-range-field::part(handle-label)', 'handle-label'),
        ])

    def test_ignores_layout_rules_and_parts_of_other_elements(self):
        css = """
          /* mu-upload::part(reference) { display: none; } */
          mu-card-grid::part(card-title) { display: none; }
          mu-card::part(status) { margin-block: 1rem; opacity: 0.5; }
          seed-tray::part(status) { display: none; }
        """
        self.assertEqual(list(hiding_rules(css, self.contracts)), [])

    def test_checks_a_selector_without_a_type(self):
        css = '.compact::part(status) { DISPLAY: none }'
        self.assertEqual(list(hiding_rules(css, self.contracts)), [('.compact::part(status)', 'status')])
