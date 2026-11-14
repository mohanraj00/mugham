# Contracts

This guide shows what a contract declares, how the kit checks a fill, and how an application adds its own contract. The code is in [examples/guides/contracts.js](../../examples/guides/contracts.js). `tools/browser_check.mjs` opens that page and checks each result that this guide gives.

## What a contract declares

A contract is one JSON file. It declares the data of one component, and nothing else can go into a fill of that component. The catalog contracts are in [catalog/](../../catalog/README.md). [catalog/schema/README.md](../../catalog/schema/README.md) gives the full format.

| Key | Content |
|---|---|
| `format` | Always `2`. |
| `name`, `version`, `kind`, `description` | The name of the component, its version, `primitive` or `component`, and one sentence. |
| `ai_content` | `true` if the component can show content from a model. Then the contract must declare a required authorship slot. |
| `slots` | The provenance slots: `authorship`, `citation` or the two. |
| `data` | The data fields. Each field has a type, a label, `required` and its limits. A text field always has `max_length`. |
| `states` | The states that the component can show, for example `default`, `pending`, `done` and `refused`. |
| `tokens` | The design tokens that the component uses. [Theme the kit](theme.md) lists them. |
| `accessibility` | The role, the field that gives the accessible name, the keys, forced colors and reduced motion. |

This is a contract of an application. It declares a count of birds at one site:

<!-- source: examples/guides/bird-count.json -->
```json
{
  "format": 2,
  "name": "bird-count",
  "version": "0.1.0",
  "kind": "component",
  "description": "A count of birds at one survey site on one day.",
  "ai_content": true,
  "slots": {
    "authorship": {
      "required": true
    }
  },
  "data": {
    "site": {
      "type": "text",
      "label": "Site",
      "required": true,
      "min_length": 1,
      "max_length": 80
    },
    "date": {
      "type": "date",
      "label": "Date",
      "required": true
    },
    "count": {
      "type": "integer",
      "label": "Count",
      "required": true,
      "minimum": 0,
      "maximum": 300
    }
  },
```

A contract declares no action, no markup and no style. A model can fill only a declared component, with data that the contract accepts.

## A fill

A fill has the keys `component`, `version`, `data` and the optional `slots`. It has no other key. This fill shows a card with one fact, the authorship slot and the citation slot:

<!-- source: examples/guides/contracts.js -->
```js
const AGENT = { type: 'agent', id: 'agent-notes', name: 'Note helper' };
const card = document.createElement('mu-card');
card.actor = AGENT;
card.fill = {
  component: 'card',
  version: '0.1.0',
  data: {
    title: 'Tide table for the north pier',
    summary: 'High water at 06:10 and at 18:40.',
    facts: [{ component: 'fact', version: '0.1.0', data: { label: 'Pier', value: 'North' } }],
  },
  slots: {
    authorship: AGENT,
    citation: { source: 'Synthetic tide notes, page 2', locator: 'https://example.org/tides#page-2' },
  },
};
main.append(card);
```

Expected result:

- The page shows an article with the name `Tide table for the north pier`.
- The card shows `Author: agent agent-notes (Note helper)` and `Source: Synthetic tide notes, page 2`.
- The card shows the locator as text. The locator opens only after a person presses the button `Open source: Synthetic tide notes, page 2`.

A nested fill, for example the fact, has no `slots` key. It takes the slots of its outer fill.

## The check and the refusal

Each element checks a fill with `fillErrors` of `src/render/validate.js` before it renders. The validator gives each error with a path. It does not change the fill. `tools/catalog.py` gives the same errors for each case in `tests/vectors/fills.json`.

<!-- source: examples/guides/contracts.js -->
```js
const tide = (data, slots = { authorship: AGENT }) => ({ component: 'card', version: '0.1.0', data, slots });
const bad = {
  'an undeclared component': { component: 'banner', version: '0.1.0', data: {} },
  'an undeclared field': tide({ title: 'Tide table', style: 'color: red' }),
  'an actions key of format 1': { ...tide({ title: 'Tide table' }), actions: [] },
  'no authorship slot': tide({ title: 'Tide table' }, {}),
  'a title that is too long': tide({ title: 'x'.repeat(121) }),
};
const list = document.getElementById('errors');
for (const [name, fill] of Object.entries(bad)) {
  list.append(el('li', {}, `${name}: ${fillErrors(fill, CONTRACTS)[0]}`));
}
```

