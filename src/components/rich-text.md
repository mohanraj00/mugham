# Rich text

The optional `clamp` key adds a [Read more control](read-more.md). It limits only the text area. The author stays visible.

`mu-rich-text` shows rich text in a message or in a card. Its contract is [catalog/rich-text.json](../../catalog/rich-text.json).
A fill is a tree of typed nodes. It is never HTML and never Markdown. [Decision 0007](../../docs/decisions/0007-rich-text.md) gives the reasons.

```js
import { define, MuRichText } from './src/components/index.js';
define();
MuRichText.linkSchemes = ['https:'];
MuRichText.headingLevel = 2;
```

## Nodes

Each node is a fill of one contract. The list of node types is fixed.

| Node | Contract | Attributes | Element |
|---|---|---|---|
| Paragraph | `rich-paragraph` | `content`: 0 to 50 inline nodes | `p` |
| Heading | `rich-heading` | `level`: 1 to 3. `content`: 0 to 50 inline nodes | `h2` to `h6` |
| List | `rich-list` | `ordered`: optional boolean. `items`: 0 to 50 paragraph nodes | `ol` or `ul`, with one `li` for each item |
| Code block | `rich-code` | `text`: 1 to 10000 code points | `pre` with `code`, and a `Copy` button of the kit |
| Quote | `rich-quote` | `paragraphs`: 0 to 20 paragraph nodes | `blockquote`, with one `p` for each paragraph |
| Text | `rich-span` | `text`: 1 to 2000 code points. `mark`: optional, `emphasis`, `strong` or `code` | A text node, or `em`, `strong` or `code` |
| Link | `rich-link` | `text`: 1 to 200 code points. `url`: 1 to 2000 code points | `button`, and a `span` for the target |

A rich text has 0 to 100 block nodes and 2000 inline nodes maximum. A block node is a paragraph, a heading, a list, a code block or a quote. An inline node is a text or a link. A list item and a quote paragraph hold inline nodes only, so a list cannot contain a list.

The element makes each element with `createElement` from a fixed table, and it writes each text into a text node. It never parses a string as markup. A node has only the attributes of its contract. A node cannot set a style, a class, an id, an event handler or an address attribute. The validator refuses an unknown node type and an undeclared attribute, and the element shows the refusal as text. A line break in a text shows as a line break.

## Approval marks

Read the read-only `fillRevision` property just after you set the fill and before you call the application's approval API. Pass that revision with the response to `setApprovals(list, revision)`. A new or refused fill clears the marks and makes the old revision stale. A change of page policy keeps the revision and marks if the fill is still valid, including when the element connects again. A fill cannot set a mark. The kit only shows the state. The application decides and enforces each approval.

Each item gives these values.

- `block` is the index of a top-level block in the current fill, starting at zero. Give at most one item per block.
- `state` is `approved`, `pending` or `rejected`. The mark shows the state in text and has a name such as `Approval: Pending approval`.
- `by` is optional text that names the approver and has at most 80 characters.
- `at` is an optional ISO 8601 date and time in UTC, for example `2026-11-26T10:00:00Z`. Give a date and time that exists. Include seconds and the final `Z`. You can give one to three digits for fractional seconds.

A block with no item has no mark. Call `setApprovals([], revision)` with the current revision to clear all marks. An invalid list for the current revision clears all marks. A missing or stale revision leaves the current marks in place. For each refusal, the element keeps the document and sends `mu-refused` with the errors in `event.detail.errors`. See the [library newsletter](../../examples/apps/newsletter.html).

## Links

A link is a button, not an anchor. No element has an address attribute, so the browser cannot follow a link without the kit.

- Page code sets the schemes that a link can have: `MuRichText.linkSchemes`. The default is `['https:']`. The page can permit `https:`, `http:` and `mailto:`, and no other scheme. A fill cannot set this policy.
- The element parses each target with `new URL`. The target must be a complete address. An `https:` or `http:` target has a host and no user name.
- A `mailto:` target must have one mailbox. After decoding, it must have a local part, one `@` and a domain. The local part accepts letters, digits, underscores, plus signs, apostrophes and hyphens, with dots between nonempty parts. The domain accepts letters and digits, with hyphens inside its labels. The rule accepts ASCII letters and digits. It refuses commas, semicolons, spaces, queries and fragments.
- The element refuses a rich text with a target that the page does not permit, for example a script address, a `data:` address or a relative address. The refusal shows as text, and no button appears.
- The rich text field and the offline queue use the same mailbox check. When a pasted link fails the check, the field keeps its label as plain text.
- The target shows as text below the link on hover and on focus: `Opens https://example.org/rules`. The text is the parsed address. It is also the description of the button for a screen reader. Escape hides it.
- The target opens only after a person presses the button, with a pointer, Enter or Space. The element first sends a cancelable `mu-open` event with `detail.locator`, the same event as a citation. If the application does not cancel it, the browser opens the target in a new tab with no opener and no referrer.

When page code changes the policy, each connected rich text validates its fill again. A refused rich text keeps no data, so it needs a new fill. A rich text that connects again also uses the current policy.

## Headings

A heading level in a fill is relative. Page code sets the page level of a level 1 heading: `MuRichText.headingLevel`, an integer from 2 to 6. The default is 2, the level below the page title. Set it to the level below the heading that contains the thread or the card.

- A rich text never makes an `h1`. A heading that is deeper than page level 6 gets page level 6.
- A heading cannot skip a level. The first heading of a rich text has level 1. Each later heading has a level of the heading before it plus 1 maximum. The element refuses a fill that does not follow this rule.

Thus the headings of a message continue the heading order of the page.

## States

| State | Result |
|---|---|
| `default` | The blocks show in order. The author shows as text below them. |
| `empty` | A rich text with no block shows `No text. Ask for the text again.` |
| `refused` | A status notice gives the reason as text. The element keeps no data. |

The authorship slot is required and must agree with the actor that the page or the thread binds. The thread accepts a rich text part and binds the actor of its envelope. To place rich text in a card, page code uses the page-owned `actions` slot of the card.

[examples/thread/rich-text.html](../../examples/thread/rich-text.html) shows an agent message with a heading, a list of three steps and one link. It also shows markup as text and a refused script address. [tests/browser/rich-text.js](../../tests/browser/rich-text.js) checks each node type, each refusal and the keyboard in the four media modes.
