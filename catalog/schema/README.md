# Contract format 1

This folder is a level 1 path. It holds the format of a component contract and the format of a fill. The owner merges each change.

- [contract.schema.json](contract.schema.json): the shape of a contract file.
- [fill.schema.json](fill.schema.json): the outer shape of a fill. A fill is the data that a model, a service or an application sends for one component.
- `tools/catalog.py` validates each contract and each fill. The rules below that a JSON schema cannot give are in that tool.

## Contract

A contract is one JSON file in `catalog/`, for example `catalog/card.json`. The file name is the component name and `.json`. A contract declares these items:

| Key | Content |
|---|---|
| `format` | Always `1`. |
| `name` | The component name, in lower case with hyphens. |
| `version` | A version with three numbers, for example `0.1.0`. |
| `kind` | `primitive` or `component`. |
| `description` | One sentence about the component. |
| `ai_content` | `true` if the component can show content from a model. Then the kit shows the actor of the content. |
| `data` | The data fields. Each field has a type, a label and the `required` key. |
| `actions` | Optional. The actions that the component can propose. |
| `states` | The states of the component. |
| `tokens` | The design tokens that the component uses. |
| `accessibility` | The role, the accessible name (not for the role `none`), the keys, and support for forced colors and reduced motion. |

### Field types

| Type | Value in a fill | Limits |
|---|---|---|
| `text` | A string. The kit always shows it as text, never as markup. | `max_length` is necessary. `min_length` is optional. |
| `number` | A number. | `minimum` and `maximum` are optional. |
| `integer` | An integer. | `minimum` and `maximum` are optional. |
| `boolean` | `true` or `false`. | |
| `date` | A calendar date as `YYYY-MM-DD`. | The date must exist. |
| `enum` | One string from `values`. | |
| `list` | An array of items. An item is a scalar field or a component field. | `max_items` is necessary. |
| `component` | A fill of the named component. | The named component must be in the catalog. |

A field with `editable: true` is a form input. A list field and a component field cannot be editable.

### Actions

An action has a `tool`, a `label`, `arguments` and `confirm`. The contract sets the tool name. A fill can only name a declared action and give its arguments. Thus a model cannot select a different tool. Each argument is a scalar field. If `confirm` is `true`, the kit asks a person before it sends the action.

### Rules in tools/catalog.py

1. The `name` agrees with the file name.
2. The states include `default`.
3. If the contract has actions, the states include `pending`, `done` and `error`. The kit shows an action as done only after the receipt comes back.
4. A component with the role `none` has no accessible name. Each other role needs one. If the accessible name comes from a field, that field is a required text field.
5. `min_length` is not more than `max_length`, and `minimum` is not more than `maximum`.
6. Each component field names a contract in the catalog. A contract cannot contain itself, directly or through other contracts.

## Fill

A fill has the keys `component`, `version`, `data` and optionally `actions`.

- `component` names a contract in the catalog. If no contract has that name, the kit refuses the fill and shows the refusal.
- `version` is equal to the version of the contract.
- `data` has only declared fields. Each required field is present. Each value agrees with its field.
- Each item in `actions` names a declared action. Its `arguments` has only declared arguments, and each required argument is present.
- A fill never contains markup, style or script. The validator does not read a string as markup. The kit shows each text value as text.

The validator gives each error with a path, for example `data.title`. It does not change a fill.
