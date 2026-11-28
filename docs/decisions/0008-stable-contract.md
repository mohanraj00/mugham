# 0008: The stable contract of v1.0

Status: accepted, 2026-11-27. Issue: mohanraj00/mugham#17.

This note started as a proposal for an owner choice. It changes no contract, test or source file. The owner accepted the defaults of the three questions. "Owner answers" records them. The implementation issues of the last section can now start.

## Context

Release 0.7.0 has the envelope, contract format 2, the short form (format 3), the declared parts, the theme tokens, the action request and receipt, the offline queue and the data source. Each of them has a contract file or a guide. No document says which of them stay compatible across releases.

Issue #17 needs three results: a compatibility statement, versioned conformance tests and an upgrade guide from the last 0.x release. The owner comments on #17 add these rules for the parts:

- The removal or the new name of a declared part needs a major release.
- A new declared part can come in a minor release.
- A change of the `guardrail` value of a part needs a major release.
- The exported parts of `mu-card-grid` (`card-title`, `card-status` and `card-toggle`) follow the same rules.

The kit does not decide. The application or the service decides. The stable contract gives only the shapes that the kit reads and shows, not the decisions of an API.

## Terms

- **Stable**: the item is in the compatibility statement. Section "Compatibility statement" gives the rules for a change.
- **Provisional**: the item can change in a minor release. The changelog lists each change.
- **Consumer**: an application, an adapter, a service dashboard or a second validator that uses the kit or its contract files.

## 1. The stable surface

Each row gives the item, the proposal and the reason. "Q1", "Q2" and "Q3" refer to the owner choices.

### The envelope

| Item | Proposal | Reason |
|---|---|---|
| The `envelope` field, value `1` | Stable | A consumer selects the reader by this value. |
| The `agui` field, value `"1.0"` | Stable | The value names the mapped protocol version. A later reader can accept a second value in a minor release. |
| `threadId`, `runId`, `messageId`, `role` | Stable | These ids come from the stream and the history of an application. |
| Actor types `human`, `agent`, `system` | Stable. A new actor type needs a major release | Principle 3. A consumer and a component show each type in a different way. A new type can show agent content in a wrong way in an older kit. |
| Actor `id` (1 to 128 characters) and optional `name` (1 to 80 characters) | Stable | The authorship slot and the actor check use the same limits. |
| States `partial`, `final`, `refused` | Stable. A new state needs a major release | Principle 6. An older kit cannot show the true meaning of an unknown state. |
| Part types `text`, `component`, `status`, `refusal`, `fallback` with their fields | Stable | These are the typed parts of version 1. |
| A new part type | Minor release | Version 1 already shows an unknown type as a `fallback` part, so an older kit stays honest. |
| The stream rules: the seven AG-UI 1.0 events, the limits (1000 runs, 1000 messages, 1000000 characters, 100000 characters for each message, 100 stream errors) | Stable | A producer depends on the limits. A larger limit can come in a minor release. A smaller limit needs a major release. |
| The actor check hook `actorFor` | Stable | The application owns the trusted actor. The hook is its only input to the reader. |
| Citation part, other AG-UI events, `ACTIVITY_DELTA`, a transport | Kept out | The envelope contract lists them as limits of version 1. Each can come later as an addition. |

### The fill format and the contract format

| Item | Proposal | Reason |
|---|---|---|
| Fill format `2`: the keys `component`, `version`, `data` and `slots`, and no other key | Stable | Each model, service and adapter sends this shape. |
| The rule that a fill has no markup, style or script | Stable | Principle 1 and principle 5. |
| The match of the fill `version` to the contract `version` | Stable, with the rule of Q2 | The present rule needs an exact match. With an exact match, each additive change of a contract refuses each older fill. |
| Contract format 2 (the full form) and format 3 (the short form) | Stable. A new format number can come in a minor release if the kit still reads 2 and 3 | An application contract uses one of the two forms. |
| `catalog/schema/defaults.json` | Stable. A change of a default value needs a major release | A change of a default changes the full form of each short contract of an application. |
| Format 1 (`actions` in a contract or a fill) | Stays refused | Format 2 removed it in v0.2. |

### The catalog contract fields

