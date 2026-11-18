# Offline data source, version 1

An application can show data that it holds on the device. An application module, the source, gives the data. This contract is the interface between the source and the kit. The kit has no reader and no storage engine. The reader of a local bundle, a cache or a database belongs to the application.

The kit side is `src/offline/source.js`. The tests are `tests/source.test.mjs` and the browser checks of `examples/cards/offline.html`.

## The source

A source is an object with two methods. Each method returns a promise of a result.

| Method | Request | Result |
|---|---|---|
| `get(key)` | `key`: the key of one record, 1 to 128 characters. | A result with 0 or 1 record. |
| `list(filter)` | `filter`: `{ where, limit }`. See "The filter". | A result with 0 to `limit` records. |

The kit calls a method only through `read(source, request, options)`. Then the kit checks each result before a component shows it.

## The result

| Key | Value |
|---|---|
| `state` | `ready`, `stale`, `empty` or `error`. |
| `records` | A list of records. See "Records". |
| `checked` | The time of the last read that the service confirmed, as an ISO 8601 text in UTC, for example `2026-11-15T09:30:00.000Z`. Necessary for `ready` and `stale`. |
| `reason` | A text of 1 to 200 characters. Necessary for `error`. Optional for `stale`. |

The states have these meanings:

- `ready`: the records are new. The result has 1 or more records.
- `stale`: the records are old, for example because the device is offline. The result has 1 or more records, and `checked` tells their age.
- `empty`: no record agrees with the request. The result has no record.
- `error`: the source cannot give the records. The result has no record.

## Records

A record is a plain object with 1 to 40 keys. The key `key` is necessary, with a text of 1 to 128 characters. Each other value is a text of 2000 characters maximum, a finite number, `true` or `false`. A key name has 1 to 64 characters. A record has no nested object and no list.

## The filter

| Key | Value |
|---|---|
| `where` | Optional. An object of 1 to 10 keys. Each value is a text, a finite number, `true` or `false`. A record agrees if each of its values is equal to the value of `where`. |
| `limit` | Optional. An integer from 1 to 500. If it is not given, it is 100. |

The kit checks the request before it calls the source. If the filter or the key is not valid, or the source has no method for the request, the result is `error` with the reason `The request is not valid.` Then the kit does not call the source.

## The rules of the kit

`read(source, request, options)` gives a frozen result with the four keys. `request` is `{ get: key }` or `{ list: filter }`. These rules apply:

- If the method throws, or its promise rejects, the result is `error` with the reason `The source failed.`
- If the promise does not settle in `options.timeout` milliseconds, the result is `error` with the reason `The source did not answer.` The default timeout is 5000.
- If the result is not valid, the result is `error` with the reason `The source gave a result that is not valid.` The key `errors` gives each problem, for the developer. For example, a `ready` result with no record is not valid, and an `empty` result with a record is not valid.
- An `error` result never has records. If a source gives records with `error`, the kit removes them. The kit keeps the reason and the `checked` time of the source.
- A `get` result must have only the record with the requested key. A `list` result must have only records that agree with `where`, and at most `limit` records. Else the result is not valid.
- The kit copies the request one time, before it checks the request. The kit checks the request and the result against that copy, and the source gets a different copy. Thus a change of the request object during a read, by the application or by the source, does not change the check.
- The time of the read is the time when the source answers. A `checked` time after the time of the read is not valid.
- If `options.maxAge` is given in milliseconds, and a `ready` result has a `checked` time older than the limit, the result is `stale`. Its reason is `The data is older than the limit.`
- The kit copies and freezes each record. A later change in the source does not change a result that a component shows.

Thus the kit never shows old data as new data. A failed source shows an error and no records. It does not show the records of an earlier read.

`statusFill(label, result)` gives a fill of the `source-status` component from a result.

## The status component

`mu-source-status` shows the state of a source as text: `Ready`, `Stale`, `Empty` or `Error`, with the time of the last confirmed read and the reason. Its contract is `catalog/source-status.json`. The application fills it from the result of `read`, and the thread does not show it. Only the application knows the state of its source, so a fill from a model cannot claim it.

An application shows the records of a result only if the state is `ready` or `stale`. If a newer read starts before an older read gives its result, the application shows only the result of the newer read.
