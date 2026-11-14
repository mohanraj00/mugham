# Assemble a page

This guide builds one page with a stack, a grid of two cards, an action with a receipt and a thread for people and agents. The page is [examples/guides/assemble.html](../../examples/guides/assemble.html), and its code is [examples/guides/assemble.js](../../examples/guides/assemble.js). `tools/browser_check.mjs` opens the page and checks each expected result of this guide.

The page acts as the application. A synthetic function acts as the API. All data is synthetic.

## Before you start

1. Install Python 3 and Git. Use a browser from the [browser support](../../README.md#browser-support) list.
2. Clone the repository and go to its root.
3. Start a static server at the root:

```sh
python3 -m http.server 8000
```

4. Open `http://localhost:8000/examples/guides/assemble.html`.

The kit imports JSON files as ES modules, and a browser blocks module imports from a `file:` page. Thus the page needs an HTTP server. Serve `src/` and `catalog/` from the same origin as the page. The kit has no dependency and no build step.

## Step 1: load the tokens

The page loads `src/tokens/tokens.css` before the kit code. The tokens give the colors, the type, the spaces and the motion of each element. The page has a strict content security policy. The kit needs no inline script and no inline style.

<!-- source: examples/guides/assemble.html -->
```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'">
  <title>Mugham guide: assemble a page</title>
  <link rel="stylesheet" href="../../src/tokens/tokens.css">
  <link rel="stylesheet" href="../page.css">
  <script type="module" src="assemble.js"></script>
```

Expected result: the page uses the light tokens or the dark tokens, as the browser theme says. [Theme the kit](theme.md) gives each token.

## Step 2: define the elements

<!-- source: examples/guides/assemble.js -->
```js
import { define } from '../../src/components/index.js';
import { define as defineThread } from '../../src/thread/index.js';
import EVENTS from './assemble-events.json' with { type: 'json' };

// Step 2: define the elements. The components define also defines the primitives.
define();
defineThread();
```

Expected result: the custom elements `mu-text`, `mu-button`, `mu-field`, `mu-stack`, `mu-grid`, `mu-card`, `mu-action-button`, `mu-editable-form`, `mu-card-grid`, `mu-citation`, `mu-excerpt` and `mu-thread` are defined. A second call does nothing.

## Step 3: put cards in a stack and a grid

Each element gets its content only through its `fill` property. Set `actor` before `fill` for a component with an authorship slot.

<!-- source: examples/guides/assemble.js -->
```js
const AGENT = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };
const fill = (component, data, slots) => ({ component, version: '0.1.0', data, ...(slots ? { slots } : {}) });
const make = (tag, value, actor = null) => {
  const node = document.createElement(tag);
  node.actor = actor;
  node.fill = value;
  return node;
};

const stack = make('mu-stack', fill('stack', { label: 'Loans of Robin', gap: 'large' }));
const grid = make('mu-grid', fill('grid', { label: 'Current loans', min_column: 'medium' }));
const card = (title, date, shelf) => make('mu-card', fill('card', {
  title, date, date_label: 'Due', facts: [fill('fact', { label: 'Shelf', value: shelf })],
}, { authorship: AGENT }), AGENT);
const moss = card('Field guide to moss', '2026-12-01', 'B-14');
const maps = card('A short history of maps', '2026-12-09', 'A-31');
grid.append(moss, maps);
stack.append(grid);
```

Expected result: a group with the name `Loans of Robin` holds a group with the name `Current loans`. That group holds two articles in columns. `mu-stack` and `mu-grid` put their child elements in a slot, so the page appends children in the usual way.

## Step 4: bind an action

A fill gives only the label of the button. The application binds the tool and the fixed arguments in code. The label of the binding must be the label of the fill. If not, the button refuses the fill.

<!-- source: examples/guides/assemble.js -->
```js
const renew = make('mu-action-button', fill('action-button', { label: 'Renew' }));
renew.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
renew.slot = 'actions';
moss.append(renew);
```

Expected result: the moss card shows the `Renew` button in its `actions` slot. The button is in the state `default` and shows no status text.

## Step 5: send the request and give the receipt

A press sends a `mu-action` event. Its `detail` is the request: `id`, `tool` and `arguments`. The button shows `Pending`. The application sends the request to its API. The response of the API is the receipt. Give it to the element with `receipt()`.

<!-- source: examples/guides/assemble.js -->
```js
let receipts = 0;
async function api(request) {
  await new Promise((done) => setTimeout(done, 300));
  receipts += 1;
  return { id: request.id, ok: true, message: 'The loan is renewed.', reference: 'R-' + String(receipts).padStart(4, '0') };
}

// Step 5: send the request and give the receipt to the element.
renew.addEventListener('mu-action', async (event) => {
  renew.receipt(await api(event.detail));
});
```

Expected result:

1. A press on `Renew` shows `Pending` at once.
2. After the receipt, the button shows `Done: The loan is renewed.` and `Reference: R-0001`.

The element ignores a receipt with a different `id`. If `ok` is `false`, the element shows `Not done` and the message. The element shows `Done` only after the receipt. If the request fails, give a receipt with `ok` set to `false`. If not, the action stays pending.

## Step 6: add the thread

`mu-thread` shows the messages of people and agents. It needs two functions of the application:

- `bind(fill, message)` gives the binding of each `action-button` or `editable-form` part. If it gives no binding, the element shows as disabled.
- `perform(request, message)` sends the request to the API and gives the receipt. The thread gives the receipt to the element.

<!-- source: examples/guides/assemble.js -->
```js
thread.bind = (part) => (part.component === 'action-button'
  ? { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0002' } } : undefined);
thread.perform = (request) => api(request);
```

## Step 7: read an event source

The thread reads AG-UI 1.0 events from an async source or from any iterable. The transport belongs to the application, for example server-sent events or a WebSocket. This source gives synthetic events from [assemble-events.json](../../examples/guides/assemble-events.json) with a short delay:

<!-- source: examples/guides/assemble.js -->
```js
async function* source(events) {
  for (const event of events) {
    await new Promise((done) => setTimeout(done, 40));
    yield event;
  }
}
thread.read(source(EVENTS));
```

An event gives the actor of its message in `metadata.mugham.actor`. A component part is an `ACTIVITY_SNAPSHOT` with `activityType` set to `mugham.fill`. Its `content` has `format` set to `2` and the fill. [docs/contracts/envelope.md](../contracts/envelope.md) gives each event and each limit.

Expected result:

1. Each message shows while its text streams. A message shows `Partial` until its end event.
2. The thread shows a message from `Robin, Person` and four messages from `Loan helper, Agent`.
3. One agent message shows the card `A short history of maps` with `Author: agent agent-loans (Loan helper)`.
4. The fill of the undeclared component `banner` shows as a refusal, as text.
5. A press on `Renew` in the thread shows `Pending`. After the receipt, it shows `Done: The loan is renewed.` and `Reference: R-0002`.
6. At the end of the source, `thread.state` is `ended`.

## Check the page

`make check` runs `tools/browser_check.mjs`. That check opens this page in headless Chrome and checks each expected result above. To run only the browser check:

```sh
node tools/browser_check.mjs
```

The page uses a function as its API. A real application sends the request to its own API, as [examples/thread.js](../../examples/thread.js) and [examples/approval.js](../../examples/approval.js) show.
