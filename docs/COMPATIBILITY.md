# Compatibility statement

This statement applies from release 1.0.0. It tells you which changes a patch release, a minor release and a major release can make. Before release 1.0.0, a 0.x release can change each item. The [changelog](../CHANGELOG.md) gives the upgrade steps of each 0.x release.

[Decision 0008](decisions/0008-stable-contract.md) gives the design, the reason for each item and the owner answers.

The kit does not decide. The application or the service decides. The stable contract gives only the shapes that the kit reads and shows, not the decisions of an API.

## Terms

- **Stable**: the item is in the list of [the stable surface](#the-stable-surface). The rules of [Releases](#releases) apply to each change of the item.
- **Provisional**: the item can change in a minor release. The changelog lists each change.
- **Consumer**: an application, an adapter, a service dashboard or a second validator that uses the kit or its contract files.

## Releases

The kit follows semantic versions from 1.0.0. An item that is not in the stable surface is provisional.

### A patch release

A patch release fixes a defect or a document. It adds no stable item.

### A minor release

A minor release can make these changes:

- Add a component, an optional data field, a field type, an optional contract key, a state name or a binding key.
- Add an envelope part type. An older kit shows it as a `fallback` part.
- Add a declared part to a contract.
- Add an exported part.
- Add a token name.
- Make a limit larger.
- Add a record version of the offline queue. The kit still reads each earlier record version of the same major version.
- Add a contract format number, while the kit still reads formats 2 and 3.
- Mark an item as deprecated.
- Change a provisional item.

### A major release

A major release is necessary for these changes:

- Remove a stable item, or give it a new name.
- Remove a declared part, or give it a new name.
- Change the `guardrail` value of a part, from `false` to `true` or from `true` to `false`.
- Remove an exported part of `mu-card-grid` (`card-title`, `card-status`, `card-toggle`, `card-tooltip`) or of a different element, give it a new name, or change its guardrail value.
- Add a required data field, or make an optional field required.
- Make a limit smaller, or remove a value from an `enum`.
- Add an actor type or an envelope state.
- Change a value of `catalog/schema/defaults.json`.
- Change the refusal sentence, the next step or the label `Technical details`.
- Add a rule that refuses a contract or a fill that was valid.
- Remove a token name, or give it a new name.
- Remove a page attribute or one of its values, or give it a new name.

### A security fix

A security fix can refuse an input that the kit accepted before. It can come in a patch release or a minor release. The changelog lists it under `Security`, with the steps for a consumer.

## The fill version

Each catalog contract has the version `1.0.0` in release 1.0.0. These rules match the `version` of a fill to the `version` of its contract:

- The major version of the fill must be equal to the major version of the contract.
- The minor version of the fill must not be larger than the minor version of the contract.
- A contract of major version 0 keeps the exact match. The fill version must be equal to the contract version.

A new optional data field increases the minor version of its contract. Thus a fill that was valid stays valid after a minor release.

## The validator errors

Each validator error starts with a path, for example `data.title`, then `: `, then words for a person. The path is stable. The words after the path are provisional. Match the path in a test, not the full text.

The refusal that a person sees is a different item. Its sentence, its next step and its label `Technical details` are stable.

## The tokens

The names of the CSS custom properties in `src/tokens/tokens.json` are stable. The page attributes that select a set of tokens are stable with their values. The token values are provisional. The contrast tests and the guardrails of the [theme guide](guides/theme.md) apply to each value.

## Deprecation

A deprecation follows these steps:

1. A minor release adds the replacement, if one exists.
2. The same release marks the old item as deprecated. The contract or the token file gives the mark and the replacement. The changelog lists the item under `Deprecated`.
3. The old item keeps its behavior until the next major release. A part with a new name carries the two names in its `part` attribute, for example `part="card-title title-text"`. For a renamed token, the token stylesheet sets the default under the old name. The component reads the new name first, for example `gap: var(--mu-new-name, var(--mu-old-name, 1rem))`. A page can set either name. If the page sets both names, the new name takes priority.
4. The check tools warn about a deprecated item.
5. Only a major release removes the item. The item is deprecated in at least one earlier minor release.

## The stable surface

Decision 0008 has one table for each group, with the reason for each item. This list gives the stable items of each group.

### The envelope

- The `envelope` field with the value `1`, and the `agui` field with the value `"1.0"`.
- `threadId`, `runId`, `messageId` and `role`.
- The actor types `human`, `agent` and `system`, the actor `id` and the optional actor `name`, with their limits.
- The states `partial`, `final` and `refused`.
- The part types `text`, `component`, `status`, `refusal` and `fallback`, with their fields.
- The stream rules: the seven AG-UI 1.0 events and the limits.
- The actor check hook `actorFor`.

[The envelope contract](contracts/envelope.md) gives the shapes.

### The fill format and the contract format

- Fill format `2`: the keys `component`, `version`, `data` and `slots`, and no other key.
- The rule that a fill has no markup, style or script.
- The match of the fill version to the contract version, as [The fill version](#the-fill-version) says.
- Contract format 2 (the full form) and format 3 (the short form).
- The values of `catalog/schema/defaults.json`.
- Format 1 stays refused.

[The schema guide](../catalog/schema/README.md) gives the formats.

### The catalog contract fields

- The keys `format`, `name`, `version`, `kind`, `description`, `field`, `ai_content`, `slots`, `parts`, `data`, `states`, `tokens` and `accessibility`.
- The field types `text`, `number`, `integer`, `number-or-pair`, `boolean`, `date`, `enum`, `list`, `record` and `component`, with their limit keys.
- The state names.
- The slots `authorship` and `citation`, with their limits.
- Rules 1 to 9 of `tools/catalog.py`.
- The data of each catalog component.

The `tokens` list of a contract and each `description` text are provisional.

### The declared parts and the exported parts

- Each `parts` item of each catalog contract: its `name` and its `guardrail` value.
- The `parts` key of the contract format, with its limits.
- The parts of `mu-thread`.
- The part names of a refusal: `reason`, `next`, `details`, `copy` and `copy-status`.
- The exported parts of `mu-card-grid`: `card-title`, `card-status`, `card-toggle` and `card-tooltip`.
- The `action-button-*` exported parts of `mu-approval-queue`.
- The prefix rule of an exported part: the inner element name without `mu-`, then a hyphen, then the inner part name.

The [theme guide](guides/theme.md) lists the declared parts, the guardrail parts and the exported parts. `tools/theme_parts.py` is provisional.

### The refusal

- The sentence `This content did not show because it did not match the rules of the application.`
- The next step `Ask for this content again. If the refusal shows again, tell the owner of the application.`
- The disclosure label `Technical details` and its content: the component name, `: `, then the errors.
- The `mu-refused` event with `detail.errors`, a list of texts.

A more specific refusal sentence of one component is provisional.

### The token names and the page attributes

- The names of the CSS custom properties in `src/tokens/tokens.json`.
- The page attributes `data-mu-theme`, `data-mu-mode`, `data-mu-density` and `data-mu-page`, and the `control-display` attribute. The [theme guide](guides/theme.md) gives the values of each attribute.

### The action request and the receipt

- The binding keys of [the catalog guide](../catalog/README.md).
- The request `id`, `key`, `tool`, `arguments` and the optional `edits`, with their limits.
- The rule that each try has a new `id` and the same `key`.
- The receipt `ok`, the optional `id`, `key`, `message` and `reference`, with at least one of `id` or `key`.
- The typed edits `judgment`, `correction` and `override`.
- `data-state="pending"` and `data-wait` with the values `sent`, `queued` and `stalled`.
- The events `mu-action`, `mu-action-cancel`, `mu-receipt`, `mu-edit`, `mu-open`, `mu-queue-step` and `mu-upload`, with their `detail` keys.
- `element.receipt(...)`, `element.hold(...)`, `element.cancel(key)` and `element.patience`. A change of the default of `patience` needs a minor release and a changelog entry.

### The approval revision

- The read-only `fillRevision` property of `mu-rich-text`.
- `setApprovals(list, revision)`. An absent or stale revision leaves the marks as they are and sends `mu-refused`.
- The rule that a new fill or a refused fill changes the revision.

The number value of a revision is provisional. Compare two revisions only for equality.

### The offline queue

- The record version `1` and its required fields.
- The rule for a new record version: the kit also reads each earlier record version of the same major version.
- The send function `send(request, { signal, principal })` and its results.
- The `openQueue` options, the queue methods, the store methods, `memoryStore` and `indexedDbStore`.
- The queue states `queued`, `sent`, `stalled`, `rejected` and `unreadable`, with their exits.
- The limits: 100 actions, 200000 characters for each record and the credential name guard.
- The service worker function `serve(self, { version, files })`.

[The offline queue contract](contracts/offline-queue.md) gives the rules.

### The data source

- The source methods `get(key)` and `list(filter)`.
- The result keys `state`, `records`, `checked` and `reason`, and the states `ready`, `stale`, `empty` and `error`.
- The record limits and the filter limits.
- `read(source, request, options)` with its fixed reasons, and `statusFill(label, result)`.

[The data source contract](contracts/data-source.md) gives the rules.

### Other kit functions

- `readEnvelope`, `fillErrors`, `authorErrors`, `register` and `queueFill`.
- The helpers of `src/kit.js`: `fill`, `createKit`, `mount`, `onAction`, `queueActions`, `validateFill`, `describe`, `toolSchema` and `createRunSteps`.

These functions are stable for the names and the argument shapes that the docs give.

## Provisional items

These items can change in a minor release:

- The token values.
- The `tokens` list and the `description` text of a contract, and the `description` text of a part.
- `tools/theme_parts.py` and its warnings.
- The words of a validator error after the path.
- A more specific refusal sentence of one component.
- The number value of an approval revision.
- Module paths below `src/` that the docs do not name.
- The DOM inside a shadow root, apart from the declared parts.
- The English text of state labels, empty states and notices, apart from the refusal.
