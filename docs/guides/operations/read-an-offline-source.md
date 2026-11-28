# Read an offline source

Release: v0.9.0

## Purpose

Read records from a data source of your application, and show the true state of the data: ready, stale, empty or error. The source owns the transport and the copy on the device.

## API call

- `read(source, input, { timeout, maxAge })` from `src/offline/source.js`. `source` has `get(id)` and `list(filter)`. `input` is `{ get: '<id>' }` or `{ list: { limit, where } }`. The call never throws. It gives a frozen result: `{ state, records, checked, reason }`.
- `statusFill(label, result)` from `src/offline/source.js` makes a fill of `mu-source-status` from the result.

## Example

<!-- source: examples/cards/offline.js -->
```js
  const result = await read(source, { list: { limit: 50 } }, { timeout: 2000 });
  if (mine !== latest) return;
  status.fill = statusFill('Tool library', result);
  records.replaceChildren();
  if (result.state !== 'ready' && result.state !== 'stale') return;
```

Open `http://localhost:8000/examples/cards/offline.html` after `python3 tools/serve.py`.

## Result

- `state` is `ready`, `stale`, `empty` or `error`. `checked` is the time of the last confirmed read.
- If `maxAge` is set and the data is older, a `ready` result becomes `stale`.
- `mu-source-status` shows the state as text. Show the records only for `ready` or `stale`.

## Errors

`read` gives `state: 'error'` with one of these reasons:

- `The request is not valid.`: the input is not valid, or the source has no function for it.
- `The source did not answer.`: no answer before `timeout`.
- `The source failed.`: the source threw.
- `The source gave a result that is not valid.`: `errors` gives each problem.

[docs/contracts/data-source.md](../../contracts/data-source.md) gives the source rules.
