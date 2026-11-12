# Message envelope, version 1

The schema is [envelope-v1.schema.json](envelope-v1.schema.json). It maps AG-UI 1.0, as [decision 0002](../decisions/0002-agent-ui-protocols.md) says. The reader is `src/envelope/`. The conformance set is `tests/vectors/envelope/`.

## The envelope

An envelope is one message of a thread. The stream reader makes envelopes from AG-UI events. An application can also give an envelope directly, for example a message from its history. The kit validates both with the same rules.

| Field | Value | AG-UI 1.0 source |
|---|---|---|
| `envelope` | `1`, the version of this contract | None |
| `agui` | `"1.0"`, the AG-UI version that the envelope maps | None |
| `threadId` | The thread id. Optional | `threadId` of `RUN_STARTED` |
| `runId` | The run id. Optional | `runId` of `RUN_STARTED` |
| `messageId` | The message id | `messageId` of `TEXT_MESSAGE_START` or `ACTIVITY_SNAPSHOT` |
| `role` | The AG-UI role. Optional. The kit never uses it for the actor | `role` of `TEXT_MESSAGE_START`. `activity` for a snapshot |
| `actor` | `type` (`human`, `agent` or `system`), `id`, and an optional `name` | `metadata.mugham.actor` of `TEXT_MESSAGE_START` or `ACTIVITY_SNAPSHOT` |
| `state` | `partial`, `final` or `refused` | See "States" |
| `parts` | The typed parts, in the order of the events | See "Parts" |

The application sets the actor. If a message has no valid actor, the kit refuses the message. A refused envelope has `state` equal to `refused`, a list of `errors`, no actor and no parts. It has no `messageId` if the input had no valid `messageId`.

## Parts

| Type | Fields | AG-UI 1.0 source |
|---|---|---|
| `text` | `text` | Each `delta` of `TEXT_MESSAGE_CONTENT`, added in order |
| `component` | `format` (`1`) and `fill` | `content` of `ACTIVITY_SNAPSHOT` with `activityType` equal to `mugham.fill` |
| `status` | `state` (`error`), `text` and an optional `code` | `message` and `code` of `RUN_ERROR` |
| `refusal` | `errors` | A component part that the fill validator refused |
| `fallback` | `partType` and `text` | A part of an unknown type |

Text is text. The kit never reads a text, a delta, an error or a status as Markdown or markup.

The kit validates each component part with `fillErrors` of `src/render/validate.js` and the catalog. If the fill has an error, the part becomes a `refusal` part with the errors. Thus an undeclared component shows as a refusal.

If a part has a type that version 1 does not know, the kit replaces it with a `fallback` part. The fallback has a fixed text and the type name, with 40 characters maximum. It keeps no other data of the part.

## States

- `partial`: the message is open. A text message stays partial until its `TEXT_MESSAGE_END`. A message with no end marker stays partial after `RUN_FINISHED` and after `RUN_ERROR`. The kit never shows it as final.
- `final`: a text message after its `TEXT_MESSAGE_END`. An `ACTIVITY_SNAPSHOT` carries a full fill, so its message is final. A later snapshot with the same `messageId` replaces it.
- `refused`: the kit refused the message, for example because it has no actor.

## The stream

The stream is a list of AG-UI 1.0 events. The order of the parts is the order of the events. The transport must keep the order. The kit defines no transport.

The reader reads only these seven types. It reads the fields in the table and keeps the AG-UI field names.

| Event | Fields | Effect |
|---|---|---|
| `RUN_STARTED` | `threadId`, `runId` | Starts a run. The run is `active` |
| `RUN_FINISHED` | `threadId`, `runId` | The run is `finished`. Open messages stay partial |
| `RUN_ERROR` | `message`, `code` | The run is `error`. Each open message of the run gets a `status` part and stays partial |
| `TEXT_MESSAGE_START` | `messageId`, `role`, `metadata.mugham.actor` | Opens a partial message with an empty text part |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta` | Adds the delta to the text part |
| `TEXT_MESSAGE_END` | `messageId` | The message is final |
| `ACTIVITY_SNAPSHOT` | `messageId`, `activityType`, `content`, `replace`, `metadata.mugham.actor` | Adds or replaces a message with one component part |

The reader ignores each other event type, and an `ACTIVITY_SNAPSHOT` with a different `activityType`. It also ignores a `TEXT_MESSAGE_CONTENT` or a `TEXT_MESSAGE_END` of a refused message. These events change no state. The result counts them in `ignored`. `ACTIVITY_DELTA` is not accepted.

For `ACTIVITY_SNAPSHOT`, `replace` is `true` if it is not given, as in AG-UI. If `replace` is `false` and the message exists, the reader ignores the snapshot. A snapshot cannot change the actor of a message.

If an event of the seven types is not valid, the reader ignores it and records an error for the stream. For example: a delta for a message that is not open, a second start of one message, or a run event that does not match the active run. The result keeps 100 stream errors maximum. If the text of a message becomes longer than 100000 characters, the kit refuses the message.

Actions and receipts do not go through the stream. The receipt is the response of the application API.

## Limits

These rules are not in version 1. A later version of the envelope adds them:

- A citation part.
- The other AG-UI event types, for example tool calls, state events and `ACTIVITY_DELTA`.
- A transport.
