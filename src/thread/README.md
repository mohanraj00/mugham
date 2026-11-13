# The thread

`mu-thread` shows one thread for people and agents. It reads AG-UI 1.0 events only through the reader of `src/envelope/`. [docs/contracts/envelope.md](../../docs/contracts/envelope.md) gives the envelope, the states and the limits. This file is the contract of the element.

The thread has no contract in `catalog/`. A model does not fill the thread. A model sends events, and each component part of an event is a fill that the catalog or a [registered contract](../../catalog/README.md#application-contracts) validates. Thus the catalog rules do not need a thread contract, and the contract format does not change.

## Use

```js
import { define } from './src/thread/index.js';

define();
const thread = document.querySelector('mu-thread');
thread.bind = (fill, message) => (fill.component === 'action-button' ? { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } } : undefined);
thread.perform = async (request, message) => postToTheApi(request);
await thread.read(events);
```

| Member | Content |
|---|---|
| `push(event)` | Gives one AG-UI 1.0 event to the reader. |
| `read(source)` | Reads each event of an async source, or of any iterable, in order. The promise resolves when the source ends. If the source fails, the thread shows a notice and the promise resolves. |
| `bind` | Optional. A function `(fill, message)` that gives the action binding of an `action-button` or an `editable-form` part. [The catalog README](../../catalog/README.md#actions) gives the binding. If it gives no binding, the element shows as disabled and sends no action. If the fill does not agree with the binding, the element refuses the fill. |
| `perform` | Optional. An async function `(request, message)` that sends the request to the API of the application and gives its receipt. If it is not set, the `mu-action` event goes up to the page, and the page calls `receipt()` of the element. |
| `messages` | A copy of the envelopes, in the order of the thread. |
| `state` | `idle`, `reading`, `ended` or `failed`. The element also sets `data-state` to this value. |

The transport is the application's. The thread defines no transport and parses no text.

## Messages

Each message is a list item with an article. The article has the name `Message from <name>, <type>`.

- The header shows the actor name and the actor type. If the actor has no name, the header shows the actor id. The type text is `Person` for `human`, `Agent` for `agent` and `System` for `system`.
- The thread takes the actor only from the envelope. The AG-UI `role` never changes the actor. The content of an agent never shows as the content of a person.
- The thread sets the `actor` of each component element to the actor of the envelope, before the fill. A fill of a contract with `ai_content` set to `true` must have an authorship slot with the `type` and the `id` of that actor. If the slot has a `name`, it must be the name of that actor. If not, the thread or the element refuses the part. Thus an agent cannot name a person as the author of its card.
- A refused message has no actor. It shows `Refused message` and the first error. It never shows an actor name.

## States

The item of each message has `data-state`, with the state of the envelope.

| State | The thread shows |
|---|---|
| `partial` | The text `Partial`. The message has no end marker. It stays partial after the end of its run. |
| `final` | No state text. |
| `refused` | `Refused message` and the first error. |

A part shows as follows:

| Part | The thread shows |
|---|---|
| `text` | The text, as a text node. Line breaks stay. |
| `component` | The element of the component, with the fill. A fill of a component with no element shows a refusal. |
| `status` | `Error: <text>`, and the code if it has one. The message stays partial. |
| `refusal` | `Refused: the thread did not show this part.` and the first error. |
| `fallback` | The fixed text of the fallback. |

If a run ends with `RUN_ERROR` and no message of the run shows the error, the thread shows the error as a system notice. If the stream has errors, the thread shows their count and the first error.

## Actions

An action in a component goes to `perform`, through the `mu-action` event of the element. The thread uses the action path of the element. It does not copy it.

1. The element shows `Pending`.
2. The thread calls `perform(request, message)`.
3. The thread gives the receipt to `receipt()` of the element, with the id of the request. Only then does the element show `Done` or `Not done`.
4. If `perform` fails, the thread gives a receipt with `ok` equal to `false` and the message `The request failed.`
5. If the element refuses the receipt, for example because its message is too long, the thread gives a receipt with `ok` equal to `false` and the message `The thread refused the receipt.`

A new event never replaces the element of a component part that did not change. The key order of a fill is not a change. Thus the same fill again cannot make a done action start again.

A snapshot never replaces a pending action or an open confirm step. The element stays until the receipt comes back or the step closes, so a person cannot send the request a second time. After that, the thread shows the new part.

If a snapshot gives a new fill for the same action component and the binding is the same, the thread gives the fill to the same element. Then the rules of the element apply: a done action button stays done, and a form with new values can save again. If the binding or the component is different, the thread makes a new element.

## Accessibility

- The list of messages has the name `Thread`.
- One polite live region announces each new message, each end of a message, each refusal and each error. The text is short: the actor, the type and the new state. It has 120 characters maximum of the text of a message. If one update has many items, the region gives the refusals and the errors first, 8 maximum, then the last 4 messages, and the count of the others.
- A refusal is a refused message, a refused part, or a fill that its element refuses. The region also announces a refusal that replaces a part.
- An error is a `RUN_ERROR`, a failure of the source, or a new count of stream errors. An action element announces its own receipt.
- Focus does not move when a message arrives or changes.
- The colors come from the tokens. In forced colors, the borders and the state texts use system colors. Reduced motion removes each transition.

## Limits

- The thread keeps the limits of the reader: 1000 messages, 1000 runs and 1000000 characters of data.
- The thread updates the page one time for each frame, not one time for each event. On a hidden page, it updates after 100 ms. If the page becomes hidden before the frame, the update also comes after 100 ms.
- An event that changes no message, no run and no error gives no update. Examples are an unknown event, an ignored event and an error after the list of errors is full.
- The thread has no history input and no compose box. The application owns them. A message of a person comes as AG-UI events with an actor of the type `human`.
