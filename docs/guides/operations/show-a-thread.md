# Show a thread

Release: v0.9.0

## Purpose

Show the messages of people and agents in one conversation. Each message names its actor. The thread reads AG-UI 1.0 events from your transport.

## API call

- `define()` from `src/thread/index.js` defines `mu-thread`.
- `thread.read(source)` reads events from an async iterable or from any iterable. `thread.push(event)` adds one event.
- `thread.bind = (fill, message) => binding` gives the binding of each `action-button` or `editable-form` part. With no binding, the part shows as disabled.
- `thread.perform = async (request, message, element) => receipt` sends the request to your API and gives the receipt.
- `thread.actorFor = (envelope) => actor` gives the trusted actor of a message from your own context.

Set `actorFor`, or let your transport write `metadata.mugham.actor` from authenticated context. The kit checks only the shape of the actor in an event. Without one of these controls, an agent can claim `type: human`, and the thread shows its content as the content of a person. [SECURITY.md](../../../SECURITY.md#what-the-application-must-do) gives this duty of the application.

## Example

<!-- source: examples/thread/thread.js -->
```js
thread.bind = (fill) => (fill.component === 'action-button' ? RENEW : undefined);
// The API decides. Its response is the receipt.
thread.perform = async (request) => {
  const response = await fetch('/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error('the API did not accept the request');
  return response.json();
};
thread.read(events('/events'));
```

Run it with `python3 tools/thread_server.py`, then open the URL that the server prints.

## Result

- Each message shows its actor name and type: `Person`, `Agent` or `System`.
- A message shows `Partial` while its text streams, and no state text after its end event.
- A component part is an `ACTIVITY_SNAPSHOT` with `activityType` set to `mugham.fill`. The thread shows the part only if its contract accepts the fill.
- `thread.state` is `idle`, `reading`, `ended` or `failed`.

## Errors

- A part with no contract, or with data that the contract refuses, shows as a refusal with a `Technical details` control. The thread does not stop.
- A message with an actor that is not valid, or an actor that `actorFor` refuses, shows `Refused message` and no actor name.
- A failure of the source sets `thread.state` to `failed` and shows the error.
- If `perform` throws or gives no valid receipt, the action stays pending.

[src/thread/README.md](../../../src/thread/README.md) gives each property and limit. [docs/contracts/envelope.md](../../contracts/envelope.md) gives each event.
