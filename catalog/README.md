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

## Actions

A kit contract declares no tool. The application binds the tool and the fixed arguments in code:

```js
button.action = { tool: 'library.renew', arguments: { loan_id: 'L-0001' } };
```

A fill gives only data, so a model cannot select a tool. On a press, the element sends a `mu-action` event with an id, the tool and the arguments, and shows `Pending`. The application sends the request to its API. When the receipt comes back, the application calls `element.receipt({ id, ok, message })`. Only then does the element show `Done` or `Not done`. The element ignores a receipt with a different id. The editable form adds the field values to the arguments, but a field value cannot change a bound argument. A script can read `element.action.state`, but it cannot write it. A receipt confirms only the values of its request. If a person edits a field while the request is pending, the form does not show `Done` after the receipt. It asks for a new save. An edit after `Done` also lets the form save again.

An application can write its own contract with an `actions` block. The kit does not render such contracts in v0.1.
