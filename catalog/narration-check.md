# Narration check contract

[Decision 0005](../docs/decisions/0005-narration-check.md) defines the scope. This check adds no component or fill field. The card and fact contracts do not change.

Import `checkNarration` from `src/narration/check.js`. Call `checkNarration(fill, narration)` with a card fill and a string. The fill must pass the card contract, including its slots. The check needs no DOM, model or network. It does not change either input.

## Limits

- The module exports `MAX_NARRATION_LENGTH = 10000` and `MAX_ERRORS = 50`.
- A narration can have at most 10,000 UTF-16 code units, as measured by JavaScript `string.length`. A longer narration fails at once with field `narration`, message `must have at most 10000 UTF-16 code units` and `checked: 0`. The check does not scan it.
- At 50 errors, the check stops the scan. It returns the first 50 errors and one last error with field `narration` and message `check stopped at the error limit of 50`. Thus the result has at most 51 error entries. Claims after the stop do not add to `checked`. The same error limit applies to fill errors.

## Claims

A claim has the form `[Field: value]`. For example: `The tray has [Count: 12] items, with [Status: ready] on [Date: 2026-11-15].`

- `Field` is the exact label of a fact, or the date label. The date label is `date_label`, or `Date` if the fill does not give one.
- The value comes from the same fill that drives the card: `data.facts[i].data.value` or `data.date`. The check does not use the title, summary, slots or a second set of source values.
- Labels must be unique, nonempty and have no colon, square bracket or line break. A date label is used only if the fill has a date. A fill with an unsupported or duplicate label fails before the check reads claims.
- One colon and one space separate the label and value. A value must be nonempty and have no square bracket or line break. All square brackets in the narration are claim syntax. A malformed claim fails with the field `narration`.
- Compare exact text, including case, spaces and units. Thus `12.0` differs from `12`, and `Ready` differs from `ready`. Dates use `YYYY-MM-DD`. The check does not convert a date, a number or a unit.
- Each claim is checked, including repeated claims. An unknown label fails with that label as the field name. A missing fact or date is an unknown label. The check does not require a claim for each fill field.

## Result

The result is `{ ok, checked, errors }`.

- `ok` is true only when `errors` is empty. This means that the check found no difference in the claims it checked.
- `checked` counts claims with a valid form, including unknown labels and different values. A malformed claim does not add to the count.
- `errors` is a list of `{ field, message }`, in source order for fill errors and in text order for claim errors. A difference uses the label as `field` and `message: 'does not match the card value'`. An unknown label uses `message: 'no card field has this label'`. A malformed claim uses `message: 'must use [Field: value]'`.
- A narration with no claim gives `{ ok: true, checked: 0, errors: [] }`. It is not evidence that the prose agrees with the card. Show the count with the result.
- A fill that is not a card fails with field `component`. Other fill errors use the field path from the fill validator. A narration that is not a string fails with field `narration`. Input errors return `checked: 0`.

The application owns the source fill and decides what to do with a result. The check does not approve an action, create a receipt, change a card or prove that a source is correct. Treat every result string as data. Show it only as text.
