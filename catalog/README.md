# Component catalog

Each JSON file in this folder is the contract of one component. Each file has the short form: it states only the values that are not a default of [schema/defaults.json](schema/defaults.json). [schema/README.md](schema/README.md) gives the format, the defaults and the full form.

Each element that refuses a fill shows a short reason and the next step. Open `Technical details` to read or copy the component name and the validation errors. [Interaction details](../src/components/interaction.md#empty-and-refused-states) gives the display rules.

| Contract | Element | Kind | Content |
|---|---|---|---|
| `text.json` | `mu-text` | primitive | A run of text. |
| `button.json` | `mu-button` | primitive | A button that sends a `mu-press` event. |
| `field.json` | `mu-field` | primitive | A labeled text input that sends a `mu-edit` event. A typed field also asks for the edit type. |
| `long-text-field.json` | `mu-long-text-field` | primitive | A labeled text area for text of more than one line. |
| `number-field.json` | `mu-number-field` | primitive | A labeled input for a number, with an optional range. |
| `date-field.json` | `mu-date-field` | primitive | A labeled input for a date as `YYYY-MM-DD`, with an optional range. |
| `date-range-field.json` | `mu-date-range-field` | primitive | Two native date inputs for an ordered pair of dates. |
| `time-field.json` | `mu-time-field` | primitive | A native time input with optional limits and a step in minutes. |
| `date-time-field.json` | `mu-date-time-field` | primitive | A native input for a local date and time, with a fixed time zone label. |
| `choice-field.json` | `mu-choice-field` | primitive | A labeled radio group with 1 to 20 choices. |
| `toggle-field.json` | `mu-toggle-field` | primitive | A labeled checkbox or switch for a yes or no value. |
| `range-field.json` | `mu-range-field` | primitive | One or two sliders with a number box for each handle. |
| `select-field.json` | `mu-select-field` | primitive | A combobox for one choice, with search for long lists. |
| `multi-choice-field.json` | `mu-multi-choice-field` | primitive | Checkboxes or a searchable tag picker for multiple choices. |
| `stack.json` | `mu-stack` | primitive | A labeled group in one column or one row. |
| `grid.json` | `mu-grid` | primitive | A labeled group in columns. |
| `fact.json` | in `mu-card` | component | A label and a value. |
| `card.json` | `mu-card` | component | A title, a summary, a date and up to six facts, with optional collapse. See [Card rules](../src/components/card.md). |
| `action-button.json` | `mu-action-button` | component | A button for one action. |
| `editable-form.json` | `mu-editable-form` | component | Up to 20 fields, submitted as one action. |
| `form-line.json` | in `mu-form-card` | component | One field of a form card, with an optional line number and a read-only flag. |
| `form-section.json` | in `mu-form-card` | component | A titled group of up to 40 form lines. |
| `form-card.json` | `mu-form-card` | component | Up to 10 sections of form lines. A person reads the values and edits one field in place. The changes go as one action. |
| `card-grid.json` | `mu-card-grid` | component | A labeled list of cards, with optional Expand all and Collapse all controls. |
| `citation.json` | `mu-citation` | component | A source name, a locator as text, an optional quote and an open button. |
| `diff-change.json` | in `mu-diff` | component | One change: a label, the kind of the change, and the value before and after. |
| `diff-part.json` | in `mu-diff` | component | A titled part of a diff with up to 200 changes. A person opens and closes it. |
| `diff.json` | `mu-diff` | component | The difference between two versions of a text or a list of fields, in up to 20 parts. |
| `excerpt.json` | `mu-excerpt` | component | A passage as text with a marked span, the source name, the locator as text and an open button. |
| `source-status.json` | `mu-source-status` | component | The state of an offline data source as text, with the time of the last confirmed read and the reason. |
| `action-queue.json` | `mu-action-queue` | component | The actions of the offline queue, each with its state as text and its exits. The application fills it from its queue. [Offline queue](../docs/contracts/offline-queue.md) gives the rules. |
| `queued-action.json` | in `mu-action-queue` | component | One action of the offline queue: a key, a label, the state and an optional message. |
| `table.json` | `mu-table` | component | Text headers and rows, keyboard sorting and optional row status text. See [Table](../docs/table.md). |
| `table-row.json` | in `mu-table` | component | Text cells and optional status text. |
| `status.json` | `mu-status` | component | One state with short text, a fixed label and a border style. |
| `image.json` | `mu-image` | component | An image from a page-permitted origin, with a text alternative, a caption and a full-size dialog. [Image rules](../src/components/image.md) gives the page policy and the states. |
| `rich-text.json` | `mu-rich-text` | component | Rich text as a tree of typed nodes, never markup. [Rich text rules](../src/components/rich-text.md) gives the nodes, the link policy and the heading rule. |
| `rich-paragraph.json` | in `mu-rich-text` | component | A paragraph node with up to 50 inline nodes. Also the content of a list item and of a quote. |
| `rich-heading.json` | in `mu-rich-text` | component | A heading node with a relative level from 1 to 3. |
| `rich-list.json` | in `mu-rich-text` | component | A list node with bullets or numbers, and up to 50 items. |
| `rich-code.json` | in `mu-rich-text` | component | A code block node. The text shows as text. |
| `rich-quote.json` | in `mu-rich-text` | component | A quote node with up to 20 paragraphs. |
| `rich-span.json` | in `mu-rich-text` | component | An inline text node with one optional mark: emphasis, strong or code. |
| `rich-link.json` | in `mu-rich-text` | component | An inline link node. A button shows the link text, and the target shows on hover and on focus. |
| `data-grid.json` | `mu-data-grid` | component | An editable grid with column headers, row headers and typed cells. Each saved change is one action. [Data grid rules](../src/components/data-grid.md) gives the keys, the markers and the binding. |
| `data-grid-column.json` | in `mu-data-grid` | component | A column: a key, a label, the cell type, a read-only flag and the choices of a choice column. |
| `data-grid-row.json` | in `mu-data-grid` | component | A row: a key, a label and one cell for each column. |
| `text-cell.json`, `number-cell.json`, `date-cell.json`, `choice-cell.json` | in `mu-data-grid` | component | A cell with an optional value of its type and a read-only flag. |
| `upload.json` | `mu-upload` | component | An upload control. Page code binds the tool, the accepted types, the size limit and the file count. Each file shows `Done` only after its receipt. [Upload rules](../src/components/upload.md) gives the checks and the binding. |
| `chart.json` | `mu-chart` | component | SVG bar, line and stacked bar charts with a table view. See [Chart](../docs/chart.md). |
| `chart-series.json` | in `mu-chart` | component | A text label and up to 50 numeric values. Requires the authorship slot when used as an outer fill. |

The contracts with `ai_content` set to `true` are `card`, `card-grid`, `chart`, `chart-series`, `citation`, `diff`, `editable-form`, `excerpt`, `fact`, `form-card`, `image`, `status`, `table`, `table-row`, `rich-text` and its seven node contracts, `data-grid` with its column, row and cell contracts, and `upload`. Each of them requires the authorship slot. `card`, `card-grid` and `citation` also accept the citation slot. `excerpt` requires the citation slot, because the slot gives the locator of the passage.

The span of an excerpt starts at `span_start` and stops before `span_end`. Both count code points of the passage, the same as each text limit of the kit. The element refuses a span that is empty or that goes past the end of the passage. [schema/README.md](schema/README.md#slots) gives the slots.

A diff compares two versions as a list of changes. Each change has a `label`, for example a field name or `Line 3`, and a `change` kind. The element checks the values of each kind:

| Kind | Shows as | `before` | `after` |
|---|---|---|---|
| `added` | `Added` | Not given. | Necessary. |
| `removed` | `Removed` | Necessary. | Not given. |
| `changed` | `Changed` | Necessary. | Necessary, and different from `before`. |
| `unchanged` | `Unchanged` | Necessary. | Necessary, and the same as `before`. |

The kind shows as text, so it does not depend on color. A removed value has a line through it, and an added value has an underline. `before_label` and `after_label` name the two versions, for example `Version 3`. They are `Before` and `After` if the fill does not give them. An empty value shows `No value`. Each part is a `details` element. Enter or Space on its summary opens and closes it, and the summary shows the counts of each kind. If the diff has 20 changes or fewer, each part with a difference starts open. Else each part starts closed. A diff with no change shows the `empty` state and `No changes.`

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
2. It gets the full form of the copy with `resolveContract` in `src/render/resolve.js`. A contract can have the short form or the full form. Then it checks the full form with `contractErrors` in `src/render/validate.js`. That validator uses `schema/contract.schema.json` and the rules of `tools/catalog.py`. `tests/vectors/contracts.json` shows that the two give the same errors.
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
- The thread binds no action to a registered component. Only `action-button`, `editable-form` and `form-card` send an action.
- Each element gets `fill` and `actor` as own accessors that cannot change. A class field with the name `fill` or `actor` makes the constructor of the element throw a `TypeError`, so it cannot replace the validation.
- If a script sets `actor` before the upgrade of an element, the constructor gives it to the setter. If a script sets `fill` before the upgrade, the element gives it to the setter in a microtask after its constructor. A newer fill replaces the early fill.
- The contract is in the registry before the definition of the element. Thus an element of the page that the definition upgrades reads the new contract. If the definition fails, the registry removes the contract.
- The element must make its nodes only with `el` and `text` from `src/render/dom.js`. Then a markup string in a text field shows as text. The kit cannot check the code of the element, so the application owns this rule.
- `tools/catalog.py` checks only the contracts in this folder. The application keeps its own contract files and its own tests.

[examples/cards/register.html](../examples/cards/register.html) registers the synthetic `seed-tray` contract and its element.

## Card collapse

`card` accepts optional boolean keys `collapsible` and `collapsed`. Only `collapsible: true` adds a header toggle. `collapsed: true` sets the start state. Without `collapsible`, the card works as before. `status` is optional text of up to 120 characters. `collapsed_summary` is optional text of up to 200 characters.

A collapsed card shows the title, the status and the short summary. It hides the body and the actions. A card with a pending action, an action that waits for a receipt or an open confirm step stays expanded. A new pending action expands a collapsed card. The card sends `mu-collapse` with `{ collapsed }` on each state change. The event bubbles and crosses the shadow root. The kit saves no collapse state outside the element. A new fill uses its start state again.

`card-grid` accepts `collapse_controls: true` to show `Expand all` and `Collapse all`. Each button changes only cards with `collapsible: true`. The pending rule applies to each card. [Card rules](../src/components/card.md) gives the properties, focus rules and slots.

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
| `arguments` | The fixed arguments. Each value is text, a finite number, `true` or `false`, or a list of up to 500 texts. Each text in a list has at most 80 characters. |
| `label` | The label of the action, 1 to 80 characters. |
| `description` | The description of an action button, 1 to 200 characters. |
| `icon` | The icon of an action button. Use `check`, `cross`, `edit`, `delete`, `send` or `retry`. |
| `display` | The display of an action button. Use `text`, `icon` or `both`. |
| `title` | The title of an editable form, 1 to 120 characters. |
| `editable` | The names that an editable form or a form card can send, each with its label. Up to 400 names, because a form card has up to 10 sections of 40 fields. |
| `time_zones` | Optional. Maps names from `editable` to IANA time zone names, with one entry that matches the `time_zone` of each `date-time-field` in the fill. |
| `typed` | Optional. The editable names that need an edit type. See "Typed edits". |
| `editor` | The person who edits a typed form: `{ type: 'human', id }`. `id` has 1 to 128 characters. It is necessary if `typed` has a name. |
| `confirm` | Optional. The confirm step: `{ message, label }`. `message` has 1 to 200 characters. `label` has 1 to 40 characters. |

The binding of a `data-grid` has `tool`, `arguments`, `title`, `rows` and `columns`. The application gives the title of the grid, and the key, the label and the type of each row and column that a person can edit. [Data grid rules](../src/components/data-grid.md#action-and-receipt) gives the keys.

The binding of an `upload` has `tool`, `arguments`, `label`, `accept`, `max_size` and `max_files`. The application gives the label, the accepted types, the size limit and the file count. A fill cannot set the limits, and a fill with a different label is refused. The control sends a `mu-upload` event for each file, and the application sends the file. [Upload rules](../src/components/upload.md#binding) gives the keys.

The application gives the label of the action. The element refuses a fill with a different label: the `label` of an action button or the `submit_label` of an editable form. A binding with no label accepts no fill. Thus a fill cannot show "View details" on a button that sends a different action. The application also gives the `description` of an action button. The button refuses a fill with a different description, because a description can name the target of the bound arguments. A binding with no description accepts no fill with a description.

The application also gives the `icon` and `display` of a bound action button. If the binding gives one of these keys, the fill must give the same value. If the binding omits one of these keys, omit that key in the fill. To use the default text display, omit `display` in the binding and the fill, or set both to `text`. The button checks these values when it receives a fill or a binding.

The fill keeps these values, and the element compares them with the binding. The fill stays necessary for these reasons:

- The accessible name of each component comes from a required field of its contract. Thus a fill with no label is not valid.
- A validator that has no binding, for example `tools/catalog.py`, can check a fill.
- If a model or a service gives a different meaning, the element shows a refusal, and the person sees the error.

### The request and the receipt

A fill gives only data, so a model cannot select a tool. On a press, the element sends a `mu-action` event with an id, a key, the tool and the arguments, and shows `Pending`. The key stays the same for each try of the action, and each try has a new id. Use the key as the idempotency key of the API. The application sends the request to its API. Give the receipt to `element.receipt({ id, ok, message, reference })` outside the thread stream. A receipt must give the id of one of the pending tries, the key of the pending action, or both. If it gives both, both must match. A valid receipt with `ok: true` can show `Done`. A valid receipt with `ok: false` shows `Not done` and the reason. If a local check prevents the send, the status gives the local reason.

A pending action has an exit. If no receipt comes back in 30 seconds, the element shows `Pending: No receipt came back.` with the buttons `Retry` and `Cancel`. It stays pending, and a later receipt is still valid. `Retry` sends a `mu-action` event with the same key and a new id. `Cancel` sends a `mu-action-cancel` event that a listener can prevent. The element never shows `Done` without a receipt. [Offline queue](../docs/contracts/offline-queue.md) gives these rules and the queue that keeps an action while the device is offline.

| Key | Content |
|---|---|
| `id` | The id of one try of the pending action. |
| `key` | The key of the pending action. |
| `ok` | `true` if the API did the action, or `false` if the API rejected it. |
| `message` | Optional. A text of 200 characters maximum. |
| `reference` | Optional. A reference from the API, for example a record id. A text of 80 characters maximum. |

The element shows the message and the reference as text. A `Copy` button after the status copies the reference to the clipboard. An omitted message or reference is valid. If either field is present, it must be text within its limit. If the element refuses a receipt, the action stays pending.

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

The form refuses a fill if a name in `time_zones` has no field with the same `time_zone` in the fill. The request sends the local date and time as text. The application keeps the time zone in the binding.

### Typed edits

Principle 4 of the constitution says that each form edit records its type. The edit types are these:

| Type | Meaning |
|---|---|
| `judgment` | The person chose a different value. The old value was not wrong. |
| `correction` | The old value was wrong. The new value corrects it. |
| `override` | The person replaced a value from a rule, a service or an agent with their own decision. |

A field with `typed: true` in its fill is a typed field. When a person changes the value of a typed field, the field shows a radio group with the name `Edit type`. The group has the three types. If the person changes the value back to the old value, the group closes, and the field has no edit.

The application gives the typed names and the person who edits, because the fill comes from a model:

```js
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' },
  editable: { due_date: 'Due date', note: 'Note' }, typed: ['due_date'], editor: { type: 'human', id: 'person-ana' } };
```

The form refuses a fill in which the `typed` flag of a field does not agree with `typed` of the binding. A binding with no `typed` list accepts no typed field. Each name in `typed` must be a name in `editable`.

If a typed field changed and has no edit type, a submit sends no action. The field shows `Choose an edit type.` as text, and the focus goes to the group. The type is not a decision of the kit. The application or its service reads the type and decides.

If the binding has a `typed` list, the request has an `edits` list with one edit for each typed field that changed:

| Key | Content |
|---|---|
| `field` | The field name. |
| `type` | `judgment`, `correction` or `override`. |
| `old_value` | The value of the fill, as the control shows it. For example, a text area changes a CRLF line break to LF. |
| `new_value` | The value that the request sends in `arguments`. |
| `actor` | The `editor` of the binding: `{ type: 'human', id }`. |
| `time` | The time of the last change of the value or the type, as an ISO 8601 text in UTC, for example `2026-11-15T09:30:00.000Z`. |

A field that did not change has no edit. A disabled field has no edit, because the form does not send its value. A change of the edit type after a request also makes the values new, so the receipt of that request does not show `Done`.

### Input types

An editable form accepts the twelve kit field contracts below and each registered contract with `field: true`. Each kit field has the data fields `name`, `label`, `hint`, `error`, `disabled` and `typed`. The [field protocol](../docs/guides/contracts.md#field-protocol) gives the rules for registered fields.

| Contract | Value | Other data | The request sends |
|---|---|---|---|
| `field` | Text of 200 characters at most. | | A string. |
| `long-text-field` | Text of 10000 characters at most, with line breaks. | | A string. |
| `number-field` | A number. | `minimum` and `maximum`, both optional. | A number, for example `12.5`. |
| `date-field` | A date as `YYYY-MM-DD`. | `earliest` and `latest`, both optional. | A string, for example `2026-12-01`. |
| `date-range-field` | Two dates as `YYYY-MM-DD`, with the start date first. | `earliest` and `latest`, both optional. | A list of two texts in start to end order. |
| `time-field` | A 24-hour time as `HH:MM`. | `earliest`, `latest` and `step`, all optional. | A string, for example `09:15`. |
| `date-time-field` | A local date and time as `YYYY-MM-DDTHH:MM`. | A required IANA `time_zone`, for example `Europe/Oslo`. | A string, for example `2028-04-12T09:30`. |
| `choice-field` | One of the choices. | `choices`: 1 to 20 unique texts. | The text of the choice. |
| `toggle-field` | A boolean. The default is `false`. | `display` can be `checkbox` (the default) or `switch`. | `true` or `false`. |
| `range-field` | A number for one handle, or a pair of numbers for two handles. | `minimum`, `maximum` and a positive `step`, all required. | A number or a pair in low to high order. |
| `select-field` | One of the choices. | `choices`: 1 to 500 unique texts. | The text of the choice, or empty text if there is no selection. |
| `multi-choice-field` | A list of unique choices in choice order. The default is an empty list. | `choices` has 1 to 500 unique texts. The optional `min_items` and `max_items` limit the number of selections. | A list of texts in choice order. |

Omit the value of a select field to start with no selection. Space, Enter, Up or Down opens the list. A list of more than seven choices has a search box that takes focus when the list opens. Search matches text in any part of a choice and ignores case. The field announces `No match` when the search has no result.

Up, Down, Home and End move the active option. Enter selects the active option and closes the list. Escape closes the list and returns focus to the control. Tab, Shift+Tab and a click outside the field close the list. These exits keep the current value.

A multi-choice field shows up to seven choices as native checkboxes in a group named by the label. Tab and Shift+Tab move between checkboxes. Space changes the focused checkbox. A longer list shows each selection as a tag with a button named `Remove <choice>`.

The search box opens the list when a person types, clicks it or presses Enter, Up or Down. Search ignores case and matches text in any part of a choice. The field announces `No match` when the search has no result. Up, Down, Home and End move the active option. Enter changes its selection and keeps the list open. Space enters a space in the search text. Escape closes the list and keeps focus in the search box. Tab, Shift+Tab and a click outside close the list. A button press removes its tag and moves focus to the next tag. If the removed tag was last, focus goes to the last remaining tag or the search box when the list is empty.

Give `min_items` and `max_items` as integers from 0 to 500. A fill with an unknown choice, a repeated choice, a different order or a count outside the limits is refused. An edit outside the count limits shows the problem and prevents submit until the count is valid.

The form refuses a fill in which the data of a field do not agree. Examples are a minimum that is more than the maximum, a value outside the range, and a value that is not one of the choices. The refusal names the field, for example `data.fields[2].data.value: the number is outside the range`.

A person can type a value that the field does not accept, for example a text that is not a number, a date that does not exist, or a value outside the range. Then a submit sends no action. The field shows the reason as text, for example `Give a number from 1 to 12.`, and the focus goes to the field. The reason also shows when the focus leaves the field.

Enter in a text, number or date field submits the form. Enter in long text adds a line. In a choice, the arrow keys select the next or the previous choice.

Tab and Shift+Tab move the focus to or from a checkbox or switch. Space changes its checked state. The switch uses the `switch` role and shows `On` or `Off`. The label stays the same when the state changes.

A range field requires a value. Each value must be in the range and on a step from the minimum. If the maximum is between steps, the last step is the highest value. With two handles, the low value can equal the high value. Each slider gets its limit from the other handle. The group takes its name from the field label.

Tab and Shift+Tab move through the sliders and number boxes in order. On a slider, Up and Right add one step. Down and Left subtract one step. Page Up and Page Down move by ten steps. Home and End move to the first and last available steps of the handle. A valid number edit updates the slider. If a person enters an invalid number, the number box restores the last valid value when the person presses Enter or leaves the box. The field gives the reason and the form waits for a valid edit before it can submit.

The date field is a text input, not the date picker of the browser. Thus it has the same role, the same text and the same keyboard in each browser.

The date range, time and date-time fields require a value. Each uses native controls and their browser keyboard behavior. A date range has two date inputs in a group named by the field label. Each input has a visible label. Both dates must be within the optional limits. The end date can be the same as the start date or come after it.

Give the time step as a positive integer in minutes. The default is one minute. Steps start at the earliest time or at `00:00` when the earliest time is omitted. Limits are inclusive and apply within one day.

The date-time field shows the time zone as fixed text next to the control. The Python validator checks the `Area/Location` form, which can have more than two parts. The JavaScript validator also checks that `Intl.DateTimeFormat` accepts the name. The kit checks the calendar date and clock time and sends the local value without an offset. The application handles time zone conversion and daylight saving rules.

### Form card

A form card shows a long form as labels and values. A person reads the form first, and then edits one field at a time. The card has up to 10 sections, and each section has up to 40 lines. Thus a card can have more than 20 fields.

Each `form-line` has one field of the five input types, an optional `line` text of 12 characters at most, for example `2.1`, and an optional `read_only` flag. The `hint` of the field is the help text. A form card uses `read_only`, so it refuses a field with `disabled`.

The binding is the binding of an editable form: `tool`, `label`, `title`, `arguments`, `editable`, and `typed` and `editor` for typed edits. `label` is the `submit_label` of the card. The card refuses a fill in these conditions:

- Two fields have the same name.
- No field is editable.
- A field that is not read-only is not in `editable`, or its label is not the label in `editable`.
- A read-only field has `typed`, because a person cannot edit it.
- The typed flags do not agree with `typed` of the binding.
- A read-only field has the name of a bound argument, and its value is not the bound value. The request sends the bound value, so the card shows only that value. The card checks this rule at each render, at each computed value, at each new binding and before each send. If a shown value is not the bound value, the card refuses its fill and sends no action.

These are the rules of the card:

- In the read state, each line shows the line number, the label and the value as text. A field with no value shows `No value`.
- An editable value is a button. A click, Enter or Space opens the editor of the field with the current value. The editor has `Save` and `Cancel`. Escape cancels. Enter in a one-line field saves. After `Save` or `Cancel`, the focus goes back to the value.
- `Save` checks the value with the rules of the field. A changed typed field also needs an edit type. A value that is the confirmed value again is not a change.
- A changed field shows `Changed` as text until a receipt with `ok` set to `true` comes back for that value.
- A read-only field has no editor and shows `Read-only` as text. The request never sends its value.
- A submit sends only the changed fields in `arguments`, as one action. If an editor is open, the card sends no action and shows `Save or cancel this field first.` If nothing changed, the card shows `No changes to send.`
- While the request is pending or the confirm step shows, the card opens no editor.
- The old value of a typed edit is the confirmed value of the field: the value of the fill, of a computed value or of a done receipt.

The application computes the read-only fields. When the service gives new values, the application calls `card.computed({ name: value })`. The card checks each value against the contract of its field. It shows the values only if all of them are valid. It refuses a value for a bound argument that is not the bound value. It returns the errors, for example `fee: the field is not read-only`.
