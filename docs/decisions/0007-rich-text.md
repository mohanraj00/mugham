# 0007: Rich text as a tree of typed nodes

Status: proposed, 2026-11-17. Issue: mohanraj00/mugham#75.

## Context

An agent answer often has a heading, a list, a code sample or a link. The text part of a message shows only plain text. Principle 1 says that a model fills only declared components and never sends markup. Principle 5 says that untrusted content stays data, and that a link loads only after a person clicks it. The kit needs a rich text format that keeps these rules.

## Options

### Option A: a tree of typed nodes

- A fill is a tree. Each node is a fill of one small contract: paragraph, heading, list, code block, quote, text or link.
- The validator of contract format 2 checks each node, in Python and in JavaScript. The format needs no change.
- Advantages: the list of node types and attributes is fixed and has a test. An unknown node gets a refusal. No parser reads untrusted text.
- Disadvantages: a fill is longer than Markdown. A model must send structured data.

### Option B: a Markdown subset in the kit

- A fill has one text field with Markdown. The kit parses it and builds the same elements.
- Advantages: models write Markdown easily. A fill is short.
- Disadvantages: Markdown has many dialects and many ambiguous cases. A parser of untrusted text is a large surface for a security review. Markdown permits raw HTML, so the parser must find and refuse it. A partial message can have Markdown that is not complete. The kit has no dependency, so it must write and maintain the parser.

### Option C: sanitized HTML

- A fill has HTML, and the kit removes each element and attribute that is not in a list.
- Disadvantages: this breaks principle 1 and principle 5. A sanitizer is a known source of defects. Rejected.

## Decision

Implement Option A. The contracts are `rich-text`, `rich-paragraph`, `rich-heading`, `rich-list`, `rich-code`, `rich-quote`, `rich-span` and `rich-link`. [src/components/rich-text.md](../../src/components/rich-text.md) gives the rules.

The kit does not accept Markdown. An application or an adapter can change a Markdown subset to the tree before it sends the fill. This is the mapping:

| Markdown | Node |
|---|---|
| A paragraph | `rich-paragraph` |
| `#`, `##`, `###` | `rich-heading` with `level` 1, 2 or 3. A deeper heading gets `level` 3. |
| A list with `-` or `*` | `rich-list` |
| A list with `1.` | `rich-list` with `ordered` set to `true` |
| A fenced or indented code block | `rich-code`. The language name is not kept. |
| `>` | `rich-quote`, with one `rich-paragraph` for each paragraph |
| `*text*` | `rich-span` with `mark` set to `emphasis` |
| `**text**` | `rich-span` with `mark` set to `strong` |
| `` `text` `` | `rich-span` with `mark` set to `code` |
| A link: the text in square brackets, then the address in round brackets | `rich-link` |
| A line break in a paragraph | A line break character in the text of a `rich-span` |
| Raw HTML, an image, a table, a nested list and each other construct | A `rich-span` with the source text. The adapter never sends markup. |

The adapter runs outside the kit, and the kit validates its result as each other fill. Thus a defect in an adapter cannot add an element or an attribute.

These limits apply:

- A span has one mark. Text that is strong and emphasized needs one of the two marks.
- A list item and a quote paragraph hold inline nodes only. A list cannot contain a list, because a contract cannot contain itself.
- A link is a button with no address attribute. Page code sets the permitted schemes. The default is `https:` only, and the page can add `http:` and `mailto:`.
- Page code sets the page level of a level 1 heading. A fill cannot skip a heading level.

Review: if models and adapters need nested lists or tables in rich text, write a new decision record. A nested list needs a change of contract format 2, which is a level 1 change.

## Checks

Write these expected results before the implementation runs:

| Input | Expected result |
|---|---|
| A tree with each node type | Each node shows as its fixed element, in order |
| An unknown block type or inline type | Refused, with the list of permitted types |
| A node with `style`, `class`, `onclick`, `href` or `id` | Refused: the contract does not declare this field |
| HTML and script text in each text | The text shows as text. No element and no handler appears |
| A script address, a `data:` address or a relative address in a link | Refused: the page does not permit this link |
| An `http:` or `mailto:` link with the default policy | Refused |
| The same link after the page permits the scheme | The link shows, and the target shows on hover and on focus |
| A press of a link | A cancelable `mu-open` event, then a new tab with no opener and no referrer |
| A first heading of level 2, or level 1 then level 3 | Refused: a heading cannot skip a level |
| Level 1, 2 and 3 with the first page level 5 | `h5`, `h6` and `h6` |
| More than 2000 inline nodes | Refused |

`tests/test_rich_text.py` and `tests/rich-text.test.mjs` check the contracts with the two validators. `tests/browser/rich-text.js` checks the element in the four media modes. `examples/rich-text.html` shows an agent message with rich text in a thread.
