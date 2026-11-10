# Kit source

- `tokens/tokens.json`: the design tokens. Each token has a light value and a dark value. `tools/tokens.py --write` writes `tokens/tokens.css` from it.
- `render/validate.js`: the browser validator of a fill. It gives the same errors as `tools/catalog.py` for each case in `tests/vectors/fills.json`.
- `render/dom.js`: the only way the kit makes DOM nodes. Data goes only into text nodes and into a short list of attributes.
- `render/catalog.js`: the contracts that the kit knows.
- `primitives/`: the custom elements `mu-text`, `mu-button`, `mu-field`, `mu-stack` and `mu-grid`.

## Use

1. Load `tokens/tokens.css` in the page.
2. Import `define` from `primitives/index.js` and call it.
3. Set the `fill` property of an element to a fill, for example `{component: 'button', version: '0.1.0', data: {label: 'Renew'}}`.

If the fill has an error, the element shows a refusal as text and keeps no data. A button sends a `mu-press` event. A field sends a `mu-edit` event. Neither sends an action.

## Checks

`make check` runs the checks. `tools/browser_check.mjs` starts headless Chrome and runs `tests/browser/primitives.html` in four media modes: light, dark, forced colors and reduced motion. It also reads the accessibility tree and sends real key events. CI uses Chrome for Testing 157.0.8103.50. The CI step checks the SHA-256 of the archive and the version before the check runs.
