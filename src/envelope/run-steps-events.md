# Map run events to steps

Import `createRunSteps` from `src/kit.js`. Give it the actor from trusted page data. It checks the actor when you create the helper and throws a `TypeError` if the actor is invalid. The actor goes in the snapshot metadata and in the fill's authorship slot.

```js
const steps = createRunSteps({ actor, label: 'Tray check', toolText: true });
for (const event of events) {
  thread.push(event);
  for (const snapshot of steps.push(event)) thread.push(snapshot);
}
```

Use one helper per ordered stream. Each valid `RUN_STARTED` starts a new run. `push` returns an empty list or one `ACTIVITY_SNAPSHOT` with `activityType` set to `mugham.fill` and `replace` set to `true`. The message id is `<runId>/steps`. For a long run id, the helper cuts the prefix and adds `/steps#` and a local number. Reserve these message ids for the helper. Keep each original event in the stream so that the reader can apply its limits and count step and tool events as ignored. The reader applies the page's `actorFor` check to each snapshot.

The helper matches `STEP_FINISHED` to the most recent running step with the same `stepName`. It uses the step name as the row id and adds a number to a repeated name, for example `Check trays#2`. For matching, it retains up to 128 characters of each step name. A new tool row follows the latest running step and its other tool rows. Its id joins the step id and the tool call id with `/`. A tool with no running step goes at the end and uses its call id. A generated id replaces a row id that would be blank or a duplicate. `TOOL_CALL_END` or `TOOL_CALL_RESULT` completes the tool row.

The default label is `Run steps`. The fill shows the last 20 rows in display order. The label gives the count of earlier rows and stays within its limit. The helper retains the last 100 rows in display order and remembers the last 100 step starts for matching and tool placement. Events for older entries can no longer update those entries. Unknown events, events with invalid ids, unmatched end events and updates to hidden rows give no snapshot unless they change the visible rows or the label.

By default, a tool row shows its tool name. Set `toolText: true` to include the joined argument deltas and each string result as plain text. Each field keeps at most 2000 characters.

`RUN_ERROR` marks each unfinished row as failed with `The run stopped with an error.`. `RUN_FINISHED` marks any unfinished row as failed with `The run ended before this step finished.`. The reader handles each original run event under its usual rules.

[Run steps example](../../examples/thread/run-steps.html)