Expected result. The list shows these lines:

```text
an undeclared component: component: no contract has the name banner
an undeclared field: data.style: the contract does not declare this field
an actions key of format 1: actions: unknown key
no authorship slot: slots.authorship: a required slot is missing
a title that is too long: data.title: more than 120 characters
```

If an element gets a fill with an error, it shows `Refused <name>: <first error>` as text. It sets `data-state` to `refused`, keeps no data and sends a `mu-refused` event with all the errors.

## Text stays text

The kit shows each text value as text. Markup in a fill makes no element:

<!-- source: examples/guides/contracts.js -->
```js
const markup = document.createElement('mu-card');
markup.actor = AGENT;
markup.fill = tide({ title: '<b>Bold tide</b>' });
main.append(markup);
```

Expected result: the card shows the title `<b>Bold tide</b>` as text. Its shadow root has no `b` element.

## The authorship slot and the bound actor

The authorship in a fill is a claim of its sender. The application or the thread sets the `actor` property of the element to the trusted actor. The element refuses a fill whose authorship does not name that actor:

<!-- source: examples/guides/contracts.js -->
```js
const claim = document.createElement('mu-card');
claim.actor = AGENT;
claim.fill = tide({ title: 'Tide table' }, { authorship: { type: 'human', id: 'u-robin', name: 'Robin' } });
main.append(claim);
```

Expected result: the card shows `Refused card: slots.authorship: the author is not the bound actor`. Thus an agent cannot name a person as the author of its content.

Set `actor` before `fill`. If no actor is bound, the element refuses each fill with an authorship slot. `mu-thread` binds the actor of the envelope to each component element.

## The citation slot

The citation slot has `source`, a name of 1 to 120 characters, and `locator`, an `https:` address. The kit shows the two as text and makes no link. A press on `Open source` sends a cancelable `mu-open` event with the locator. If the application does not cancel the event, the browser opens the locator in a new tab with no opener. `card`, `card-grid` and `citation` accept the slot. `excerpt` requires it.

## Format 2 and the action binding

Format 2 removed the `actions` block of a contract and the `actions` list of a fill. A fill with an `actions` key is refused, as the list above shows. The application binds the tool in code, so a model cannot select a tool:

<!-- source: examples/guides/assemble.js -->
```js
renew.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
```

The label of the fill must be the label of the binding. [The catalog README](../../catalog/README.md#actions) gives each key of a binding, the confirm step and the receipt. [Assemble a page](assemble.md) shows the request and the receipt.

## An application contract and element

An application registers its contract and its element with one call. The element extends `MuElement` and makes its nodes only with `el` from `src/render/dom.js`:

<!-- source: examples/guides/contracts.js -->
```js
class BirdCount extends MuElement {
  static component = 'bird-count';
```

<!-- source: examples/guides/contracts.js -->
```js
  render(data) {
    return [el('article', { 'aria-label': data.site },
      el('p', {}, data.site),
      el('p', {}, `${data.count} birds on ${data.date}`),
      el('div', { class: 'muted' }, provenance(this.fill.slots)))];
  }
}
register(BIRD_COUNT, BirdCount); // Defines mu-app-bird-count.
```

The element reads only the data that the contract accepts. `render` gets the data after the check.

<!-- source: examples/guides/contracts.js -->
```js
const count = (value) => {
  const node = document.createElement('mu-app-bird-count');
  node.actor = AGENT;
  node.fill = { component: 'bird-count', version: '0.1.0', data: { site: 'East marsh', date: '2026-11-02', count: value },
    slots: { authorship: AGENT } };
  return node;
};
main.append(count(42), count(500));
```

Expected result:

- The first element shows an article with the name `East marsh` and the text `42 birds on 2026-11-02`.
- The second element shows `Refused bird-count: data.count: more than the maximum 300`.

`register` fails with a `TypeError` and changes nothing if the contract is not valid, if the name is already used, or if the element is not a correct subclass. [Application contracts](../../catalog/README.md#application-contracts) gives each condition and each limit. A registered contract stays until the page closes.

## Run the page

1. Start a static server at the root of the repository:

```sh
python3 -m http.server 8000
```

2. Open `http://localhost:8000/examples/guides/contracts.html`.
