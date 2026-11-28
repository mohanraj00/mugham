# Show run steps

Release: v0.9.0

## Purpose

Show the steps and tool calls of an agent run in a thread, from the AG-UI step and tool events.

## API call

`createRunSteps({ actor, label, toolText })` from `src/kit.js`. Give the actor from trusted page data. `steps.push(event)` gives an empty list or one `ACTIVITY_SNAPSHOT` with a `run-steps` fill. Push each original event to the thread, then each snapshot.

## Example

<!-- source: examples/thread/run-steps.js -->
```js
const steps = createRunSteps({ actor, label: 'Tray check', toolText: true });
```

<!-- source: examples/thread/run-steps.js -->
```js
  thread.push(event);
  for (const snapshot of steps.push(event)) thread.push(snapshot);
```

Open `http://localhost:8000/examples/thread/run-steps.html` after `python3 tools/serve.py`.

## Result

- The thread shows one `mu-run-steps` list for each run, with the state of each step and each tool call.
- `RUN_ERROR` marks each unfinished row as failed. `RUN_FINISHED` marks each unfinished row as failed with `The run ended before this step finished.`

## Errors

- `createRunSteps` throws a `TypeError` if the actor is not valid.
- An unknown event, an event with an id that is not valid, or an end event with no start gives no snapshot.

[src/envelope/run-steps-events.md](../../../src/envelope/run-steps-events.md) gives each limit.
