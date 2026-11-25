# Offline queue, version 1

An application can let a person do an action while the device is offline. The kit keeps each action in a queue on the device and shows it as pending. When the device reconnects, the kit sends the queue in order. This contract is the interface between the application and the queue.

The kit side is `src/offline/queue.js` and `src/offline/worker.js`. The tests are `tests/queue.test.mjs`, `tests/worker.test.mjs`, `tests/action.test.mjs` and the browser checks of `examples/cards/queue.html`.

The queue and the [offline data source](data-source.md) are separate parts. The queue sends actions. The data source reads records. An application uses the data source for each read that it shows offline.

## The request

An action element makes a request for each try of an action.

| Key | Value |
|---|---|
| `id` | The id of this try. Each try has a new id. |
| `key` | The key of the action. It stays the same for each try of that action. It is the idempotency key. |
| `tool` | The tool name that the application binds. |
| `arguments` | The arguments of the tool. Each value is a text, a finite number, `true` or `false`. |
| `edits` | Optional. The typed edits of a form. |

A new action has a new key. A retry of an action has the same key and a new id. The service must do an action only one time for each key. For a key that it knows, the service gives the result of the first try again.

## The send function

The application gives one function, `send(request, { signal })`. It sends the request to the API of the application or the service and returns a promise of a receipt. The application adds its credentials in this function. The kit never gets them.

| Result of `send` | Meaning |
|---|---|
| A receipt with `ok: true` | The service did the action. |
| A receipt with `ok: false` | The service rejected the action. This is a decision of the service. |
| A thrown error, a rejected promise, no answer in the time limit, or a result that is not a valid receipt | No receipt came back. The kit does not know if the service did the action. |

A receipt is an object with `ok` (`true` or `false`), an optional `message` of 200 characters maximum and an optional `reference` of 80 characters maximum. If it has an `id`, the value must be the id of the request. If it has a `key`, the value must be the key of the request. `signal` is an `AbortSignal`. The kit aborts it at the time limit.

Do not throw an error for a decision of the service. An error means that no receipt came back.

## The queue

`openQueue(options)` gives a promise of a queue.

| Option | Value |
|---|---|
| `send` | Necessary. The send function. |
| `name` | The name of the queue, 1 to 64 characters of `a-z`, `0-9`, `-` and `_`. The default is `actions`. |
| `store` | The store of the queue. The default is `indexedDbStore(name)`. |
| `timeout` | The time limit of one try in milliseconds. The default is 10000. |
| `online` | A function that returns `false` when the device is offline. The default reads `navigator.onLine`. |
| `events` | The event target that sends the `online` event. The default is the global object. |

If the store cannot give its records, the promise rejects. Then the application decides: for example, it uses `memoryStore()` and tells the person that a reload loses the pending actions.

`queue.perform(request, element)` adds a request and returns a promise of its receipt. These rules apply:

- The queue is the only path of each action, online and offline. Thus the order stays the same.
- The queue sends one action at a time, in the order of `perform`. It sends the next action only after the receipt of the action before it.
- A second flush that starts while a try is in flight sends nothing. Thus one `online` event, or two, send each action one time.
- Each try of an action has the same `key` and a new `id`.
- A receipt with `ok: true` removes the action from the queue. The promise gives the receipt, and the element shows `Done`.
- A receipt with `ok: false` removes the action from the queue. The promise gives the receipt, and the element shows `Not done` with the message. If the page has no element for the action, for example after a reload, the action stays in the queue as `rejected` until a person dismisses it.
- If no receipt comes back, the action stays in the queue, and the queue stops. The state is `queued` if the device is offline, and `stalled` if it is online. The queue sends the action again, with the same key, after an `online` event, after a retry of a person, or when the next action comes in.
- A cancel removes an action that is `queued` or `stalled`. The promise gives `null`. The queue refuses a cancel of an action that is in flight.
- The queue refuses a request that is not valid, and a request when it holds 100 actions. Then the promise gives a receipt with `ok: false` and the reason, and the queue keeps nothing.
- If the store cannot keep an action, the promise gives a receipt with `ok: false`, and the queue does not send the action.

The states of an action in the queue are:

| State | Meaning | Text | Exits |
|---|---|---|---|
| `queued` | The action waits for a connection, or for the receipt of an action before it. | `Pending: Waiting for a connection.` or `Pending: Waiting for an earlier action.` | Cancel |
| `sent` | A try is in flight. | `Pending` | None |
| `stalled` | A try got no receipt. | `Pending: No receipt came back.` | Retry, cancel |
| `rejected` | The service rejected the action, and the page has no element for it. | `Not done`, with the message | Dismiss |

Offline, each waiting action shows as `queued`. Online, the queue sends the first action next, so that action shows as `sent`.

