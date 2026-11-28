# Offline queue, version 1

An application can let a person do an action while the device is offline. The kit keeps each action in a queue on the device and shows it as pending. When the device reconnects, the kit sends the queue in order. This contract is the interface between the application and the queue.

The kit side is `src/offline/queue.js` and `src/offline/worker.js`. The tests are `tests/queue.test.mjs`, `tests/worker.test.mjs`, `tests/action.test.mjs` and the browser checks of `examples/cards/queue.html`.

From release 1.0.0, the [compatibility statement](../COMPATIBILITY.md) tells which parts of this contract are stable and which changes need a major release.

The queue and the [offline data source](data-source.md) are separate parts. The queue sends actions. The data source reads records. An application uses the data source for each read that it shows offline.

## The request

An action element makes a request for each try of an action.

| Key | Value |
|---|---|
| `id` | The id of this try. Each try has a new id. |
| `key` | The key of the action. It stays the same for each try of that action. It is the idempotency key. |
| `tool` | The tool name that the application binds. |
| `arguments` | The arguments of the tool. Each value is a text, a finite number, a pair of finite numbers in low to high order, `true` or `false`, a list of up to 500 texts, or a `rich-text` value that passes the rich text contract check. Each text in a list has at most 80 characters. The record size limit applies. |
| `edits` | Optional. The typed edits of a form. The old and new values can be text lists or `rich-text` values with the same limits as arguments. The queue checks rich text in arguments and edits against all supported link schemes. The page policy can permit fewer schemes. |

A new action has a new key. A retry of an action has the same key and a new id. The service must do an action only one time for each key. For a key that it knows, the service gives the result of the first try again.

## The send function

The application gives one function, `send(request, { signal, principal })`. It sends the request to the API of the application or the service and returns a promise of a receipt. The application adds its credentials in this function. The kit never gets them.

| Result of `send` | Meaning |
|---|---|
| A receipt with `ok: true` | The service did the action. |
| A receipt with `ok: false` | The service rejected the action. This is a decision of the service. |
| A thrown error, a rejected promise, no answer in the time limit, or a result that is not a valid receipt | No receipt came back. The kit does not know if the service did the action. |

A receipt is an object with `ok` (`true` or `false`), an optional `message` of 200 characters maximum and an optional `reference` of 80 characters maximum. It can also have an optional `service` of 80 characters maximum, the short name of the service, and an optional `code` of 80 characters maximum, the reason code of the service. The kit shows `message`, `reference`, `service` and `code` only as text. Of a receipt, the kit keeps only `ok`, `id`, `key`, `message`, `reference`, `service` and `code`. If it has an `id`, the value must be the id of the request. If it has a `key`, the value must be the key of the request. `signal` is an `AbortSignal`. The kit aborts it at the time limit. `principal` is the principal of the queue. If the send function reads the session at the time of each try, compare the two. If a different person is signed in, throw an error and send nothing.

Do not throw an error for a decision of the service. An error means that no receipt came back.

## The queue

`openQueue(options)` gives a promise of a queue.

| Option | Value |
|---|---|
| `send` | Necessary. The send function. |
| `principal` | Necessary. A text of 1 to 128 characters that names the person whose credentials the send function uses, for example the id of the signed-in person with the id of the tenant. See "The principal". |
| `name` | The name of the queue, 1 to 64 characters of `a-z`, `0-9`, `-` and `_`. The default is `actions`. |
| `store` | The store of the queue. The default is `indexedDbStore(name)`. |
| `timeout` | The time limit of one try in milliseconds. The default is 10000. |
| `online` | A function that returns `false` when the device is offline. The default reads `navigator.onLine`. |
| `events` | The event target that sends the `online` event. The default is the global object. |

If the store cannot give its records, the promise rejects. Then the application decides: for example, it uses `memoryStore()` and tells the person that a reload loses the pending actions.

