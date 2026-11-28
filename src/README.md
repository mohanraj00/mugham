# Kit source

- [Kit helpers](kit.md) in `kit.js` build fills, mount elements, send receipts and export JSON Schema.
- `tokens/tokens.json`: the design tokens. Each token has a light value and a dark value. `tools/tokens.py --write` writes `tokens/tokens.css` from it.
- `render/validate.js`: the browser validator of a fill and of a contract. It gives the same errors as `tools/catalog.py` for each case in `conformance/v1/catalog/fills.json` and `conformance/v1/catalog/contracts.json`.
- `render/rich-text-value.js` checks nested rich text values for the editor, the action path and the offline queue. It also checks heading order, inline limits and link policy for the rich text display.
- `render/dom.js`: the only way the kit makes DOM nodes. Data goes only into text nodes and into a short list of attributes.
- `styles/page.css`: the default page style. It uses only the tokens. [docs/guides/theme.md](../docs/guides/theme.md#the-default-page-style) gives its rules.
- `render/catalog.js`: the contracts that the kit knows, in the full form.
- `render/resolve.js`: the resolver of the short form of a contract. It gives the same full form as `tools/catalog.py` for each case in `conformance/v1/catalog/short.json`.
- `render/registry.js`: the registration call for an application contract and its element. [catalog/README.md](../catalog/README.md#application-contracts) gives the rules.
- `primitives/`: the custom elements `mu-text`, `mu-button`, `mu-stack` and `mu-grid`. `primitives/fields.js` has the input fields `mu-field`, `mu-long-text-field`, `mu-number-field`, `mu-date-field` and `mu-choice-field`.
- `components/`: the custom elements `mu-card`, `mu-action-button`, `mu-editable-form`, `mu-form-card`, `mu-card-grid`, `mu-citation`, `mu-excerpt`, `mu-diff`, `mu-source-status` and `mu-action-queue`.
- `envelope/envelope.js`: the message envelope and the reader of an AG-UI 1.0 stream. [docs/contracts/envelope.md](../docs/contracts/envelope.md) gives the rules. A component part goes to `render/validate.js`.
- `thread/index.js`: the custom element `mu-thread`. It reads AG-UI 1.0 events through `envelope/` and shows each message with its actor. [thread/README.md](thread/README.md) is its contract.
- `offline/source.js`: the kit side of the offline data source interface. It checks each request and each result of a source. [docs/contracts/data-source.md](../docs/contracts/data-source.md) gives the rules.
- `offline/queue.js`: the offline queue of pending actions. It keeps each action on the device, shows it as pending and sends the queue in order after the device reconnects. `offline/worker.js` is the service worker part: it keeps the files that the application lists, so a page loads offline. [docs/contracts/offline-queue.md](../docs/contracts/offline-queue.md) gives the rules.
- `actions/action.js`: the action path. A request stays pending until a receipt of the action comes back. An action has one key for all its tries, and a pending action with no receipt offers a retry and a cancel.

## Use

1. Load `tokens/tokens.css` in the page.
2. Import `define` from `components/index.js` and call it. It also defines the primitives.
3. Use `mount` from [kit.js](kit.md), for example `mount('button', { label: 'Renew' }, { parent: document.body })`.

If the fill has an error, the element shows a refusal as text and keeps no data. A button sends a `mu-press` event. A field sends a `mu-edit` event. Neither sends an action.

The guides give the full steps, with code that a check runs:

- [Contracts](../docs/guides/contracts.md)
- [Assemble a page](../docs/guides/assemble.md)
- [Theme the kit](../docs/guides/theme.md)
- [For coding agents](../docs/guides/agents.md)

## Checks

`make check` runs the checks. `tools/browser_check.mjs` starts headless Chrome and runs each check page in `tests/browser/` in four media modes: light, dark, forced colors and reduced motion. It also reads the accessibility tree and sends real key events. CI uses Chrome for Testing 157.0.8103.50. The CI step checks the SHA-256 of the archive and the version before the check runs. An AppArmor profile for that binary only lets the Chrome sandbox run on Ubuntu 24.04.
