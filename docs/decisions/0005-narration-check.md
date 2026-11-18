# 0005: A check of narration claims against a card

Status: proposed, 2026-11-15. Issue: mohanraj00/mugham#40.

## Context

A card can show data from a deterministic source next to text from an agent. The text can repeat a different number, date or status. The kit needs a small check whose result can be tested without a model or network. The application or connected service still owns each decision.

## Options

### Option A: compare explicit claims

- A narration marks each repeated value as `[Field: value]`. The field is a label that the card shows.
- Compare the value with the same fill that drives the card. Report a difference with the field name.
- Advantages: a deterministic check, no model, no network and no dependency. Each result has a direct test.
- Disadvantages: the author must use the claim form. A check of these claims cannot prove that all the prose is correct.

### Option B: interpret free prose

- Find numbers, dates and status words in sentences, and infer which card field each one describes.
- Advantages: the author needs no claim form.
- Disadvantages: an ambiguous sentence needs an interpretation. A model adds a runtime outside the scope of the kit. A fixed parser can give a false match.

### Option C: remove the rule

- The application checks its own narration, or shows only the source data.
- Advantages: no kit API or claim form to maintain.
- Disadvantages: the kit has no common check of repeated values.

## Decision

Implement Option A as a separate, optional check. [The contract](../../catalog/narration-check.md) defines the inputs, claim form and result. Do not add a check to the renderer or thread. Do not change the component contracts.

The check covers numbers, dates and status values that the narration repeats from the fill in the explicit claim form. It compares the text of fact values and the card date. It can also compare other exact fact text. The card contract already stores fact values as text, so numeric comparison is exact text comparison. For example, `12.0` differs from `12`. A status value comes from the application. The kit assigns no domain meaning to it.

The check does not cover free prose, paraphrases, negation, omitted claims, totals, calculations, units that need conversion, relative dates, time zones, causal claims, recommendations or the truth of the source. It does not check title or summary text unless the application gives that text separately as the narration. Even then, only explicit claims are checked. A person can write false prose around a matching claim. A match is not proof that the narration is correct.

An unknown field, malformed claim or invalid fill fails. A narration with no claim has no difference and reports zero checked claims. The application must keep that count visible and must not describe it as verified prose.

Limit narration to 10,000 UTF-16 code units, as measured by JavaScript `string.length`. Export this limit as `MAX_NARRATION_LENGTH`. A longer narration fails at once with field `narration` and `checked: 0`. Do not scan it. Export `MAX_ERRORS = 50`. At 50 errors, stop the scan and return the first 50 errors plus one last error with field `narration` and a message that says the check stopped at the error limit. Return at most 51 error entries, including fill errors. Claims after the stop do not add to `checked`. These limits bound the scan and its result for untrusted narration.

Review: the owner can keep this rule or remove it with a later decision record if the check is not useful. This record leaves that choice open.

## Checks

Write these expected results before the implementation runs:

| Input | Expected result |
|---|---|
| Count `12`, date `2026-11-15`, status `ready`, all repeated exactly | Pass, three checked claims |
| Count `13` against `12` | Fail, field `Count` |
| Date `2026-11-16` against `2026-11-15` | Fail, field `Date` |
| Status `pending` against `ready` | Fail, field `Status` |
| Narration with no claim | No difference, zero checked claims |
| Two claims for Count, one correct and one different | Fail, field `Count`, two checked claims |
| Unknown label, malformed claim, duplicate label or invalid fill | Fail, with the relevant field name |
| `12.0` against `12`, or `Ready` against `ready` | Fail, no number or case conversion |
| A custom date label | Compare that label, not `Date` |
| Markup in a fact or narration | Keep it as data; do not execute it |
| Narration with 10,001 UTF-16 code units | Fail at once, field `narration`, zero checked claims |
| Narration with 10,000 UTF-16 code units and one matching claim at the end | Pass, one checked claim |
| More than 50 stray closing brackets, then a claim | Fail, 50 syntax errors and one stop error, zero checked claims |

`tests/narration.test.mjs` checks these results and the two synthetic example cases. `examples/evidence/narration.html` shows the same card data with a passing narration and a failing narration. The browser check expects two card articles, no refused elements and headings for both results.
