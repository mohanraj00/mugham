# Send an action

Release: v0.9.0

## Purpose

Let a person press a button or submit a form, send the request to your API, and show the result only after the receipt comes back.

## API call

- Bind the tool in code with the `action` option of `mount`, or with the `action` property of the element. A fill never names a tool. The label of the binding must be the label of the fill.
- `onAction(root, handler)` from `src/kit.js` calls `handler(tool, args, id, request, element)` for each `mu-action` event below `root`. The handler returns a receipt, or a promise of a receipt: `{ ok, message, reference }`. It returns a function that removes the listener.
- `serviceHandler({ service, base, send, path })` from `src/kit.js` makes a handler for one service API. It maps the HTTP response to a receipt.

## Example

<!-- source: examples/guides/assemble.js -->
```js
const renewAction = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
const renew = mount('action-button', { label: 'Renew' }, { parent: moss, slot: 'actions', action: renewAction });
```

<!-- source: examples/guides/assemble.js -->
```js
onAction(renew, (tool, args, id, request) => api(request));
```

## Result

1. A press shows `Pending` at once.
2. A receipt with `ok: true` shows `Done: <message>` and `Reference: <reference>`.
3. A receipt with `ok: false` shows `Not done: <message>`. If the receipt gives `service` and `code`, the button shows them as text.

## Errors

- If the handler throws, its promise rejects or the receipt is not valid, the action stays `Pending: No receipt came back.` The element offers Retry and Cancel. Retry sends the same key with a new id.
- An `id` or a `key` in the receipt that does not match the request makes the receipt not valid.
- `serviceHandler` throws a `TypeError` for a service name that is not 1 to 80 characters, a `base` that is not an absolute `http` or `https` URL, or a `send` or `path` that is not a function. A path that leaves `base` sends nothing, and the action stays pending.

[Assemble a page](../assemble.md) shows this step in a full page. [catalog/README.md](../../../catalog/README.md#actions) gives the confirm step and the typed edits of a form.
