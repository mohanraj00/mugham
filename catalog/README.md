# Component catalog

Each JSON file in this folder is the contract of one component. [schema/README.md](schema/README.md) gives the format.

| Contract | Element | Kind | Content |
|---|---|---|---|
| `text.json` | `mu-text` | primitive | A run of text. |
| `button.json` | `mu-button` | primitive | A button that sends a `mu-press` event. |
| `field.json` | `mu-field` | primitive | A labeled text input that sends a `mu-edit` event. |
| `stack.json` | `mu-stack` | primitive | A labeled group in one column or one row. |
| `grid.json` | `mu-grid` | primitive | A labeled group in columns. |
| `fact.json` | in `mu-card` | component | A label and a value. |
| `card.json` | `mu-card` | component | A title, a summary, a date and up to six facts. |
| `action-button.json` | `mu-action-button` | component | A button for one action. |
| `editable-form.json` | `mu-editable-form` | component | Up to 20 fields, submitted as one action. |
| `card-grid.json` | `mu-card-grid` | component | A labeled list of cards. |
| `citation.json` | `mu-citation` | component | A source name, a locator as text, an optional quote and an open button. |
| `excerpt.json` | `mu-excerpt` | component | A passage as text with a marked span, the source name, the locator as text and an open button. |

The contracts with `ai_content` set to `true` are `card`, `card-grid`, `citation`, `editable-form`, `excerpt` and `fact`. Each of them requires the authorship slot. `card`, `card-grid` and `citation` also accept the citation slot. `excerpt` requires the citation slot, because the slot gives the locator of the passage.

