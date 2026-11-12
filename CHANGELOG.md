# Changelog

Each release has an entry. The newest entry is first.

## Unreleased

- The citation component `mu-citation` (#28). It shows the source name, the locator as text, an optional quote and an `Open source` button. The source and the locator come from the citation slot, so the locator rule of the slot applies. A citation with no slot shows the `empty` state. A missing locator or a locator that is not a safe `https:` address gives a refusal with a clear reason. `examples/citation.html` shows a citation in a message. A base element can now give a refusal reason for a person with `refusal(errors)`. The `mu-refused` event still gives all errors.
- Contract format 2 gets the authorship slot and the citation slot (#33). A contract declares each slot, and each slot can be required. A fill gives the slots in its `slots` key. The validator refuses a fill that leaves a required slot empty. The kit shows each filled slot as text. A locator is an `https:` address, and it opens only after a person clicks `Open source`. Only the outer fill has slots. Format 2 is not released, so the format number stays `2`.
- The flag `ai_content` now has an effect. A contract with `ai_content` set to `true` must declare a required authorship slot. Thus the fills of `card`, `card-grid`, `editable-form` and `fact` must name the actor that wrote the content. A fill of these components with no `slots.authorship` is refused.
- Each element gets an `actor` property (#33). The application or the thread sets it to the trusted actor of the content. An element refuses a fill whose authorship slot has no bound actor, or names a different actor. Thus a model cannot show its content as the content of a person.
- The example page `examples/provenance.html` shows a card with the two slots, and a card that the kit refuses because its authorship slot is empty.
- The message envelope, version 1, in `docs/contracts/`. It maps AG-UI 1.0, as decision 0002 says. `src/envelope/envelope.js` reads an envelope and an AG-UI stream. Each message has an actor, typed parts and an honest state. `tests/vectors/envelope/` has the conformance cases. `generate.py` in that folder writes them, and `tests/test_envelope_vectors.py` compares them with its output.
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
