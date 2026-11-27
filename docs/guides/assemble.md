# Assemble a page

This guide builds one page with a stack, a grid of two cards, an action with a receipt and a thread for people and agents. The page is [examples/guides/assemble.html](../../examples/guides/assemble.html), and its code is [examples/guides/assemble.js](../../examples/guides/assemble.js). `tools/browser_check.mjs` opens the page and checks each expected result of this guide.

The page acts as the application. A synthetic function acts as the API. All data is synthetic.

## Before you start

1. Install Python 3 and Git. Use a browser from the [browser support](../../README.md#browser-support) list.
2. Clone the repository and go to its root.
3. Start a static server at the root:

```sh
python3 tools/serve.py
```

4. Open `http://localhost:8000/examples/guides/assemble.html`.

The kit imports JSON files as ES modules, and a browser blocks module imports from a `file:` page. Thus the page needs an HTTP server. Serve `src/` and `catalog/` from the same origin as the page. The kit has no dependency and no build step.

## Step 1: load the tokens

The page loads `src/tokens/tokens.css` before the kit code, then the default page style `src/styles/page.css`. The tokens give the colors, the type, the spaces and the motion of each element. The page has a strict content security policy. The kit needs no inline script and no inline style.

<!-- source: examples/guides/assemble.html -->
```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'">
  <title>Mugham guide: assemble a page</title>
  <link rel="stylesheet" href="../../src/tokens/tokens.css">
  <link rel="stylesheet" href="../../src/styles/page.css">
  <link rel="stylesheet" href="../page.css">
  <script type="module" src="assemble.js"></script>
```

Expected result: the page uses the light tokens or the dark tokens, as the browser theme says. [Theme the kit](theme.md) gives each token.

## Step 2: define the elements

<!-- source: examples/guides/assemble.js -->
```js
import { define } from '../../src/components/index.js';
import { createKit, fill, mount, onAction } from '../../src/kit.js';
import { define as defineThread } from '../../src/thread/index.js';
import EVENTS from './assemble-events.json' with { type: 'json' };

// Step 2: define the elements. The components define also defines the primitives.
define();
defineThread();
```

Expected result: the custom elements `mu-text`, `mu-button`, `mu-field`, `mu-stack`, `mu-grid`, `mu-card`, `mu-action-button`, `mu-editable-form`, `mu-card-grid`, `mu-citation`, `mu-excerpt` and `mu-thread` are defined. A second call does nothing.

## Step 3: put cards in a stack and a grid

Use `mount` to create and fill an element. For cards, `createKit` binds the actor and adds its authorship to each outer fill.

<!-- source: examples/guides/assemble.js -->
```js
const AGENT = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };
const kit = createKit({ actor: AGENT });

const stack = mount('stack', { label: 'Loans of Robin', gap: 'large' });
const grid = mount('grid', { label: 'Current loans', min_column: 'medium' }, { parent: stack });
const card = (title, date, shelf) => kit.mount('card', {
  title, date, date_label: 'Due', facts: [fill('fact', { label: 'Shelf', value: shelf })],
}, { parent: grid });
const moss = card('Field guide to moss', '2026-12-01', 'B-14');
card('A short history of maps', '2026-12-09', 'A-31');
```

Expected result: a group with the name `Loans of Robin` holds a group with the name `Current loans`. That group holds two articles in columns. `mu-stack` and `mu-grid` put their child elements in a slot, so the page appends children in the usual way.

## Step 4: bind an action

A fill gives only the label of the button. The application binds the tool and the fixed arguments in code. The label of the binding must be the label of the fill. If not, the button refuses the fill.

<!-- source: examples/guides/assemble.js -->
```js
const renewAction = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
const renew = mount('action-button', { label: 'Renew' }, { parent: moss, slot: 'actions', action: renewAction });
```

Expected result: the moss card shows the `Renew` button in its `actions` slot. The button is in the state `default` and shows no status text.

## Step 5: send the request and give the receipt

A press sends a `mu-action` event. Its `detail` is the request: `id`, `tool` and `arguments`. The button shows `Pending`. The application sends the request to its API and returns the receipt to `onAction`. The helper gives the receipt to the element.

<!-- source: examples/guides/assemble.js -->
```js
let receipts = 0;
async function api(request) {
  await new Promise((done) => setTimeout(done, 300));
  receipts += 1;
  return { id: request.id, ok: true, message: 'The loan is renewed.', reference: 'R-' + String(receipts).padStart(4, '0') };
}

// Step 5: send the request and give the receipt to the element.
onAction(renew, (tool, args, id, request) => api(request));
```

Expected result:

1. A press on `Renew` shows `Pending` at once.
2. After the receipt, the button shows `Done: The loan is renewed.` and `Reference: R-0001`.

The helper checks each supplied `id` and `key` against the request. A valid receipt with `ok: false` gives `Not done` and the message. A valid receipt with `ok: true` can give `Done`. A failure before send gives its own reason. If the handler throws, its promise rejects or its result is invalid, the action stays pending. When the button offers Retry, it sends the same key with a new id. Cancel clears the pending action.

If the page talks to several services, give `service` and `code` in a refusal. The button then shows which service refused the action, and why, for example `Not done: The tray is full. Service: Seed orders. Code: tray-full.` The kit shows both values only as text. `serviceHandler` in [src/kit.md](../../src/kit.md) binds one handler to one base URL and one service name, and it maps the HTTP response of the service to a receipt.

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
3. One agent message shows the card `A short history of maps` with `Author: same as the message`. A screen reader reads `Author: Loan helper (agent, agent-loans)`.
4. The fill of the undeclared component `banner` shows as a refusal, as text.
5. A press on `Renew` in the thread shows `Pending`. After the receipt, it shows `Done: The loan is renewed.` and `Reference: R-0002`.
6. At the end of the source, `thread.state` is `ended`.

## One page with a region for each service

A page can show the data of several services. Give each service its own region, its own fixture or API, and its own action handler. The kit gives no shell or panel for the regions. The page code owns the layout. The page is [examples/apps/services.html](../../examples/apps/services.html), and its code is [examples/apps/services.js](../../examples/apps/services.js). It has three synthetic services: a catalog service, a loans service and a notices service.

1. Put the page in an `mu-app-shell`. Put one side link for each region in the `side` slot.
   Expected result: the page has a skip link, a `navigation` landmark with the name `Services` and a `main` landmark.
2. Put the regions in an `mu-stack` with the direction `row`. Make each region a `section` with `aria-labelledby` on its `h2`.
   Expected result: each region is a `region` landmark with the name of its service, for example `Catalog service`.
3. Read the data of each region only from the base URL of its service. Show the data as text.
   Expected result: the catalog region shows only catalog data, and the other regions show only their own data.
4. Bind the action of each region with `serviceHandler` and the base URL of that service. Use one handler for each region.
   Expected result: `Reserve tray T-12` goes only to `https://catalog.example.test/api/`. `Renew loan L-7` goes only to `https://loans.example.test/v2/`.
5. Press `Renew loan L-7`.
   Expected result: the button shows `Pending`, then `Not done: The loan has two renewals. Service: Loans service. Code: renewal-limit.`
6. Press Tab from the page heading.
   Expected result: the focus goes through the catalog region, then the loans region, then the notices region. Each focused control shows a focus ring. The page order is the keyboard order, so do not use a positive `tabindex`.
7. Make the window 375 px wide.
   Expected result: the side links move into a drawer that the `Menu` button opens. Each region uses the full width, one region below the other, with no horizontal scroll.

The page CSS sets the width of each region with `flex: 1 1 11rem`. At a wide width, the three regions show side by side. At a narrow width, the stack puts them in one column. In forced colors, each region border uses `CanvasText`. `tests/browser/services.js` checks each expected result at 1280 px and 375 px, on hover and on keyboard focus, with forced colors and reduced motion.

## Show run steps

Import `createRunSteps` from `src/kit.js` and give it the actor from trusted page data. Push each original event to the thread, then push the snapshots that the helper returns for that event. The thread can check each snapshot actor with `actorFor`. [Helper details](../../src/envelope/run-steps-events.md) and [run steps example](../../examples/thread/run-steps.html).

## Choose a form

| Component | When to use it | Which field values it sends |
|---|---|---|
| [`form-card`](../../catalog/form-card.json) | Use it to review a long form in sections. The card shows labels and values first. A person opens one field at a time to edit it. The card can show read-only values. | Only the changed field values. |
| [`editable-form`](../../catalog/editable-form.json) | Use it to enter or edit values in a form with up to 20 fields. The inputs are visible when the form opens. | The values of all enabled fields. |

The example page shows an editable form with a draft reply. [Action labels example](agents.md#action-labels)

## Check the page

`make check` runs `tools/browser_check.mjs`. That check opens this page in headless Chrome and checks each expected result above. To run only the browser check:

```sh
node tools/browser_check.mjs
```

The page uses a function as its API. A real application sends the request to its own API, as [examples/thread/thread.js](../../examples/thread/thread.js) and [examples/cards/approval.js](../../examples/cards/approval.js) show.

## Enable images

[The image example](../../examples/guides/image.html) loads a floor plan from the page origin. Set the page's Content Security Policy before the page loads its images. This page uses a meta element in the head. The server can also send the policy in a response header.

<!-- source: examples/guides/image.html -->
```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'">
```

Give the same permitted origins to the image component before it gets a fill.

<!-- source: examples/guides/image.js -->
```js
define();
MuImage.allowedOrigins = [location.origin];
```

The component checks the URL in the fill. The browser applies `img-src` to image requests, including redirects. If a permitted URL redirects to a different origin, the policy in this example blocks the request to that origin. The image shows its error state with its text alternative. [Image rules](../../src/components/image.md).
