# Kit source

- `tokens/tokens.json`: the design tokens. Each token has a light value and a dark value. `tools/tokens.py --write` writes `tokens/tokens.css` from it.
- `render/validate.js`: the browser validator of a fill and of a contract. It gives the same errors as `tools/catalog.py` for each case in `tests/vectors/fills.json` and `tests/vectors/contracts.json`.
- `render/dom.js`: the only way the kit makes DOM nodes. Data goes only into text nodes and into a short list of attributes.
- `render/catalog.js`: the contracts that the kit knows.
- `render/registry.js`: the registration call for an application contract and its element. [catalog/README.md](../catalog/README.md#application-contracts) gives the rules.
- `primitives/`: the custom elements `mu-text`, `mu-button`, `mu-field`, `mu-stack` and `mu-grid`.
- `components/`: the custom elements `mu-card`, `mu-action-button`, `mu-editable-form`, `mu-card-grid`, `mu-citation` and `mu-excerpt`.
- `envelope/envelope.js`: the message envelope and the reader of an AG-UI 1.0 stream. [docs/contracts/envelope.md](../docs/contracts/envelope.md) gives the rules. A component part goes to `render/validate.js`.
- `thread/index.js`: the custom element `mu-thread`. It reads AG-UI 1.0 events through `envelope/` and shows each message with its actor. [thread/README.md](thread/README.md) is its contract.
- `actions/action.js`: the action path. A request stays pending until a receipt with the same id comes back.

## Use

1. Load `tokens/tokens.css` in the page.
2. Import `define` from `components/index.js` and call it. It also defines the primitives.
3. Set the `fill` property of an element to a fill, for example `{component: 'button', version: '0.1.0', data: {label: 'Renew'}}`.

If the fill has an error, the element shows a refusal as text and keeps no data. A button sends a `mu-press` event. A field sends a `mu-edit` event. Neither sends an action.

The guides give the full steps, with code that a check runs:

- [Contracts](../docs/guides/contracts.md)
- [Assemble a page](../docs/guides/assemble.md)
- [Theme the kit](../docs/guides/theme.md)
- [For coding agents](../docs/guides/agents.md)

## Checks

`make check` runs the checks. `tools/browser_check.mjs` starts headless Chrome and runs each check page in `tests/browser/` in four media modes: light, dark, forced colors and reduced motion. It also reads the accessibility tree and sends real key events. CI uses Chrome for Testing 157.0.8103.50. The CI step checks the SHA-256 of the archive and the version before the check runs. An AppArmor profile for that binary only lets the Chrome sandbox run on Ubuntu 24.04.
