# Check a fill

Release: v0.9.0

## Purpose

Make a fill, check it before it goes to the page, and give a model a schema of the fill. These helpers run in Node.js and in a browser.

## API call

All helpers are in `src/kit.js`:

- `fill(name, data, { version, slots })` makes a fill. It does not check it.
- `createKit({ actor })` binds a trusted actor. Its `outer` and `mount` put that actor in each authorship slot.
- `validateFill(value)` gives a list of errors with paths. An empty list means that the fill is valid.
- `describe(name)` gives a JSON Schema (Draft 2020-12) of the `data` of a component.
- `toolSchema(name)` gives a JSON Schema of the full fill, for a tool that builds fills.

## Example

<!-- source: tests/kit.test.mjs -->
```js
  assert.deepEqual(validateFill(fill('button', { label: 'Renew' })), []);
  assert.deepEqual(validateFill(fill('button', {})), ['data.label: a required field is missing']);
```

## Result

- A valid fill gives `[]`.
- A fill with no `label` gives `['data.label: a required field is missing']`.
- `describe('card').properties.title.maxLength` is `120`, from the card contract.

## Errors

- `fill`, `describe` and `toolSchema` throw `TypeError: component: no contract has the name <name>` for an unknown name.
- `createKit` throws `TypeError: actor: <errors>` if the actor is missing or not valid.
- `validateFill` does not throw. It gives each error as text.

[Kit helpers](../../../src/kit.md) gives each option.
