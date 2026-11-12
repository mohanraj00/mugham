# Contract format 2

This folder is a level 1 path. It holds the format of a component contract and the format of a fill. The owner merges each change.

- [contract.schema.json](contract.schema.json): the shape of a contract file.
- [fill.schema.json](fill.schema.json): the outer shape of a fill. A fill is the data that a model, a service or an application sends for one component.
- `tools/catalog.py` validates each contract and each fill. The rules below that a JSON schema cannot give are in that tool.

## Contract

A contract is one JSON file in `catalog/`, for example `catalog/card.json`. The file name is the component name and `.json`. A contract declares these items:

| Key | Content |
|---|---|
| `format` | Always `2`. |
| `name` | The component name, in lower case with hyphens. |
| `version` | A version with three numbers, for example `0.1.0`. |
| `kind` | `primitive` or `component`. |
| `description` | One sentence about the component. |
| `ai_content` | `true` if the component can show content from a model. Then the contract must declare a required authorship slot. |
| `slots` | Optional. The provenance slots: `authorship`, `citation` or the two. Each slot has the `required` key. See "Slots". |
| `data` | The data fields. Each field has a type, a label and the `required` key. |
| `states` | The states of the component: `default`, `empty`, `loading`, `disabled`, `confirm`, `pending`, `done`, `error` or `refused`. A component shows `confirm` while a person decides on a confirm step. |
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

A contract declares no action, and a fill names no action. The application binds the tool, the arguments and the confirm step in code. Thus a model cannot select a tool. [The catalog README](../README.md#actions) is the one description of the action model.

Format 1 had an `actions` block in a contract and an `actions` list in a fill. They had no effect, so format 2 removes them. A fill with an `actions` key is refused.

### Slots

A slot tells where the content of a fill comes from. A contract declares each slot that its fill can have:

```json
"slots": { "authorship": { "required": true }, "citation": { "required": false } }
```

| Slot | Value in a fill | Limits |
|---|---|---|
| `authorship` | The actor that wrote the content: `type`, `id` and an optional `name`. `type` is `human`, `agent` or `system`, as the actor of the [message envelope](../../docs/contracts/envelope.md). | `id` has 1 to 128 characters. `name` has 1 to 80 characters. |
| `citation` | The source of the content: `source`, the name of the source, and `locator`, an address of the source. | `source` has 1 to 120 characters. `locator` is an `https:` address of 2000 characters maximum, with no user name, no space and no control character. |

The kit shows each filled slot as text, for example `Author: agent agent-check (Checker)` and `Source: Synthetic loan rules`. The kit shows the locator as text too, and makes no link. The locator opens only after a person clicks the `Open source` button. Then the element sends a cancelable `mu-open` event with the locator. If the application does not cancel the event, the browser opens the locator in a new tab with no opener and no referrer. A slot value is never markup.

The authorship in a fill is a claim of its sender, and a model can send a false claim. Thus each element has an `actor` property. The application or the thread sets it to the trusted actor, for example the actor of the envelope. A fill cannot set it. The element refuses a fill with an authorship slot if no actor is bound, or if the `type` or the `id` of the authorship is not the bound actor. Thus the kit never shows the content of an agent as the content of a person. The validator `fillErrors` and the envelope reader do not know the trusted actor, so they do not check this rule. `authorErrors(fill, actor)` in `src/render/validate.js` checks it. `mu-card-grid` gives its actor to each card.

Only the outer fill has slots. A component field takes the slots of its outer fill, so a nested fill with a `slots` key is refused. The required slots of a contract apply only when its fill is the outer fill. `mu-card-grid` gives its slots to each card, so each card shows them.

A contract with `ai_content` set to `true` must declare the authorship slot with `required` set to `true`. Thus a fill of such a component always names the actor of its content.

### Rules in tools/catalog.py

1. The `name` agrees with the file name.
2. The states include `default`.
3. A component with the role `none` has no accessible name. Each other role needs one. If the accessible name comes from a field, that field is a required text field.
4. `min_length` is not more than `max_length`, and `minimum` is not more than `maximum`.
5. Each component field names a contract in the catalog. A contract cannot contain itself, directly or through other contracts.
6. If `ai_content` is `true`, the contract declares the authorship slot with `required` set to `true`.

## Fill

A fill has the keys `component`, `version` and `data`, and the optional key `slots`. It has no other key.

- `component` names a contract in the catalog. If no contract has that name, the kit refuses the fill and shows the refusal.
- `version` is equal to the version of the contract.
- `data` has only declared fields. Each required field is present. Each value agrees with its field.
- `slots` has only the slots that the contract declares. If the fill is the outer fill, each required slot is present. A nested fill has no `slots` key.
- A fill never contains markup, style or script. The validator does not read a string as markup. The kit shows each text value as text.

The validator gives each error with a path, for example `data.title`. It does not change a fill.
