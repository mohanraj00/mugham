# Changelog

Each release has an entry. The newest entry is first.

## Unreleased

- The README is for people. It lists each catalog component, with screenshots in the light theme and the dark theme. Agents and LLMs go to the constitution and `AGENTS.md`.
- `make screenshots` writes the README screenshots to `docs/screenshots/` from a fixture page with synthetic data.
- Fix: an action button with no description showed the text `null`.

## 0.1.0

- The governance files and the project standard.
- Decision 0001: no third-party build or test tool for v0.1, and the dependency rule.
- `tools/build.py` makes a byte-identical package. `make check` and CI build two times and compare the bytes.
- Contract format 1 in `catalog/schema/`, and `tools/catalog.py`. The tool validates each contract and each fill.
- The design tokens, with a light value and a dark value for each token. The primitives `mu-text`, `mu-button`, `mu-field`, `mu-stack` and `mu-grid`, each with a contract. A headless Chrome check for forced colors, reduced motion, the accessibility tree and the keyboard.
- The catalog components `mu-card`, `mu-action-button`, `mu-editable-form` and `mu-card-grid`. An action shows as done only after its receipt comes back.
- The kit tokens take their values from the brand tokens in `docs/brand/tokens.json`. A test compares the two files.