`queue.perform(request, element)` adds a request and returns a promise of its receipt. The queue checks the receipt against the transport request. The promise gives the receipt with the id from the original call of `perform` and the same action key. A retry of that action uses the same promise. These rules apply:

- Use the same queue for online and offline actions. Within one queue, new actions enter in the order of `perform`. Actions taken from storage use their saved order. Each pass sends waiting actions one at a time in queue order. A try with no receipt stops the pass. A cancel that completes removes the action from this order.
- Only one flush runs in a queue at a time. A flush requested during a try can start another pass after the current pass ends.
- Each try of an action has the same `key` and a new `id`.
- A receipt with `ok: true` removes the action from the queue. The promise gives the receipt, and the element shows `Done`.
- A receipt with `ok: false` removes the action from the queue. The promise gives the receipt, and the element shows `Not done` with the message. An element also shows the `service` and the `code` of the receipt. If the page has no element for the action, the action stays in the queue as `rejected` until a person dismisses it. The queue view of a `rejected` action shows only the message. This applies after a reload, to a call of `perform` with no element, and to an element that is not connected to the page. The promise gives the receipt in each case.
- If no receipt comes back, the action stays in the queue, and the queue stops. The state is `queued` if the device is offline, and `stalled` if it is online. The queue sends the action again, with the same key, after an `online` event, after a retry of a person, or when the next action comes in.
- A cancel removes an action that is `queued` or `stalled`. The queue refuses a cancel of an action that is in flight. The queue first removes the record from the store. Only then is the cancel complete: the promise gives `null`, the element shows the cancel, and the queue continues with the next action. While the store works, the queue does not send the action or an action after it.
- If the store cannot remove the record, the cancel does not occur. The action stays pending with the message `The device cannot remove the action. Try again.`, and the queue sends it as each other pending action. Thus the page never shows a cancel for an action that goes out after a reload.
- The queue refuses a request that is not valid, and a request when it holds 100 actions. Then the promise gives a receipt with `ok: false` and the reason, and the queue keeps nothing.
- If the store cannot keep an action, the promise gives a receipt with `ok: false`, and the queue does not send the action.
- A closed queue sends nothing. The queue reads its closed state in the same task as each call of the send function. If the queue closes before that call, the request does not leave the device, and the record stays in the store as it was.

The states of an action in the queue are:

| State | Meaning | Text | Exits |
|---|---|---|---|
| `queued` | The action waits for a connection, or for the receipt of an action before it. | `Pending: Waiting for a connection.` or `Pending: Waiting for an earlier action.` | Cancel |
| `sent` | A try is in flight. | `Pending` | None |
| `stalled` | A try got no receipt. | `Pending: No receipt came back.` | Retry, cancel |
| `rejected` | The service rejected the action, and the page has no element for it. | `Not done`, with the message | Dismiss |
| `unreadable` | The queue cannot use a saved record of its principal. | `Unreadable` | Dismiss |

Offline, each waiting action shows as `queued`. Online, a running flush sends the first action next, so that action shows as `sent`. With no running flush, the first action shows as `queued`, so the page never shows a try that is not in flight.

No state of the queue shows as done. `queue.entries` gives a frozen list of the actions with `key`, `tool`, `label`, `arguments`, `queued`, `tries`, `state` and `message`. Each unreadable record adds one entry with only `key`, `state` and the fixed label `A saved action that this version cannot read`. The entry uses the saved record key if it is valid key text and agrees with the store key. Otherwise the queue gives the entry a local key and uses the store key for removal.

`queue.watch(listener)` calls the listener after each change. `queue.retry(key)`, `queue.cancel(key)` and `queue.dismiss(key)` do the exits. A retry sends the queue again from its first waiting action. `queue.cancel(key)` returns `true` when the cancel starts. `queue.dismiss(key)` returns `true` when dismissal starts. For an unreadable entry, dismiss checks that the record is still unreadable and belongs to the same principal before it removes the record. If the record no longer meets these conditions, dismiss removes only the entry. If storage removal fails, the entry stays available for dismissal.

