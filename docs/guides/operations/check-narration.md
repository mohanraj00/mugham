# Check narration

Release: v0.9.0

## Purpose

Compare the text of an agent with the card that it describes. The check reads only explicit `[Field: value]` claims.

## API call

`checkNarration(fill, narration)` from `src/narration/check.js`. `fill` is a `card` fill. `narration` is the text of the agent, with 10000 UTF-16 code units maximum. The call gives `{ ok, checked, errors }`. Each error has `field` and `message`.

## Example

<!-- source: examples/evidence/narration.js -->
```js
  const result = checkNarration(example.fill, item.narration);
  const detail = result.errors.map((error) => `${error.field}: ${error.message}`).join('; ');
```

The cases are in [narration.json](../../../examples/evidence/narration.json). Open `http://localhost:8000/examples/evidence/narration.html` after `python3 tools/serve.py`.

## Result

For a card with `Count` 12, `Status` ready and `Date` 2026-11-15, the text `The tray has [Count: 12] items, with [Status: ready] on [Date: 2026-11-15].` gives `ok: true` and `checked: 3`.

## Security

The check compares only explicit claims with the card. It cannot verify the facts in free text, so do not show a pass as proof of the whole text. [SECURITY.md](../../../SECURITY.md#renderer) gives this limit.

## Errors

The call does not throw. It gives `ok: false` and errors if:

- the fill is not a `card`: `component: must be a card`;
- the fill is not valid: the errors of the card contract;
- the narration is not a string, or it is too long;
- a claim names a field that the card does not have, or a value that is different.

[Decision 0005](../../decisions/0005-narration-check.md) gives the rules. [For coding agents](../agents.md#narration-claims) gives a prompt for the model.