| Item | Proposal | Reason |
|---|---|---|
| The keys `format`, `name`, `version`, `kind`, `description`, `field`, `ai_content`, `slots`, `parts`, `data`, `states`, `tokens`, `accessibility` | Stable | `tools/catalog.py`, the browser validator and the registry read them. |
| The field types `text`, `number`, `integer`, `number-or-pair`, `boolean`, `date`, `enum`, `list`, `record`, `component`, with their limit keys | Stable. A new field type or a new optional limit key can come in a minor release | A new type is an addition. An older validator refuses a contract with the new type, so the refusal is visible. |
| The state names | Stable. A new state name can come in a minor release | A removed state can break the page code of an application. |
| The slots `authorship` and `citation`, with their limits | Stable | Principle 3 and principle 5. |
| The rules of `tools/catalog.py` (rules 1 to 9) | Stable. A new rule that refuses a contract which was valid needs a major release, except for a security fix | A new rule can refuse an application contract. |
| The data of each catalog component | Stable, with the rules of the compatibility statement | A model fills these fields. |
| The `tokens` list of a contract | Provisional | It documents the tokens that a component uses. It is not an input of a consumer. |
| The `description` text of a contract and of a part | Provisional | It is documentation. |

### The declared parts and the guardrails (#135)

| Item | Proposal | Reason |
|---|---|---|
| Each `parts` item of each catalog contract: `name` and `guardrail` | Stable, with the rules of #17 | Page styles select parts by name. The guardrail flag protects principles 3, 6 and 7. |
| The `parts` key of the contract format (40 items maximum, name rules) | Stable | Application contracts use the same key. |
| The parts of `mu-thread` | Stable | The theme guide lists them, and the thread shows the refusals and the stream notices. |
| The part names of a refusal: `reason`, `next`, `details`, `copy`, `copy-status` | Stable | Each element shows them. The theme guide makes `next` and `details` guardrails. |
| `tools/theme_parts.py` | Provisional | It is a check tool. Its warnings can grow in a minor release. |

### The exported parts of `mu-card-grid`

