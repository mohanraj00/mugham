# Changelog

Each release has an entry. The newest entry is first.

## Unreleased

- The message envelope, version 1, in `docs/contracts/`. It maps AG-UI 1.0, as decision 0002 says. `src/envelope/envelope.js` reads an envelope and an AG-UI stream. Each message has an actor, typed parts and an honest state. `tests/vectors/envelope/` has the conformance cases.
- Contract format 2. Format 1 had an `actions` block in a contract and an `actions` list in a fill, but they had no effect. Format 2 removes them. Each contract now has `"format": 2`. A fill with an `actions` key is refused. The application binds each action in code, as `catalog/README.md` says.
- An action binding can have a confirm step: `confirm: { message, label }`. `mu-action-button` and `mu-editable-form` then show the step, with the new state `confirm`. They send the action only after a person confirms. Cancel and Escape send no action.
- A receipt can carry a `reference`, for example a record id. The element shows it as text, with 80 characters maximum. A receipt with a longer reference is refused.
- `catalog/README.md` is the one description of the action model. `catalog/schema/README.md` and decision 0002 refer to it.
- A release workflow attaches `mugham.tar` and a SHA-256 file to a GitHub release. It publishes no package. [Decision 0004](docs/decisions/0004-package.md) gives the package choice.
- The README has a quickstart, the minimum browser versions and a stability statement.
- The README is for people. It lists each catalog component, and it shows the highlights of the kit in screenshots for the light theme and the dark theme. Agents and LLMs go to the constitution and `AGENTS.md`.
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