`queue.flush()` sends the queue now. `queue.clear()` removes each usable action with no try in flight. It returns a promise of the number of removed actions, and the promise settles after the store removed the records. Use dismiss for each unreadable entry. `queue.close()` stops the queue.

`queueActions(root, queue)` in `src/kit.js` connects the action elements below `root` to the queue. It is `onAction` with `queue.perform`, and `queue.listen(root)` for the cancel events and for the steps of `mu-action-queue`. An application that calls `queue.perform` by itself must also call `queue.listen(root)`. Without it, a cancel on an element does not remove the action from the queue.

## What the queue stores

The store holds one version 1 record for each action. The value of `version` is `1`. The other required fields are `key`, `principal`, `owner`, `order`, `tool`, `arguments`, `label`, `queued`, `tries`, `state` and `message`. It also has `edits` if the request has edits. The queue makes each record from a request that it checked. It copies only these fields.

The queue stores no secret and no token:

- The record has no header, no cookie and no credential. The send function adds them at the time of each try.
- The queue refuses a request with an argument name that looks like a credential, for example `token`, `password`, `secret`, `api_key`, `authorization` or `cookie`. This is a guard, not a proof. The application must not bind a secret as an argument of an action.
- A record is 200000 characters maximum as JSON.

A queue takes a record from the store only if its version is supported and its keys, types and limits agree with the rules for that version. If a record has no `version`, the queue applies the version 1 rules. An invalid record or a record of an unknown version stays in the store. If it has this queue's principal, the queue shows it as `unreadable` and leaves it for dismissal. A record of a different principal or with no valid principal stays hidden. The queue never sends or retries these records. If the store has more than 100 valid records of the principal, the queue takes the oldest 100 and takes the others when it has room.

The service worker does not keep an action and does not send one. It keeps only the files that the application lists.

## The principal

A device can have more than one person. An action that one person made must not go out with the credentials of a different person. Thus each record has the principal of its queue, and these rules apply:

- The application gives `principal` to `openQueue`. It names the person whose credentials the send function uses. If the application has tenants, the text also names the tenant. An application with no sign-in gives one fixed text.
- A queue takes, shows and sends only the records of its principal. A record of a different principal, and a record with no valid principal, stays in the store. No queue of a different principal sends it.
- After a sign-out, close the queue. After the next sign-in, open a new queue with the new principal.
- If the same person signs in again, the queue of that person takes the records and sends them.
- Close the queue before the application changes the credentials of the send function. A closed queue calls the send function no more. A try that is in flight at that time continues, with the credentials that the send function gave to it.
- To remove the waiting actions that the queue holds at sign-out, call `await queue.clear()` before `queue.close()`. Clear leaves an action with a try in flight. The result of the try determines what the queue does with the record. Unreadable entries stay until dismissal. If the promise gives a number that is smaller than the number of usable actions with no try in flight, the store did not remove each of those actions.

The principal is an id, not a credential. Do not give a token as the principal.

## The store

A store supplies these methods. Each method returns a promise.

| Method | Result |
|---|---|
| `all()` | The list of all records. |
| `put(record)` | Keeps the record. A record with the same `key` replaces the old record. |
| `remove(key)` | Removes the record with this key. |
| `allEntries()` | Optional. The list of `{ key, record }` objects, where `key` is the key to pass to `remove`. Give this method if the store can hold records without their own store key. |

`indexedDbStore(name)` keeps the records in IndexedDB, so they stay after a reload. `memoryStore()` keeps them in memory only.

If a write fails after the queue accepted an action, the queue continues with the record in memory. After a reload, the queue can then send a completed action again. The key of the action is the same, so the service does not do it again.

## More than one page

Each queue has an owner id. With the Web Locks API, it holds a lock for that id until it closes and the storage work of any active try settles. This includes removal after a receipt and the write after a try with no receipt. When a queue loads or flushes, it takes usable records of its principal whose owner holds no lock, for example after a reload. Thus a second queue cannot take a record while the first queue can still update it for that try. Each page sends its own records, with no single send order across pages. A timed-out request can still be active in the transport or service, so the service must apply the idempotency key rule. On a device with no Web Locks API, use one page for each queue name.