No state of the queue shows as done. `queue.entries` gives a frozen list of the actions with `key`, `tool`, `label`, `arguments`, `queued`, `tries`, `state` and `message`. `queue.watch(listener)` calls the listener after each change. `queue.retry(key)`, `queue.cancel(key)` and `queue.dismiss(key)` do the exits. A retry sends the queue again from its first action, because the order stays the same. `queue.flush()` sends the queue now. `queue.close()` stops the queue.

`queueActions(root, queue)` in `src/kit.js` connects the action elements below `root` to the queue. It is `onAction` with `queue.perform`, and `queue.listen(root)` for the cancel events and for the steps of `mu-action-queue`.

## What the queue stores

The store holds one record for each action: `key`, `owner`, `order`, `tool`, `arguments`, `edits`, `label`, `queued`, `tries`, `state` and `message`. The queue makes each record from a request that it checked. It copies only these keys.

The queue stores no secret and no token:

- The record has no header, no cookie and no credential. The send function adds them at the time of each try.
- The queue refuses a request with an argument name that looks like a credential, for example `token`, `password`, `secret`, `api_key`, `authorization` or `cookie`. This is a guard, not a proof. The application must not bind a secret as an argument of an action.
- A record is 200000 characters maximum as JSON.

The service worker does not keep an action and does not send one. It keeps only the files that the application lists.

## The store

A store is an object with three methods. Each method returns a promise.

| Method | Result |
|---|---|
| `all()` | The list of all records. |
| `put(record)` | Keeps the record. A record with the same `key` replaces the old record. |
| `remove(key)` | Removes the record with this key. |

`indexedDbStore(name)` keeps the records in IndexedDB, so they stay after a reload. `memoryStore()` keeps them in memory only.

If a write fails after the queue accepted an action, the queue continues with the record in memory. After a reload, the queue can then send a completed action again. The key of the action is the same, so the service does not do it again.

## More than one page

Each queue has an owner id. A queue sends only its own records. With the Web Locks API, the queue holds a lock for its owner id while its page is open. When a queue loads or flushes, it takes each record whose owner holds no lock, for example after a reload. Thus two pages do not send the same record at the same time. On a device with no Web Locks API, the queue takes each record of the store, so use one page for each queue name.

## The action elements

`mu-action-button`, `mu-editable-form` and `mu-form-card` show a pending action with `data-state="pending"`. The attribute `data-wait` gives the detail: `sent`, `queued` or `stalled`.

- `element.hold({ key, wait, tries, message })` sets the detail. The queue calls it. The key must be the key of the pending action.
- If no receipt comes back in `element.patience` milliseconds (the default is 30000), the element changes to `stalled` by itself. Thus each pending action has an exit, also without a queue. A receipt that comes back later is still valid.
- A `stalled` action shows the buttons `Retry` and `Cancel`. A `queued` action shows `Cancel`.
- `Retry` sends a `mu-action` event with a new request: the same `key` and a new `id`.
- `Cancel` sends a `mu-action-cancel` event with `detail.key`. The event can be canceled. If no listener prevents it, the action goes back to its start state with a message. The message says if a try left the device. After a try, the kit does not know if the service did the action, and the message says so.
- A receipt is valid if its `key` is the key of the pending action. Without a `key`, its `id` must be the id of one try of the pending action.

The element never shows `Done` without a receipt with `ok: true`.

## The queue component

`mu-action-queue` shows the actions of a queue as text, each with its state and its exits. Its contract is `catalog/action-queue.json`. The application fills it with `queueFill(label, queue.entries)` after each change, and the thread does not show it. Only the application knows its queue, so a fill from a model cannot claim it. After a reload, this component shows the actions that still wait.

A button of the component sends a `mu-queue-step` event with `detail.key` and `detail.step`: `retry`, `cancel` or `dismiss`.

## The service worker

`src/offline/worker.js` lets the application load its pages offline. The application owns the worker file, its scope and its registration. The kit file has no `import` and no `export`, so a classic worker loads it with `importScripts`. Then the worker calls `mughamOffline.serve(self, { version, files })`.

| Option | Value |
|---|---|
| `version` | The version of the file list, 1 to 64 characters of letters, digits, `.`, `-` and `_`. A new version makes a new cache. |
| `files` | 1 to 500 URLs of the same origin, with no user name and no password. |

These rules apply:

- On install, the worker reads each file from the network and keeps it in the cache `mugham-shell-<version>`. If one file fails, the install fails.
- On activate, the worker removes each older `mugham-shell-` cache and takes the open pages.
- For a `GET` request of a listed URL, the worker asks the network first. If the network fails, it gives the file from the cache.
- The worker does not answer other requests. Thus it keeps no API response and no action. A request with a different method, a different origin or a URL that is not on the list goes to the network as usual.

The web app manifest, the icons and the install prompt belong to the application.
