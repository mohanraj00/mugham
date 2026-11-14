# Changelog

Each release has an entry. The newest entry is first.

## Unreleased

## 0.2.1, 2026-11-14

- Four guides in `docs/guides/` (#63): contracts, page assembly, theming and coding agents. Each code block of a guide is an exact part of a checked file in `examples/guides/` or `catalog/`. The theming guide shows a second theme, `forest`. `tests/test_guides.py` and `tests/browser/guides.mjs` check the guides, and `tools/browser_check.mjs` runs the browser check in the four media modes. The README and `src/README.md` link the guides.
- The thread example server `tools/thread_server.py` handles a busy port (#64). If the default port is in use, it takes a free port and prints its URL. If a port that the user gives with `--port` is in use, it prints one line and exits with code 1. The quickstart gives the advice for a busy port.
- Three complete example apps in `examples/apps/` (#67): a support desk, a change review and a field inspection. They use one fixture API, `tools/apps_server.py`, with the Python standard library only. It binds to `127.0.0.1` and takes a free port if port 8770 is in use. `tests/test_apps_server.py` and `tests/browser/apps.mjs` check the API and the main flow of each app. The README lists each app in the quickstart.
- The README leads with UIs that a coding agent or a model builds from declared components (#65). It has a section for coding agents. One image sequence of `examples/thread.html` replaces the screenshot gallery. `make screenshots` makes the four frames in the light theme and the dark theme from the example and its synthetic data. The gallery fixture `tests/browser/gallery.html` is removed.

## 0.2.0, 2026-11-13

- The registration of an application contract and element (#27). `register(contract, element)` checks the contract with the validator and the schema of the catalog, and it defines the element as `mu-app-<name>`. The frozen `CATALOG` does not change. `CONTRACTS` in `src/render/registry.js` gives the catalog contracts and the registered contracts to the elements, the envelope reader and the thread. The call refuses a catalog name, a name that is already registered, an invalid contract and an element that does not extend `MuElement`. `examples/register.html` shows a registered domain component. [catalog/README.md](catalog/README.md) gives the limits.
- The approval example (#8). `examples/approval.html` lists the open decisions as cards with their evidence. An approve or reject action goes to the fixture API `tools/approval_server.py`, which uses the Python standard library only. The button shows pending, and it shows done only after the receipt. The API refuses a second action on one decision, and the page shows the refusal as an error. `tests/browser/approval.mjs` checks the list, one approve with a receipt and one refusal.
- Decision 0002 on agent UI protocols (#51) and decision 0003 on shadow DOM (#50).
- Constitution versions 3 and 4 (#45, #48). Mugham is a UI toolkit for agentic applications. The kit has no runtime dependency, and the README screenshots are an exception to the rule against generated binaries.
- The workbench shell and the panels are out of scope (#41). The README no longer lists related projects (#43). The README and the status agree with the 0.1.0 state (#42).
- The gate pin moves to `mohanraj00/.github` at `b5d2b63` (#24).

- The source excerpt component `mu-excerpt` (#29). It shows a passage as text, with the span in a mark element. The mark has an underline and a strong weight, and the span shows again as text, so the mark does not depend on color. The span positions count code points. The element refuses a span that is empty or outside the passage. The required citation slot gives the source and the locator, so the locator rule of the slot applies. `mu-thread` shows an excerpt part. `examples/excerpt.html` shows an excerpt of a synthetic document.
- The citation component `mu-citation` (#28). It shows the source name, the locator as text, an optional quote and an `Open source` button. The source and the locator come from the citation slot, so the locator rule of the slot applies. A citation with no slot shows the `empty` state. A missing locator or a locator that is not a safe `https:` address gives a refusal with a clear reason. `mu-thread` shows a citation part. `examples/citation.html` shows a citation in a message. A base element can now give a refusal reason for a person with `refusal(errors)`. The `mu-refused` event still gives all errors.
- Contract format 2 gets the authorship slot and the citation slot (#33). A contract declares each slot, and each slot can be required. A fill gives the slots in its `slots` key. The validator refuses a fill that leaves a required slot empty. The kit shows each filled slot as text. A locator is an `https:` address, and it opens only after a person clicks `Open source`. Only the outer fill has slots. Format 2 is not released, so the format number stays `2`.
- The flag `ai_content` now has an effect. A contract with `ai_content` set to `true` must declare a required authorship slot. Thus the fills of `card`, `card-grid`, `editable-form` and `fact` must name the actor that wrote the content. A fill of these components with no `slots.authorship` is refused.
- Each element gets an `actor` property (#33). The application or the thread sets it to the trusted actor of the content. An element refuses a fill whose authorship slot has no bound actor, or names a different actor. The `type`, the `id` and an optional `name` must agree with the bound actor. Thus a model cannot show its content as the content of a person. `mu-thread` sets the actor of each component part to the actor of the envelope. The fills of `examples/thread-events.json` and of the thread checks now name their author.
- The example page `examples/provenance.html` shows a card with the two slots, and a card that the kit refuses because its authorship slot is empty.
- `mu-thread` updates the page one time for each frame, not one time for each task. An event that changes no message, no run and no error gives no update. The `push` function of the envelope reader gives `false` for such an event. Thus a stream of unknown events cannot use the CPU of the page (#57).
- The thread `mu-thread` for people and agents. It reads AG-UI 1.0 events through `src/envelope/`, from any async source. Each message shows its actor and the actor type. A message with no end marker shows as partial. A run error shows as an error, and a refused part shows a refusal notice. An action goes to the application and shows `Done` only after its receipt. A polite live region announces new messages, and the focus does not move. `src/thread/README.md` is its contract.
- `examples/thread.html` and `tools/thread_server.py`: two people and two agents in one thread, over server-sent events from a Python standard library server. The server gives the receipt of each action.
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