| Item | Proposal | Reason |
|---|---|---|
| `card-title`, `card-status`, `card-toggle` | Stable, with the rules of #17 | The owner comment on #17 names them. |
| `card-tooltip` | Stable, with the same rules | Release 0.7.0 added it (#180), after the owner comment. It is in the theme guide and in the contract, so a page can already use it. |
| The `action-button-*` exported parts of `mu-approval-queue` | Stable, with the same rules | They are declared parts of the approval queue contract, so the rules for declared parts apply. |
| The prefix rule: the inner element name without `mu-`, then a hyphen, then the inner part name | Stable | A page can guess each exported name from this rule. |

### The refusal (#132)

| Item | Proposal | Reason |
|---|---|---|
| The sentence `This content did not show because it did not match the rules of the application.` | Stable. A change needs a major release | Issue #132 says that the refusal text is part of the stable contract. An application can test it and translate it. |
| The next step `Ask for this content again. If the refusal shows again, tell the owner of the application.` | Stable | The same reason. |
| The disclosure label `Technical details` and its content: the component name, `: `, then the errors | Stable | A person and a screen reader find the details by this label. |
| The `mu-refused` event with `detail.errors`, a list of texts | Stable | An application logs the full error from this event. |
| The text of each validator error | Q3 | A test that matches the full text breaks after each change of the words. |
| A more specific refusal sentence of one component | Provisional | The interaction details let a component give a better sentence. |

### The token names (#126)

| Item | Proposal | Reason |
|---|---|---|
| The names of the CSS custom properties in `src/tokens/tokens.json` | Q1 | Page themes and presets set them by name. |
| The token values | Provisional. The contrast tests and the guardrails of the theme guide still apply | A better value helps each page and breaks no page code. |
| The page attributes `data-mu-theme` (`neutral`, `high-contrast`, `compact`), `data-mu-mode`, `data-mu-density`, `data-mu-page` and the `control-display` attribute | Stable with the token names, with the rule of Q1 | They select a set of tokens. |

### The action request and the receipt

| Item | Proposal | Reason |
|---|---|---|
| The binding keys of `catalog/README.md` | Stable. A new optional key can come in a minor release | The application binds each action in code. |
| The request `id`, `key`, `tool`, `arguments` and optional `edits`, with their limits | Stable | The `key` is the idempotency key of the API. The service depends on it. |
| The rule: each try has a new `id` and the same `key` | Stable | Principle 4. A retry must not do the action two times. |
| The receipt `ok`, optional `id`, optional `key`, optional `message` (200 characters), optional `reference` (80 characters), with at least one of `id` or `key` | Stable | Principle 4. The kit shows `Done` only after a valid receipt with `ok: true`. |
| The typed edits `judgment`, `correction`, `override` | Stable | Principle 4. |
| `data-state="pending"` and `data-wait` (`sent`, `queued`, `stalled`) | Stable | Principle 6. Page code and tests read them. |
| The events `mu-action`, `mu-action-cancel`, `mu-receipt`, `mu-edit`, `mu-open`, `mu-queue-step`, `mu-upload` and their `detail` keys | Stable | They carry the stable shapes above. |
| `element.receipt(...)`, `element.hold(...)`, `element.cancel(key)`, `element.patience` (default 30000) | Stable. A change of the default needs a minor release and a changelog entry | Page code calls them for each action. |

### The approval revision

| Item | Proposal | Reason |
|---|---|---|
| The read-only `fillRevision` property of `mu-rich-text` | Stable | Page code reads it before it calls the approval API. |
| `setApprovals(list, revision)`, and the rule: an absent or stale revision leaves the marks as they are and sends `mu-refused` | Stable | A late response must not mark a different fill. |
| The rule: a new fill or a refused fill changes the revision | Stable | The same reason. |
| The number value of a revision (its start value and its step) | Provisional | Page code must only compare two revisions for equality. |

### The offline queue

| Item | Proposal | Reason |
|---|---|---|
| The record version `1` and its required fields | Stable | A device keeps records across an upgrade of the kit. |
| The rule for a record of a new version | Stable. A minor release can add a record version. It must also read each earlier record version of the same major | A pending action must not disappear after an upgrade. An older kit shows a newer record as `unreadable` and does not send it. |
| The send function `send(request, { signal, principal })` and its results | Stable | The application adds its credentials there. |
| `openQueue` options, the queue methods (`perform`, `retry`, `cancel`, `dismiss`, `flush`, `clear`, `close`, `watch`, `listen`, `entries`), the store methods, `memoryStore`, `indexedDbStore` | Stable | Application code calls them. |
| The queue states `queued`, `sent`, `stalled`, `rejected`, `unreadable` and their exits | Stable | Principle 6. |
| The limits: 100 actions, 200000 characters for each record, the credential name guard | Stable. A larger limit can come in a minor release | A smaller limit can refuse an action that a page sends now. |
| The service worker `serve(self, { version, files })` | Stable | The application owns the worker file and calls this function. |

### The data source

| Item | Proposal | Reason |
|---|---|---|
| The source methods `get(key)` and `list(filter)` | Stable | The application writes the source. |
| The result keys `state`, `records`, `checked`, `reason`, and the states `ready`, `stale`, `empty`, `error` | Stable | Principle 6. |
| The record limits and the filter limits | Stable. A larger limit can come in a minor release | A source depends on them. |
| `read(source, request, options)` and its fixed reasons, and `statusFill(label, result)` | Stable | The application calls them, and a test can match the reasons. |

### Other kit functions

| Item | Proposal | Reason |
|---|---|---|
| `readEnvelope`, `fillErrors`, `authorErrors`, `register`, `queueFill`, and the helpers of `src/kit.js` (`fill`, `createKit`, `mount`, `onAction`, `queueActions`, `validateFill`, `describe`, `toolSchema`, `createRunSteps`) | Stable for the names and the argument shapes that the docs give | An application cannot use the stable shapes without them. |
| Module paths below `src/` that the docs do not name | Provisional | They are the internal layout of the kit. |
| The DOM inside a shadow root, apart from the declared parts | Provisional | Decision 0003 keeps the shadow root private. |
| English text of state labels, empty states and notices, apart from the refusal | Provisional | Later work can add a translation. The state names in attributes stay stable. |

## 2. Compatibility statement (draft)

Implementation issue I1 copies this draft to [`docs/COMPATIBILITY.md`](../COMPATIBILITY.md). That file uses the owner answers, so it has no condition on Q1.

> The kit follows semantic versions from 1.0.0. The stable surface is the list in decision 0008. Other items are provisional.
>
> **A patch release** fixes a defect or a document. It adds no stable item.
>
> **A minor release** can do these changes:
>
> - Add a component, an optional data field, a field type, an optional contract key, a state name or a binding key.
> - Add an envelope part type. An older kit shows it as a `fallback` part.
> - Add a declared part to a contract.
> - Add an exported part.
> - Add a token name, if the answer to Q1 makes the names stable.
> - Make a limit larger.
> - Add a record version of the offline queue. The kit still reads each earlier record version of the same major.
> - Add a contract format number, while the kit still reads formats 2 and 3.
> - Mark an item as deprecated.
> - Change a provisional item.
>
> **A major release** is necessary for these changes:
>
> - Remove a stable item, or give it a new name.
> - Remove a declared part, or give it a new name.
> - Change the `guardrail` value of a part, from `false` to `true` or from `true` to `false`.
> - Remove an exported part of `mu-card-grid` (`card-title`, `card-status`, `card-toggle`, `card-tooltip`) or of a different element, give it a new name, or change its guardrail value.
> - Add a required data field, or make an optional field required.
> - Make a limit smaller, or remove a value from an `enum`.
> - Add an actor type or an envelope state.
> - Change a value of `catalog/schema/defaults.json`.
> - Change the refusal sentence, the next step or the label `Technical details`.
> - Add a rule that refuses a contract or a fill that was valid.
> - Remove a token name, or give it a new name, if the answer to Q1 makes the names stable.
>
> **A security fix** can refuse an input that the kit accepted before. It can come in a patch release or a minor release. The changelog lists it under `Security`, with the steps for a consumer.
>
> **A deprecation** follows these steps:
>
> 1. A minor release adds the replacement, if one exists.
> 2. The same release marks the old item as deprecated. The contract or the token file gives the mark and the replacement. The changelog lists the item under `Deprecated`.
> 3. The old item keeps its behavior until the next major release. A part with a new name carries the two names in its `part` attribute, for example `part="card-title title-text"`. For a renamed token, the token stylesheet sets the default under the old name. The component reads the new name first, for example `gap: var(--mu-new-name, var(--mu-old-name, 1rem))`. A page can set either name. If the page sets both names, the new name takes priority.
> 4. The check tools warn about a deprecated item.
> 5. Only a major release removes the item. The item is deprecated in at least one earlier minor release.

## 3. Versioned conformance tests

### File layout

The shared vectors move from `tests/vectors/` to one folder for each major version of the contract:

```text
conformance/
  README.md            how to run the set
  run.py               the runner, Python standard library only
  v1/
    manifest.json      the set version, the kit version and a SHA-256 for each file
    catalog/
      contracts.json   from tests/vectors/contracts.json
      fills.json       from tests/vectors/fills.json
      short.json       from tests/vectors/short.json
      resolved.json    from tests/vectors/resolved.json
    envelope/
      envelopes.json   from tests/vectors/envelope/envelopes.json
      streams.json     from tests/vectors/envelope/streams.json
      generate.py      from tests/vectors/envelope/generate.py
    surface/
      parts.json       each element, each declared part and its guardrail value, and the exported parts
      refusal.json     the refusal sentence, the next step and the disclosure label
      tokens.json      the token names, if Q1 makes them stable
```

These rules apply to the set:

- Each case has a `since` key, for example `"1.0.0"`. A minor release adds cases. It does not change the expected result of an earlier case.
- A security fix can change the expected result of a case. The case then gets a `changed` key with the release, and the changelog lists it.
- A major release starts a new folder, for example `v2/`. The old folder stays in the tree for one major release.
- The kit tests read the set from `conformance/v1/`. `make check` runs them.
- The `surface/` files are snapshots. A test fails if a stable item in them disappears, gets a new name or gets a new guardrail value. A new item makes the test ask for an update of the snapshot, which a minor release can do.

### How a consumer runs the set against a pinned release

The release workflow attaches a second asset, `mugham-conformance-<version>.tar`, with its SHA-256 file. The byte check covers it. The kit archive stays as it is (decision 0004).

A consumer runs these steps:

1. Pin the release: the tag, the commit and the SHA-256 of each asset.
2. Get the conformance asset of that tag and check its SHA-256.
3. Unpack it into an empty folder.
4. Run the runner against the kit of the same release: `python3 -I conformance/run.py --kit path/to/kit`.
5. To test a second validator, for example a validator on a server, run `python3 -I conformance/run.py --validator "command"`. The runner sends each case as one JSON line on the input of the command. It compares each output line with the expected errors.
6. Use `--since 1.2.0` to run only the cases of a release and the earlier releases.

The runner uses only the Python standard library and runs no code from the cases. It compares error paths, or full error texts, by the answer to Q3.

## 4. Upgrade guide outline, 0.7.0 to 1.0.0

Implementation issue I8 writes `docs/guides/upgrade-1.0.md` from this outline.

1. Pin release 1.0.0 with its tag, commit and SHA-256.
2. Read the compatibility statement and the list of stable items.
3. Fills:
   - With the default of Q2, change the `version` of each fill of a catalog component from `0.1.0` to `1.0.0`.
   - The `fill` helper sets the version from the contract, so code that uses it needs no change.
   - Get a new tool schema from `toolSchema` for each agent.
4. Application contracts: keep the version of each contract, or set it to `1.0.0`. A contract of major version 0 keeps the exact match rule.
5. Page styles:
   - Run `python3 -B tools/theme_parts.py` on each style sheet.
   - Use only declared parts and exported parts.
   - Use only the token names of the list, if Q1 makes them stable.
6. Tests of an application:
   - Match the refusal sentence and the next step. They do not change from 0.7.0.
   - With the default of Q3, match the error path, not the full error text.
7. Offline queue: version 1 records stay valid. A device needs no migration. Pending actions go out after the upgrade.
8. Data source: no change.
9. Run the conformance set of release 1.0.0 against each adapter and each second validator.
10. Read the `Deprecated` section of the changelog. Release 1.0.0 removes no item of 0.7.0 unless an implementation issue says so.

## 5. Owner choices

### Q1. Make the token names stable now, or keep them out of v1.0

- **Option A, stable names.** The names of the CSS custom properties and the page attributes are stable. The values stay provisional. The kit can add a token in a minor release. A new name for a token needs an alias and a major release for the removal.
- **Option B, provisional tokens.** The tokens stay out of v1.0. A minor release can remove a token or give it a new name.
- **Recommendation: A.** Release 0.6.0 added the groups and the presets of #126, so the set is complete for the components of the catalog. Page themes already set the tokens by name. With option B, each page theme can break in a minor release.

### Q2. The match rule of the fill version

- **Option A, a match of the major version.** Each catalog contract gets the version `1.0.0`. A fill is valid if its major version is equal to the major version of the contract, and its minor version is at most the minor version of the contract. A new optional field increases the minor version of the contract. A contract of major version 0 keeps the exact match.
- **Option B, the exact match.** The present rule stays. Each catalog contract keeps `0.1.0`. A contract changes its version only in a major release, so the version shows no additive change.
- **Recommendation: A.** With option B, an additive change makes each older fill not valid, or the version tells nothing. Option A needs one change of each fill at v1.0. The `fill` helper and `toolSchema` do it for most consumers.

### Q3. The validator error text

- **Option A, a stable path.** The error path, for example `data.title`, is stable. The words after the path are provisional. The conformance runner compares the paths.
- **Option B, the full text.** The full text of each error is stable. A change of the words needs a major release.
- **Option C, no stable part.** The errors are provisional. Only the fact that a fill is refused is stable.
- **Recommendation: A.** An application can log the path and point to the field. A person reads the words, and better words help that person. Option C gives a second validator no way to show that it agrees with the kit.

### Numbered questions

1. Do the token names and the page attributes become stable at v1.0? Default: yes, the names are stable and the values are provisional (Q1, option A).
2. Which rule matches the fill version to the contract version? Default: the major version matches, the catalog contracts get `1.0.0`, and major version 0 keeps the exact match (Q2, option A).
3. Which part of a validator error is stable? Default: the error path only (Q3, option A).

### Owner answers

On 2026-11-27, the owner answered the three questions with the words "Accept the defaults". The [comment on #17](https://github.com/mohanraj00/mugham/issues/17#issuecomment-7217373070) records the answers.

1. Q1: option A. The token names and the page attributes become stable at v1.0. The token values stay provisional.
2. Q2: option A. The major version of a fill must match the major version of the contract. The catalog contracts get `1.0.0`. A contract of major version 0 keeps the exact match.
3. Q3: option A. Only the error path of a validator error is stable. The words after the path can change.

## 6. Implementation issues (draft)

The owner files these issues. They use the owner answers. Each change of `catalog/schema/*`, `docs/contracts/*` or `.github/` is level 1.

The items have no separate issues. Each item is a part of #17, and each done line links its PR.

### I1. Write the compatibility statement

- [x] `docs/COMPATIBILITY.md` has the statement of section 2, with each rule of #17 about parts ([#220](https://github.com/mohanraj00/mugham/pull/220)).
- [x] The file lists the stable items of section 1, or links to this note for them ([#220](https://github.com/mohanraj00/mugham/pull/220)).
- [ ] The README, `docs/contracts/envelope.md`, `docs/contracts/data-source.md`, `docs/contracts/offline-queue.md` and `catalog/schema/README.md` link to the statement. The contract documents and the schema guide have the link ([#222](https://github.com/mohanraj00/mugham/pull/222)). The README link comes with I8.
- [x] `make check` passes ([#220](https://github.com/mohanraj00/mugham/pull/220)).

### I2. Version the conformance set

- [x] The vectors move to `conformance/v1/` with the layout of section 3. The kit tests read them there ([#222](https://github.com/mohanraj00/mugham/pull/222)). The `surface/` files come with I6 and I7.
- [x] Each case has a `since` key. `manifest.json` gives a SHA-256 for each file, and a test checks it ([#222](https://github.com/mohanraj00/mugham/pull/222)).
- [x] `conformance/run.py` runs the set against the kit and against a command, with `--since`. It uses only the Python standard library ([#222](https://github.com/mohanraj00/mugham/pull/222)). The driver `conformance/kit.mjs` lets the runner use the validator of a kit with Node.js.
- [x] The release workflow attaches `mugham-conformance-<version>.tar` and its SHA-256 file. The byte check covers the asset ([#222](https://github.com/mohanraj00/mugham/pull/222)).
- [x] `.github/gates.json` lists `conformance/*` as a level 1 path ([#222](https://github.com/mohanraj00/mugham/pull/222)).
- [x] `conformance/README.md` gives the steps for a consumer with a pinned release ([#222](https://github.com/mohanraj00/mugham/pull/222)).

### I3. Match the fill version by the major version (Q2, option A)

- [ ] `catalog/schema/defaults.json` and each catalog contract give the version `1.0.0`.
- [ ] `tools/catalog.py` and `src/render/validate.js` accept a fill with the same major version and a minor version that is not larger. Major version 0 keeps the exact match.
- [ ] Shared vectors cover an equal version, an older minor, a newer minor, a different major and major version 0.
- [ ] `toolSchema` and `describe` give the current version. The `fill` helper sets it.
- [ ] The changelog and the upgrade guide give the change of each fill.

### I4. Make the error paths stable (Q3, option A)

- [x] `catalog/schema/README.md` gives the grammar of an error path ([#222](https://github.com/mohanraj00/mugham/pull/222)).
- [x] The conformance runner compares the paths by default, and the full text with a flag ([#222](https://github.com/mohanraj00/mugham/pull/222)).
- [x] A test checks that each error of the two validators starts with a path and `: ` ([#222](https://github.com/mohanraj00/mugham/pull/222)).

### I5. Add deprecation marks

- [ ] The contract format accepts an optional `deprecated` text on a contract, a data field and a part. The two validators accept it, with shared vectors.
- [x] The `renamed` object in `tokens.json` maps each old name to its replacement in `tokens`. Each replacement can have one old name. `tools/tokens.py` writes the default and preset values under the old name. The component uses the fallback in step 3. Run `node tests/browser/token-alias.mjs` to check the page overrides.
- [ ] `tools/theme_parts.py` warns about a deprecated part and a deprecated token.
- [ ] The changelog template has a `Deprecated` section.

### I6. Make the token names stable (Q1, option A)

- [ ] `conformance/v1/surface/tokens.json` lists each token name and each page attribute value.
- [ ] A test fails if a listed name disappears or gets a new name with no alias.
- [ ] The theme guide says that the names are stable and the values are provisional.

### I7. Add snapshot tests of the stable surface

- [ ] `conformance/v1/surface/parts.json` lists each element, each declared part, its guardrail value and each exported part, with `card-tooltip`.
- [ ] `conformance/v1/surface/refusal.json` holds the refusal sentence, the next step and the label `Technical details`.
- [ ] A test fails if a part disappears, gets a new name or gets a new guardrail value. A new part needs an update of the snapshot.
- [ ] A test checks the list of exported names of `src/kit.js` and of the stable functions in section 1.
- [ ] No test or accessibility check is removed.

### I8. Write the upgrade guide and prepare release 1.0.0

- [ ] `docs/guides/upgrade-1.0.md` follows the outline of section 4, with the answers of the owner.
- [ ] `CHANGELOG.md` has a 1.0.0 entry with the upgrade steps first.
- [ ] `docs/STATUS.md` gives the v1.0 scope as complete.
- [ ] This note links to the PR of each implementation issue.
- [ ] The tag and the release need a separate owner approval.
