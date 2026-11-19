# Kit helpers

Import the helpers from `src/kit.js`. Call `define()` from `src/components/index.js` before you mount a catalog element. Call `register()` before you use a contract of your application. You can build, describe and check fills in Node.js or in a browser.

## `fill(name, data, options)`

Build a fill for a declared name. The contract gives the default `version`. To give a different version or add slots, set `options.version` or `options.slots`. This function builds the envelope. Use `validateFill` to check it. For a nested fill, omit `slots`.

```js
const shelf = fill('fact', { label: 'Shelf', value: 'B-14' });
```

## `createKit({ actor })`

Bind a trusted actor from the application or the message envelope. Give the actor's `type`, `id` and optional `name`. A missing or invalid actor causes a `TypeError`. The returned `fill` builds nested fills. The returned `outer` and `mount` use the bound actor for each declared authorship slot. They use the bound actor even when `options.slots` has an authorship value.

```js
const kit = createKit({ actor: { type: 'agent', id: 'loan-helper' } });
const shelf = kit.fill('fact', { label: 'Shelf', value: 'B-14' });
const data = { title: 'Field guide to moss', facts: [shelf] };
const value = kit.outer('card', data);
const element = kit.mount('card', data, { parent: document.body });
```

## `mount(name, data, options)`

Create, fill and return an element. Set `options.parent` to append it. Set `options.slot` to put it in a named slot of its parent. You can give `version` and `slots` as for `fill`. Set `options.actor` to bind the actor and fill its declared authorship slot. Set `options.action` in application code to bind a tool before the element gets its fill. An invalid binding or an element without action support causes a `TypeError` before the helper appends the element. The element checks the fill and shows a refusal for invalid data. An unknown name or a contract with no defined element causes a `TypeError`.

```js
const renew = mount('action-button', { label: 'Renew' }, {
  parent: card, slot: 'actions', action: { tool: 'loan.renew', label: 'Renew' },
});
```

## `onAction(root, handler)`

Listen for `mu-action` on an element or a root that contains it. The first helper listener that receives an action event calls its handler. The handler gets `(tool, args, id, request, element)`. The full request includes any typed edits. The handler can return a receipt or a promise that gives a receipt. Give `ok` as a boolean and add `message` or `reference` if necessary. A message can have up to 200 characters. The helper adds the request id if the receipt has no `id`.

If the handler throws, the helper sends a receipt with `ok` set to `false`. If the element refuses a receipt, the helper sends a failure receipt with the request id and the message `The request failed.` If the element also refuses the failure receipt, the helper reports the refusal in the console. A button shows `Done` only after it accepts a receipt with `ok` set to `true`. Call the returned function to remove the listener.

```js
const stop = onAction(renew, (tool, args, id, request) => sendToApi(request));
```

## `describe(name)`

Get a JSON Schema (Draft 2020-12) for the component's `data`. The schema has the resolved fields, types, limits and allowed values. A component field refers to the schema of a nested fill.

```js
const cardDataSchema = describe('card');
```

## `toolSchema(name)`

Get a JSON Schema (Draft 2020-12) for the full fill. The schema includes the component name, version, data and declared slots. You can give this schema to a tool that builds fills. Enable date format checks in your JSON Schema validator. Use `validateFill` for all the catalog checks. The element also checks its bound actor and its own rules.

```js
const cardFillSchema = toolSchema('card');
```

## `validateFill(value)`

Check an outer fill against the registry. Get a list of readable errors with paths, or an empty list when the fill is valid.

```js
const errors = validateFill(fill('button', {}));
// ['data.label: a required field is missing']
```
