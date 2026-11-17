# Rich text

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
| Code block | `rich-code` | `text`: 1 to 10000 code points | `pre` with `code` |
| Quote | `rich-quote` | `paragraphs`: 0 to 20 paragraph nodes | `blockquote`, with one `p` for each paragraph |
| Text | `rich-span` | `text`: 1 to 2000 code points. `mark`: optional, `emphasis`, `strong` or `code` | A text node, or `em`, `strong` or `code` |
| Link | `rich-link` | `text`: 1 to 200 code points. `url`: 1 to 2000 code points | `button`, and a `span` for the target |

A rich text has 0 to 100 block nodes and 2000 inline nodes maximum. A block node is a paragraph, a heading, a list, a code block or a quote. An inline node is a text or a link. A list item and a quote paragraph hold inline nodes only, so a list cannot contain a list.

The element makes each element with `createElement` from a fixed table, and it writes each text into a text node. It never parses a string as markup. A node has only the attributes of its contract. A node cannot set a style, a class, an id, an event handler or an address attribute. The validator refuses an unknown node type and an undeclared attribute, and the element shows the refusal as text. A line break in a text shows as a line break.

## Links

A link is a button, not an anchor. No element has an address attribute, so the browser cannot follow a link without the kit.

- Page code sets the schemes that a link can have: `MuRichText.linkSchemes`. The default is `['https:']`. The page can permit `https:`, `http:` and `mailto:`, and no other scheme. A fill cannot set this policy.
- The element parses each target with `new URL`. The target must be a complete address. An `https:` or `http:` target has a host and no user name. A `mailto:` target has an address only, with no header fields.
- The element refuses a rich text with a target that the page does not permit, for example a script address, a `data:` address or a relative address. The refusal shows as text, and no button appears.
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
| `empty` | A rich text with no block shows `No text.` |
| `refused` | A status notice gives the reason as text. The element keeps no data. |

The authorship slot is required and must agree with the actor that the page or the thread binds. The thread accepts a rich text part and binds the actor of its envelope. To place rich text in a card, page code uses the page-owned `actions` slot of the card.

[examples/rich-text.html](../../examples/rich-text.html) shows an agent message with a heading, a list of three steps and one link. It also shows markup as text and a refused script address. [tests/browser/rich-text.js](../../tests/browser/rich-text.js) checks each node type, each refusal and the keyboard in the four media modes.
