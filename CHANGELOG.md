# Changelog

Each release has an entry. The newest entry is first.

## Unreleased

- The governance files and the project standard.
- Decision 0001: no third-party build or test tool for v0.1, and the dependency rule.
- `tools/build.py` makes a byte-identical package. `make check` and CI build two times and compare the bytes.
- Contract format 1 in `catalog/schema/`, and `tools/catalog.py`. The tool validates each contract and each fill.
- The design tokens, with a light value and a dark value for each token. The primitives `mu-text`, `mu-button`, `mu-field`, `mu-stack` and `mu-grid`, each with a contract. A headless Chrome check for forced colors, reduced motion, the accessibility tree and the keyboard.
- The kit tokens take their values from the brand tokens in `docs/brand/tokens.json`. A test compares the two files.
