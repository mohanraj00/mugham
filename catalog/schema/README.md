# Contract format 2

This folder is a level 1 path. It holds the format of a component contract and the format of a fill. The owner merges each change.

- [contract.schema.json](contract.schema.json): the shape of a contract in the full form, which is format 2.
- [short.schema.json](short.schema.json): the shape of a contract in the short form, which is format 3, and the shape of the defaults file.
- [defaults.json](defaults.json): the defaults of the catalog for the short form.
- [fill.schema.json](fill.schema.json): the outer shape of a fill. A fill is the data that a model, a service or an application sends for one component.
- `tools/catalog.py` validates each contract and each fill. The rules below that a JSON schema cannot give are in that tool.

A contract file has the short form or the full form. The short form states only what is special about a component, and a resolver gives its full form. Each rule of the "Contract" section and of the "Fill" section applies to the full form. [Short form](#short-form-format-3) gives the defaults and the override rules.

## Contract

A contract is one JSON file in `catalog/`, for example `catalog/card.json`. The file name is the component name and `.json`. The full form of a contract declares these items:

| Key | Content |
|---|---|
| `format` | `2` in the full form. |
| `name` | The component name, in lower case with hyphens. |
| `version` | A version with three numbers, for example `0.1.0`. |
| `kind` | `primitive` or `component`. |
| `description` | One sentence about the component. |
| `ai_content` | `true` if the component can show content from a model. Then the contract must declare a required authorship slot. |
| `slots` | Optional. The provenance slots: `authorship`, `citation` or the two. Each slot has the `required` key. See "Slots". |
| `data` | The data fields. Each field has a type, a label and the `required` key. |
| `states` | The states of the component: `default`, `empty`, `loading`, `disabled`, `confirm`, `pending`, `done`, `error`, `refused`, `expanded` or `collapsed`. A component shows `confirm` while a person decides on a confirm step. A collapsible card uses `expanded` and `collapsed`. |
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
| `component` | A fill of the named component. | `name` names one component. `names` names 2 to 12 components, and the fill can be of each of them. Each named component must be in the catalog. |

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

The authorship in a fill is a claim of its sender, and a model can send a false claim. Thus each element has an `actor` property. The application or the thread sets it to the trusted actor, for example the actor of the envelope. A fill cannot set it. The element refuses a fill with an authorship slot if no actor is bound, or if the `type`, the `id` or the `name` of the authorship is not the bound actor. A fill can leave out the `name`, and then the kit shows only the type and the id. Thus the kit never shows the content of an agent as the content of a person. The validator `fillErrors` and the envelope reader do not know the trusted actor, so they do not check this rule. `authorErrors(fill, actor)` in `src/render/validate.js` checks it. `mu-card-grid` gives its actor to each card.

Only the outer fill has slots. A component field takes the slots of its outer fill, so a nested fill with a `slots` key is refused. The required slots of a contract apply only when its fill is the outer fill. `mu-card-grid` gives its slots to each card, so each card shows them.

A contract with `ai_content` set to `true` must declare the authorship slot with `required` set to `true`. Thus a fill of such a component always names the actor of its content.

### Rules in tools/catalog.py

1. The `name` agrees with the file name.
2. The states include `default`.
3. A component with the role `none` has no accessible name. Each other role needs one. If the accessible name comes from a field, that field is a required text field.
4. `min_length` is not more than `max_length`, and `minimum` is not more than `maximum`.
5. Each component field names a contract in the catalog. A contract cannot contain itself, directly or through other contracts.
6. If `ai_content` is `true`, the contract declares the authorship slot with `required` set to `true`.
7. In the short form, each `size` names a size of the defaults file.
8. In the short form, a list of `states` or `tokens` has the `+` mark on each item or on no item.

## Short form (format 3)

The short form is a second way to write a contract. It omits each value that is equal to a default. A resolver adds the defaults and gives the full form, which is format 2. The registry, the validator, the elements and the tests read only the full form. Thus the short form changes no rule for a fill and no behavior of the kit.

A contract with no `format` key, or with `format` set to `3`, has the short form. A contract with `format` set to `2` has the full form, and it stays valid. Each contract in `catalog/` has the short form. `register` accepts the two forms for an application contract.

The resolvers are `resolve` in `tools/catalog.py` and `resolveContract` in `src/render/resolve.js`. `tests/vectors/short.json` shows that the two give the same full form and the same errors. The full form has the key order of [contract.schema.json](contract.schema.json).

### Defaults of the catalog

[defaults.json](defaults.json) holds the defaults. A short contract needs only `name`, `description` and `data`. These three keys have no default.

| Key | Default | Override |
|---|---|---|
| `version` | `0.1.0` | A stated value replaces the default. |
| `kind` | `component` | A stated value replaces the default. |
| `ai_content` | `true` | A stated value replaces the default. |
| `slots` | The `authorship` slot with `required` set to `true`. | Only a contract with `ai_content` set to `true` gets the default slot. A stated slot adds to the default slot. A stated `authorship` slot replaces it. |
| `states` | `["default"]` | A stated list replaces the default list. If each item has the `+` mark, the items extend the default list. |
| `tokens` | `["color.text", "color.border", "type.body"]` | The same as `states`. |
| `accessibility` | The role `none`, no keys, and `forced_colors` and `reduced_motion` set to `true`. | Each stated key replaces the default of that key. |

`"states": ["+expanded", "+collapsed"]` gives `["default", "expanded", "collapsed"]`. `"states": ["default", "empty"]` replaces the default list. A list with the `+` mark on only some items is refused.

### Defaults of a field

- `required` is `false` if a field does not state it. In the `items` of a list, `required` is `true` if the item does not state it.
- `label` comes from the key if a field does not state it. Each `_` becomes a space, and the first letter becomes a capital letter. The key `date_label` gives the label `Date label`. The `items` of a list use the key of the list.
- A text field can state `size` in place of `max_length`. If a field states the two, `max_length` wins. An unknown size name is refused.

| `size` | `max_length` |
|---|---|
| `short` | 40 |
| `line` | 80 |
| `title` | 120 |
| `summary` | 200 |
| `long` | 2000 |

### Example

This is a contract in the short form:

```json
{
  "name": "seed-tray",
  "description": "A tray of seedlings with its label and a note about its stage.",
  "data": {
    "label": {"type": "text", "required": true, "size": "line"},
    "stage_note": {"type": "text", "size": "summary"}
  },
  "states": ["+empty"]
}
```

This is its full form:

```json
{
  "format": 2,
  "name": "seed-tray",
  "version": "0.1.0",
  "kind": "component",
  "description": "A tray of seedlings with its label and a note about its stage.",
  "ai_content": true,
  "slots": {"authorship": {"required": true}},
  "data": {
    "label": {"type": "text", "label": "Label", "required": true, "max_length": 80},
    "stage_note": {"type": "text", "label": "Stage note", "required": false, "max_length": 200}
  },
  "states": ["default", "empty"],
  "tokens": ["color.text", "color.border", "type.body"],
  "accessibility": {"role": "none", "keyboard": [], "forced_colors": true, "reduced_motion": true}
}
```

### Upgrade from the full form

1. Remove the `format` key.
2. Remove `version`, `kind`, `ai_content`, `states` and `tokens` if the value is equal to the default. Remove a slot and an `accessibility` key if it is equal to the default.
3. If a list of `states` or `tokens` starts with the default list, keep only the other items and put the `+` mark on each of them.
4. In each field, remove `required` and `label` if the value is equal to the default. Replace `max_length` with `size` if a size has that value.
5. Run `make check`.

`python3 -B tools/catalog.py --resolved` prints the full form of each catalog contract, one contract on each line. `tests/vectors/resolved.json` holds that output, and a test compares the two key for key. The file started as the exact content of the catalog before the short form. After a change to a contract, write the file again and read its diff:

```sh
python3 -B tools/catalog.py --resolved > tests/vectors/resolved.json
```

A test also refuses a catalog file that states a default.

## Fill

A fill has the keys `component`, `version` and `data`, and the optional key `slots`. It has no other key.

- `component` names a contract in the catalog. If no contract has that name, the kit refuses the fill and shows the refusal.
- `version` is equal to the version of the contract.
- `data` has only declared fields. Each required field is present. Each value agrees with its field.
- `slots` has only the slots that the contract declares. If the fill is the outer fill, each required slot is present. A nested fill has no `slots` key.
- A fill never contains markup, style or script. The validator does not read a string as markup. The kit shows each text value as text.

The validator gives each error with a path, for example `data.title`. It does not change a fill.