The span of an excerpt starts at `span_start` and stops before `span_end`. Both count code points of the passage, the same as each text limit of the kit. The element refuses a span that is empty or that goes past the end of the passage. [schema/README.md](schema/README.md#slots) gives the slots.

An application can register its own contract and element. [Application contracts](#application-contracts) gives the call and its limits.

The thread `mu-thread` has no contract in this folder, because a model does not fill it. A model sends events, and the catalog validates each component part of an event. [src/thread/README.md](../src/thread/README.md) is the contract of the thread.

## Application contracts

An application can add a domain component without a change to this folder. It registers a contract and an element class with one call:

```js
import { MuElement, define, register } from './src/components/index.js';
import { el } from './src/render/dom.js';
import SEED_TRAY from './seed-tray.json' with { type: 'json' };

class SeedTray extends MuElement {
  static component = 'seed-tray';
  render(data) {
    return [el('article', { 'aria-label': data.label }, el('p', {}, data.label))];
  }
}

define();
register(SEED_TRAY, SeedTray); // Gives 'mu-app-seed-tray'.
```

`register(contract, element, elements = customElements)` does these steps:

1. It makes a copy of the contract. A later change to the object of the application has no effect.
2. It checks the copy with `contractErrors` in `src/render/validate.js`. That validator uses `schema/contract.schema.json` and the rules of `tools/catalog.py`. `tests/vectors/contracts.json` shows that the two give the same errors.
3. It defines the element as `mu-app-<name>`, and it keeps the frozen copy in the registry of `src/render/registry.js`.

The call fails with a `TypeError` and changes nothing in these conditions:

| Condition | Error |
|---|---|
| The contract is missing. | `register: a contract is necessary` |
| The contract is not JSON data. | `register: the contract must be JSON data` |
| The name is a catalog name. | `register: card is the name of a catalog contract` |
| The name is already registered. | `register: seed-tray is already registered` |
| The contract is not valid. | `register: the contract seed-tray is not valid: ` and each error of the validator |
| The element does not extend `MuElement`, replaces `fill` or `actor`, or has a different `static component`. | `register: the element of seed-tray ...` |
| The element name is already defined. | `register: the element name mu-app-seed-tray is already defined` |

After the call, the element, the envelope reader and the thread validate each fill against the catalog and the registered contracts. These rules stay true:

- The frozen `CATALOG` does not change. `CONTRACTS` in `src/render/registry.js` gives the catalog contracts and the registered contracts. A script cannot write it.
- An undeclared component stays refused. A registered component gets only a fill that its contract accepts.
- A component field of a registered contract can name a catalog contract or a contract that is already registered. A catalog contract never names a registered contract.
- If `ai_content` is `true`, the contract must declare a required authorship slot. The thread binds the actor of the envelope to the element, the same as for a catalog component. `provenance(slots)` from `src/components/index.js` shows the slots as text.

These are the limits of the call:

- A registration stays until the page closes. The kit has no call that removes a contract. Register each contract before the first fill of that component. A fill that the reader refused before the registration stays refused.
- The registry is global to the page. Each thread and each element of the page reads the same registry.
- The thread binds no action to a registered component. Only `action-button` and `editable-form` send an action.
- Each element gets `fill` and `actor` as own accessors that cannot change. A class field with the name `fill` or `actor` makes the constructor of the element throw a `TypeError`, so it cannot replace the validation.
- If a script sets `actor` before the upgrade of an element, the constructor gives it to the setter. If a script sets `fill` before the upgrade, the element gives it to the setter in a microtask after its constructor. A newer fill replaces the early fill.
- The contract is in the registry before the definition of the element. Thus an element of the page that the definition upgrades reads the new contract. If the definition fails, the registry removes the contract.
- The element must make its nodes only with `el` and `text` from `src/render/dom.js`. Then a markup string in a text field shows as text. The kit cannot check the code of the element, so the application owns this rule.
- `tools/catalog.py` checks only the contracts in this folder. The application keeps its own contract files and its own tests.

[examples/register.html](../examples/register.html) registers the synthetic `seed-tray` contract and its element.

## Actions

This section is the one description of the action model. A contract declares no tool, and a fill names no action. The application binds the tool and the fixed arguments in code:

```js
button.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
```

### The binding

A binding has these keys. Only `tool` is necessary.

| Key | Content |
|---|---|
| `tool` | The tool name, for example `library.renew`. |
| `arguments` | The fixed arguments. Each value is a string, a number, or `true` or `false`. |
| `label` | The label of the action, 1 to 80 characters. |
| `description` | The description of an action button, 1 to 200 characters. |
| `title` | The title of an editable form, 1 to 120 characters. |
| `editable` | The names that an editable form can send, each with its label. |
| `confirm` | Optional. The confirm step: `{ message, label }`. `message` has 1 to 200 characters. `label` has 1 to 40 characters. |

The application gives the label of the action. The element refuses a fill with a different label: the `label` of an action button or the `submit_label` of an editable form. A binding with no label accepts no fill. Thus a fill cannot show "View details" on a button that sends a different action. The application also gives the `description` of an action button. The button refuses a fill with a different description, because a description can name the target of the bound arguments. A binding with no description accepts no fill with a description.

The fill keeps the label and the description, and the element compares them with the binding. The fill stays necessary for these reasons:

- The accessible name of each component comes from a required field of its contract. Thus a fill with no label is not valid.
- A validator that has no binding, for example `tools/catalog.py`, can check a fill.
- If a model or a service gives a different meaning, the element shows a refusal, and the person sees the error.

### The request and the receipt

A fill gives only data, so a model cannot select a tool. On a press, the element sends a `mu-action` event with an id, the tool and the arguments, and shows `Pending`. The application sends the request to its API. The response of that API is the receipt. The receipt does not come through the stream of the thread. When the receipt comes back, the application calls `element.receipt({ id, ok, message, reference })`. Only then does the element show `Done` or `Not done`. The element ignores a receipt with a different id.

| Key | Content |
|---|---|
| `id` | The id of the request. |
| `ok` | `true` if the API did the action. |
| `message` | Optional. A text of 200 characters maximum. |
| `reference` | Optional. A reference from the API, for example a record id. A text of 80 characters maximum. |

The element shows the message and the reference only as text, never as markup. If the message or the reference is too long, the element refuses the receipt, and the action stays pending.

A script can read `element.action.state`, but it cannot write it. A receipt confirms only the values of its request. If a person edits a field while the request is pending, the form does not show `Done` after the receipt. It asks for a new save. An edit after `Done` also lets the form save again.

### The confirm step

If the binding has `confirm`, a press does not send the action. The element shows the confirm step and the state `confirm`. The confirm step is a group with the name `message`. It has two buttons: `Cancel` and a button with the name `label`. The focus goes to `Cancel`.

- If the person presses the confirm button, the element sends the action and shows `Pending`.
- If the person presses `Cancel` or Escape, the element sends no action. It closes the confirm step.

After each of the two, the focus goes back to the action control. An edit in a form while the confirm step shows closes the step, and the form sends no action.

### The editable form

The editable form adds the field values to the arguments. A binding cannot give one name as a bound argument and as an editable field, because the form would show one value and send a different value.

A model can fill an editable form, so a fill can select the title, the field names and the labels. Thus the application gives the title of the form, the names that the form can send, and the label of each name:

```js
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' }, editable: { shelf: 'Shelf code', note: 'Note' } };
```

The form refuses a fill with a different `title`, because the title names the target of the bound arguments. A binding with no title accepts no form fill. The form also refuses a fill with no field that a person can edit, because only the application labels of the fields tell what the request does. The form also refuses a fill with a field name that `editable` does not give, or with a field label that is not the label in `editable`. The form does not send the value of a disabled field, because a person cannot edit it. A new fill lets the form save again, because a receipt from before the fill does not confirm the new values. This check occurs when the fill or the binding changes. A binding with no `editable` map accepts no field. If a second submit occurs while a request is pending, the form refuses it. The refused submit does not change the values of the pending request.
