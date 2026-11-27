# The thread

`mu-thread` shows one thread for people and agents. It reads AG-UI 1.0 events only through the reader of `src/envelope/`. [docs/contracts/envelope.md](../../docs/contracts/envelope.md) gives the envelope, the states and the limits. This file is the contract of the element.

The thread has no contract in `catalog/`. A model does not fill the thread. A model sends events, and each component part of an event is a fill that the catalog or a [registered contract](../../catalog/README.md#application-contracts) validates. Thus the catalog rules do not need a thread contract, and the contract format does not change.

## Use

```js
import { define } from './src/thread/index.js';

define();
const thread = document.querySelector('mu-thread');
thread.bind = (fill, message) => (fill.component === 'action-button' ? { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } } : undefined);
thread.perform = async (request, message, element) => postToTheApi(request);
await thread.read(events);
```

| Member | Content |
|---|---|
| `push(event)` | Gives one AG-UI 1.0 event to the reader. |
| `read(source)` | Reads each event of an async source, or of any iterable, in order. The promise resolves when the source ends. If the source fails, the thread shows a notice and the promise resolves. |
| `actorFor` | Optional. Set this function before you give the thread events. It takes a copy of the envelope and returns the trusted actor from application or transport context. The kit refuses the message if the function throws, gives an invalid actor, or gives a type or id that differs from the envelope actor. The application owns the trusted context. |
| `bind` | Optional. A function `(fill, message)` that gives the action binding of an `action-button`, an `editable-form`, a `form-card`, a `data-grid` or an `upload` part. A `data-grid` binding has `tool`, `arguments`, `title`, `rows` and `columns`. An `upload` binding has `tool`, `arguments`, `label`, `accept`, `max_size` and `max_files`. [The catalog README](../../catalog/README.md#actions) gives the binding. If it gives no binding, the element shows as disabled and sends no action. If the fill does not agree with the binding, the element refuses the fill. |
| `bindCardAuthor` | Optional. Set this function before you give the thread its events. For a card part that claims a different author, `(fill, message)` returns the author from a trusted application source. The author has a `type`, an `id` and an optional `name`. Return `undefined` when the source gives no author. In a message of an agent or a system, the thread refuses a card whose bound author has the type `human`. |
| `perform` | Optional. An async function `(request, message, element)` that sends the request to the API of the application and gives its receipt. With an offline queue, give `(request, message, element) => queue.perform(request, element)`, so the element shows the detail of its pending state. The request of an upload also has `file`, and `perform` sends that file. If it is not set, the `mu-action` event or the `mu-upload` event goes up to the page, and the page calls `receipt()` of the element. |
| `messages` | A copy of the envelopes, in the order of the thread. |
| `state` | `idle`, `reading`, `ended` or `failed`. The element also sets `data-state` to this value. |
| `clamp` | Optional page policy for plain text parts. `null` shows full text. An integer from 1 to 20 adds a visual line limit and a Read more button. |

[Read more](../components/read-more.md) gives the labels, the keyboard rules and the resize rules. The page can set `read-more-label` and `read-less-label` attributes on the thread. A fill cannot set these labels. A text delta keeps the same button, focus and open state.

The transport is the application's. The thread defines no transport and parses no text.

## Messages

Each message is a list item with an article. The article has the name `Message from <name>, <type>`.

- The header shows the actor name and the actor type. If the actor has no name, the header shows the actor id. The type text is `Person` for `human`, `Agent` for `agent` and `System` for `system`.
- The thread takes the actor only from the envelope. The AG-UI `role` never changes the actor. The content of an agent never shows as the content of a person.
- The thread binds the envelope actor to each component before it sets the fill. For a card part, the application can use `bindCardAuthor` to bind a different verified author. Verify this author with a trusted application source that identifies the author of the card. An authorship claim in a fill is data from the model and cannot verify itself. The thread never binds a person as the author of a card in a message of an agent or a system. It refuses that card.
- A fill of a contract with `ai_content` set to `true` must have an authorship slot with the `type` and the `id` of the bound actor. If the slot has a `name`, it must match the bound actor's name. The thread or the element refuses a claim that fails this check.
- A card in a thread uses a subtle surface and keeps its article label. When the card author and the message actor have the same type and id, the visible author line shows `Author: same as the message`. A screen reader reads the full author. A different verified author shows in full.
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
| `refusal` | `This content did not show because it did not match the rules of the application.` Then the next step and a closed `Technical details` disclosure. |
| `fallback` | The fixed text of the fallback. |

If a run ends with `RUN_ERROR` and no message of the run shows the error, the thread shows the error as a system notice. If the stream has errors, the thread shows their count and the first error.

Each refused part shows its reason in `reason` and the next step in `next`. The `details` part contains the component name, if available, and the errors as plain text. Use the disclosure label to open it with a keyboard. Use its `Copy` button to copy that text. [Interaction details](../components/interaction.md#empty-and-refused-states) gives the display rules.

## Actions

An action in a component goes to `perform`, through the `mu-action` event of the element. The thread uses the action path of the element. It does not copy it.

1. The element shows `Pending`.
2. The thread calls `perform(request, message, element)`.
3. The thread checks the receipt. A supplied id or key must match this request. If the receipt omits the id, the thread adds it after the other fields pass the check. The thread then calls `receipt()` of the element. A valid receipt with `ok: true` can show `Done`. A valid receipt with `ok: false` shows `Not done`.
4. If `perform` throws, its promise rejects or the receipt is invalid or refused, the request stays pending. An action button or form offers Retry and Cancel after a try with no receipt. Retry keeps the key and uses a new id. A file with no receipt still shows `Uploading`.

A new event never replaces the element of a component part that did not change. The key order of a fill is not a change. Thus the same fill again cannot make a done action start again.

A snapshot never replaces a pending action or an open confirm step. The element stays until the receipt comes back or the step closes, so a person cannot send the request a second time. After that, the thread shows the new part.

If a snapshot gives a new fill for the same action component and the binding is the same, the thread gives the fill to the same element. Then the rules of the element apply: a done action button stays done, and a form with new values can save again. If the binding or the component is different, the thread makes a new element.

If a refused snapshot replaces a completed action button, the thread keeps its result. The result returns with the button when a valid fill has the same message position and application binding.

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

## Long thread bench

Run `node tools/thread_bench.mjs` to get the JSON report. To use the pinned Chrome build of CI, set `CHROME` to the executable for the version in [the CI workflow](../../.github/workflows/ci.yml). The report gives the Chrome version.

The bench loads threads of 500 and 1000 synthetic messages. A third case loads 500 messages with a 200-row data grid. Each count includes the message that receives a long stream of text. After 10 warm-up updates, each case measures 60 updates with one text delta per frame. The page is 1280 by 800 CSS pixels.

The report gives each update time, the median and the 95th percentile. It also gives the render times for the history and the message end marker, and the total elapsed time between them, with the wait for each frame. The update time includes the thread render and layout. Event input, the wait for a frame and paint are outside that time. The report gives the JavaScript heap size and, where Chrome supplies it, the embedder heap size in bytes. It measures them before and after the case, after garbage collection each time.

The target is a 95th percentile below 16 ms for a text update in the 500-message case without the grid. The browser check fails above 32 ms for this case. The 16 ms margin allows one more frame for load on a shared CI runner. The 1000-message case and the grid case give measurements for comparison.
