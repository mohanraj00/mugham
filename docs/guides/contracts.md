# Contracts

This guide shows what a contract declares, how the kit checks a fill, and how an application adds its own contract. The code is in [examples/guides/contracts.js](../../examples/guides/contracts.js). `tools/browser_check.mjs` opens that page and checks each result that this guide gives.

## What a contract declares

A contract is one JSON file. It declares the data of one component, and nothing else can go into a fill of that component. The catalog contracts are in [catalog/](../../catalog/README.md). [catalog/schema/README.md](../../catalog/schema/README.md) gives the full format.

| Key | Content |
|---|---|
| `format` | Always `2`. |
| `name`, `version`, `kind`, `description` | The name of the component, its version, `primitive` or `component`, and one sentence. |
| `ai_content` | `true` if the component can show content from a model. Then the contract must declare a required authorship slot. |
| `field` | Optional. Use `true` if the element supplies an input to an editable form. |
| `slots` | The provenance slots: `authorship`, `citation` or the two. |
| `data` | The data fields. Each field has a type, a label, `required` and its limits. A text field always has `max_length`. |
| `states` | The states that the component can show, for example `default`, `pending`, `done` and `refused`. |
| `tokens` | The design tokens that the component uses. [Theme the kit](theme.md) lists them. |
| `accessibility` | The role, the field that gives the accessible name, the keys, forced colors and reduced motion. |

