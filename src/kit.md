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

Listen for `mu-action` on an element or a root that contains it. The first helper listener that receives an action event calls its handler. The handler gets `(tool, args, id, request, element)`. The full request includes any typed edits. The handler can return a receipt or a promise that gives a receipt. Give `ok` as `true` or `false`. If present, `message` and `reference` must be text, with 200 and 80 characters maximum. If the receipt gives an `id` or a `key`, each must match the request. The helper adds the request id only to a valid receipt with no `id`.

If the handler throws, the promise rejects or the result is invalid or refused, the action stays pending. An action button or form shows `Pending: No receipt came back.` and offers Retry and Cancel. The same controls show after the wait limit if the handler gives no answer. Retry uses the same key and a new id. A late receipt can still resolve the pending action. After Cancel, a late receipt cannot change the action. A valid receipt with `ok: false` shows `Not done`. A local failure before send gives its own reason. Call the returned function to remove the listener.

```js
const stop = onAction(renew, (tool, args, id, request) => sendToApi(request));
```

## `queueActions(root, queue)`

Connect the action elements below `root` to an offline queue of `src/offline/queue.js`. Each action goes through the queue, online and offline. The helper is `onAction` with `queue.perform`, and `queue.listen(root)` for the cancel events and for the steps of `mu-action-queue`. The queue gives each element its pending detail. After the queue checks a transport receipt, it returns the receipt with the id from the original call of `perform`. Call the returned function to remove the listeners. [Offline queue](../docs/contracts/offline-queue.md) gives the rules.

```js
const queue = await openQueue({ principal: memberId, send: (request, { signal, principal }) => sendToApi(request, signal, principal) });
const stop = queueActions(document.body, queue);
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
