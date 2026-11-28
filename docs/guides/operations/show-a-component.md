# Show a component

Release: v0.9.0

## Purpose

Show a catalog component on a page, filled with data that its contract accepts.

## API call

- `define()` from `src/components/index.js` defines each catalog element. Call it one time, before you mount.
- `mount(name, data, { parent, slot, actor, action })` from `src/kit.js` makes, fills and appends an element. It returns the element.

## Example

<!-- source: examples/guides/assemble.js -->
```js
const stack = mount('stack', { label: 'Loans of Robin', gap: 'large' });
const grid = mount('grid', { label: 'Current loans', min_column: 'medium' }, { parent: stack });
```

[examples/guides/assemble.js](../../../examples/guides/assemble.js) has the full page.

## Result

- The element shows the data as text. It never reads the data as markup.
- If the data does not agree with the contract, the element shows a refusal as text. It sets `data-state="refused"` and sends a `mu-refused` event. `event.detail.errors` gives each error with its path.

## Security

Give `actor` only from trusted application or transport context, never from the data of a model. To show model-supplied images, set the allowed origins of `mu-image` and a matching `img-src` Content Security Policy. [SECURITY.md](../../../SECURITY.md#what-the-application-must-do) gives these duties.

## Errors

`mount` throws a `TypeError` and appends nothing if:

- no contract has the name: `component: no contract has the name <name>`;
- the name has no defined element: `mount: no defined element for <name>`. Call `define()` first;
- the element takes no action and you give `action`: `mount: <name> does not support an action binding`;
- the binding is not valid: `action: <errors>`.

The [catalog](../../../catalog/README.md) gives the contract of each component.