The table shows the full form of a contract, which is format 2. A contract can also have the short form. The short form omits each value that is equal to a default, for example the version, the authorship slot, and the label of a field that is equal to its key. `register` accepts the two forms. [The short form](../../catalog/schema/README.md#short-form-format-3) gives the defaults.

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
const { mount, outer } = createKit({ actor: AGENT });
mount('card', {
  title: 'Tide table for the north pier',
  summary: 'High water at 06:10 and at 18:40.',
  facts: [fill('fact', { label: 'Pier', value: 'North' })],
}, { parent: main, slots: { citation: { source: 'Synthetic tide notes, page 2', locator: 'https://example.org/tides#page-2' } } });
```

Expected result:

- The page shows an article with the name `Tide table for the north pier`.
- The card shows `Author: Note helper (agent, agent-notes)` and `Source: Synthetic tide notes, page 2`.
- The card shows the locator as text. The locator opens only after a person presses the button `Open source: Synthetic tide notes, page 2`.

A nested fill, for example the fact, has no `slots` key. It takes the slots of its outer fill.

## The check and the refusal

Use `validateFill` from `src/kit.js` to check a fill and get a list of errors with paths. Each element uses the same catalog checks before it renders. `tools/catalog.py` gives the same errors for each case in `tests/vectors/fills.json`.

<!-- source: examples/guides/contracts.js -->
```js
const bad = {
  'an undeclared component': { component: 'banner', version: '0.1.0', data: {} },
  'an undeclared field': outer('card', { title: 'Tide table', style: 'color: red' }),
  'an actions key of format 1': { ...outer('card', { title: 'Tide table' }), actions: [] },
  'no authorship slot': fill('card', { title: 'Tide table' }),
  'a title that is too long': outer('card', { title: 'x'.repeat(121) }),
};
const list = document.getElementById('errors');
for (const [name, value] of Object.entries(bad)) {
  list.append(el('li', {}, `${name}: ${validateFill(value)[0]}`));
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

If an element gets a fill with an error, it shows a short reason and tells the person to ask for the content again. The `Technical details` disclosure shows the component name and the errors as text. The element sets `data-state` to `refused`, keeps no fill and sends a `mu-refused` event with all the errors.

## Text stays text

The kit shows each text value as text. Markup in a fill makes no element:

<!-- source: examples/guides/contracts.js -->
```js
mount('card', { title: '<b>Bold tide</b>' }, { parent: main });
```

Expected result: the card shows the title `<b>Bold tide</b>` as text. Its shadow root has no `b` element.

## The authorship slot and the bound actor

The authorship in a fill is a claim of its sender. The application or the thread sets the `actor` property of the element to the trusted actor. The element refuses a fill whose authorship does not name that actor:

<!-- source: examples/guides/contracts.js -->
```js
const claim = mount('card', { title: 'Tide table' });
claim.fill = fill('card', { title: 'Tide table' }, { slots: { authorship: { type: 'human', id: 'u-robin', name: 'Robin' } } });
main.append(claim);
```

The card shows a refusal. Open `Technical details` to see `card: slots.authorship: the author is not the bound actor`. Thus an agent cannot name a person as the author of its content.

Set `actor` before `fill`. If no actor is bound, the element refuses each fill with an authorship slot. `mu-thread` binds the actor of the envelope to each component element.

## The citation slot

The citation slot has `source`, a name of 1 to 120 characters, and `locator`, an `https:` address. The kit shows the two as text and makes no link. A press on `Open source` sends a cancelable `mu-open` event with the locator. If the application does not cancel the event, the browser opens the locator in a new tab with no opener. `card`, `card-grid` and `citation` accept the slot. `excerpt` requires it.

## Format 2 and the action binding

Format 2 removed the `actions` block of a contract and the `actions` list of a fill. A fill with an `actions` key is refused, as the list above shows. The application binds the tool in code, so a model cannot select a tool:

<!-- source: examples/guides/assemble.js -->
```js
const renewAction = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
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
for (const count of [42, 500]) {
  mount('bird-count', { site: 'East marsh', date: '2026-11-02', count }, { parent: main });
}
```

Expected result:

- The first element shows an article with the name `East marsh` and the text `42 birds on 2026-11-02`.
- The second element shows a refusal. Open its `Technical details` to see `bird-count: data.count: more than the maximum 300`.

`register` fails with a `TypeError` and changes nothing if the contract is not valid, if the name is already used, or if the element is not a correct subclass. [Application contracts](../../catalog/README.md#application-contracts) gives each condition and each limit. A registered contract stays until the page closes.

## Field protocol

Set `"field": true` in the contract and use `register(contract, Element)`. The editable form accepts each kit or registered component with this flag. Call `toolSchema('editable-form')` after registration to include the field in the tool schema.

Declare `name` and `label` in the field data. Use the action binding to give the form title, the editable names and their labels. If the field has typed edits, declare `typed` and agree with the binding. To show a local date and time with a fixed zone, declare `time_zone` and give the same zone in the binding. A nested fill takes the slots that it declares from the form. For example, a field that requires authorship receives the author of the form.

The element supplies these properties:

| Property | Value |
|---|---|
| `value` | The current value. Use text, a finite number, a boolean, a list of up to 500 texts of up to 80 characters each, or a pair of finite numbers in low to high order. Use empty text for an empty text value. |
| `validationMessage` | Empty text for a valid value. For an invalid value, give a short error message. |
| `disabled` | A boolean. Use `true` when the person cannot edit the field. The form leaves a disabled field out of the request. |
| `editType` | `judgment`, `correction` or `override` when a person chooses the type of a changed typed edit. Use `null` when there is no type. |

Send a bubbling, composed `mu-edit` event from the field after a change of value or edit type. The form reads the properties of the element. It uses the event to record the time and to let the person submit again after an edit. The form reads the action arguments through `values()`. The protocol uses regular custom elements.

For an invalid value, the form shows `validationMessage` and focuses the field. Set `static focus = true` to move focus from the field to its control. An element can supply `reportValidity()` to show its own message and focus its control. Return `true` for a valid value or `false` after you show an error. For a missing edit type, the form shows `Choose an edit type.` An element can supply `needType()` to show that message and focus its edit type control.

The [color example](../../examples/forms/colors.html) registers a [field contract](../../examples/forms/color-field.json) with three fixed colors. Its [element](../../examples/forms/colors.js) extends `FieldElement` from `src/primitives/index.js`. That class supplies the protocol, the label and the error display. The example supplies a native select, reads the selected value and calls `changedValue()` when the selection changes. An element can also extend `MuElement` and supply the properties and event itself.

Press **Save label** before you choose a color. The field shows **Choose a label color.** and the select takes focus. Choose **Reed green** and press **Save label** again. The request shows `{"color":"reed_green"}`, and the form shows **Done** after the receipt.

## A composite contact card

The [contact example](../../examples/forms/contact.html) registers a [contact card contract](../../examples/forms/contact-card.json). Its [element](../../examples/forms/contact.js) extends `MuElement` and uses `mount` to make a `field` for the name, a `choice-field` for the contact method and an `action-button` to save. The card appends the three elements to an article in its shadow root.

The card listens for `mu-edit` and binds the current name and method to `contacts.save`. The page uses `onAction` to read the request and return a receipt.

The card starts with **Contact A1** and **Email**. Enter **Contact B2**, choose **Phone**, and press **Save contact**. The request shows `{"contact_name":"Contact B2","method":"Phone"}`, and the button shows **Done** after the receipt. If you edit a value while the save is pending, the receipt confirms only the sent values. The button then shows **Save contact** again for the new values.

## Run the page

1. Start a static server at the root of the repository:

```sh
python3 tools/serve.py
```

2. Open `http://localhost:8000/examples/guides/contracts.html`.
