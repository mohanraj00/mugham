# Queue an action offline

Release: v0.9.0

## Purpose

Keep each action on the device while the device is offline. Show it as pending, and send it after the device reconnects.

## API call

- `openQueue({ send, principal, name, store, timeout })` from `src/offline/queue.js` opens the queue. `send(request, { signal, principal })` is your transport. `principal` names the person whose credentials `send` uses. The default store is IndexedDB.
- `queueActions(root, queue)` from `src/kit.js` sends each action below `root` through the queue, online and offline.
- `queueFill(label, entries)` from `src/offline/queue.js` makes a fill of `mu-action-queue` from `queue.entries`.

## Example

<!-- source: examples/cards/queue.js -->
```js
  const options = { name: 'tool-library', principal: 'member-1', send, online, events: network.events, timeout: 4000 };
  let queue;
  try {
    queue = await openQueue(options);
  } catch {
    queue = await openQueue({ ...options, store: memoryStore() });
    kept.textContent = 'This device cannot keep the pending actions. A reload loses them.';
  }
```

<!-- source: examples/cards/queue.js -->
```js
  queueActions(main, queue);
```

Run it with `python3 -B tools/queue_server.py`, then open the URL that the server prints.

## Result

1. Offline, a press shows `Pending`. The action stays in the queue.
2. After the device reconnects, the queue sends the actions in order.
3. The button shows `Done` only after the receipt comes back.

## Errors

- `openQueue` throws a `TypeError` if `send` is not a function, `principal` is not a text of 1 to 128 characters, `name` is not 1 to 64 characters of `a-z`, `0-9`, `-` and `_`, or `timeout` is not a number above 0.
- The promise of `openQueue` rejects if the store cannot give its records. The example then uses `memoryStore()`.
- A `send` that throws means that no receipt came back. The action stays in the queue, and the queue stops. Its state is `queued` offline and `stalled` online. The queue sends it again with the same key after an `online` event, a retry of a person, or a new action.

[docs/contracts/offline-queue.md](../../contracts/offline-queue.md) gives the queue rules.