## The action elements

`mu-action-button`, `mu-editable-form` and `mu-form-card` show a pending action with `data-state="pending"`. The attribute `data-wait` gives the detail: `sent`, `queued` or `stalled`.

- `element.hold({ key, wait, tries, message })` sets the detail. The queue calls it. The key must be the key of the pending action.
- If no receipt comes back in `element.patience` milliseconds (the default is 30000), the element changes to `stalled` by itself. Thus each pending action has an exit, also without a queue. A receipt that comes back later is still valid.
- A `stalled` action shows the buttons `Retry` and `Cancel`. A `queued` action shows `Cancel`.
- `Retry` sends a `mu-action` event with a new request: the same `key` and a new `id`.
- `Cancel` sends a `mu-action-cancel` event with `detail.key`. The event can be canceled. If no listener prevents it, the action goes back to its start state with a message. The message says if a try left the device. After a try, the kit does not know if the service did the action, and the message says so.
- A queue prevents the event for each action that it holds. After the store removed the record, the queue calls `element.cancel(key)`, and then the action goes back to its start state.
- A receipt must have the `key` of the pending action, the `id` of one of its tries, or both. If it has both, both must match. The value of `ok` must be `true` or `false`. If present, `message` must be text of 200 characters maximum, and `reference`, `service` and `code` must each be text of 80 characters maximum. An invalid receipt leaves the action pending.

The element never shows `Done` without a receipt with `ok: true`.

## The queue component

`mu-action-queue` shows the actions of a queue as text, each with its state and its exits. Its contract is `catalog/action-queue.json`. The application fills it with `queueFill(label, queue.entries)` after each change, and the thread does not show it. Only the application knows its queue, so a fill from a model cannot claim it. After a reload, this component shows the actions that still wait and offers Dismiss for unreadable entries. The helper includes the first 100 unreadable entries. When a dismissal completes, the next fill can show another entry.

A button of the component sends a `mu-queue-step` event with `detail.key` and `detail.step`: `retry`, `cancel` or `dismiss`.

## The service worker

`src/offline/worker.js` lets the application load its pages offline. The application owns the worker file, its scope and its registration. The kit file has no `import` and no `export`, so a classic worker loads it with `importScripts`. Then the worker calls `mughamOffline.serve(self, { version, files })`.

| Option | Value |
|---|---|
| `version` | The version of the file list, 1 to 64 characters of letters, digits, `.`, `-` and `_`. A new version makes a new cache. |
| `files` | 1 to 500 URLs of the same origin, with no user name and no password. |

These rules apply:

- On install, the worker reads each file from the network and keeps it in the cache `mugham-shell <scope> <version>`. `<scope>` is the scope URL of the registration. If one file fails, the install fails.
- The worker reads each file with no credentials: no cookie, no HTTP sign-in and no client certificate. If the server gives an error or a redirect for a file, for example to a sign-in page, the install fails. Thus the cache holds only an answer that the server gives to each person. It never holds a page or data that the server makes for one signed-in person, so a second person on the device cannot get them.
- List only files that are the same for each person. An application whose files need a sign-in cannot keep them with this worker.
- On activate, the worker removes each older cache of its own scope and takes the open pages. It does not touch the cache of a different scope, so two applications on one origin can each have a worker.
- A new worker with a new version waits until the pages of the old worker close, as each service worker does. The application decides if it calls `skipWaiting()`.
- For a `GET` request of a listed URL, the worker asks the network first. If the network fails, it gives the file from the cache.
- A request to the network goes out as the page made it, with its credentials. The worker does not keep that answer.
- The worker does not answer other requests. Thus it keeps no API response and no action. A request with a different method, a different origin or a URL that is not on the list goes to the network as usual.

The web app manifest, the icons and the install prompt belong to the application.
