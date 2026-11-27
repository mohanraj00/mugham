# Rich text field

Use `mu-rich-text-field` to edit paragraphs, headings, lists, quotes, code blocks, links and inline marks. See the [contract](../../catalog/rich-text-field.json) and the [library note editor](../../examples/apps/library-note.html).

## Value and form

The value is a nested `rich-text` fill with `component`, `version` and `data`. Give the blocks in `data.blocks`. The default value has an empty list. The value follows the [rich text rules](../components/rich-text.md), including the heading order, text and node limits and the current link schemes. If the page removes a scheme, the field changes links with that scheme to plain text.

Give a field name and label when you add the field to an editable form. Give the same name and label in the action's `editable` object. The form sends a copy of the rich text fill under that name. The [offline queue](../../docs/contracts/offline-queue.md) accepts this value within its record size limit. To display the submitted value with `mu-rich-text`, set the authorship slot in page code.

- Set `required` to require text. The form shows an error for a value with no text other than spaces or line breaks.
- Set `error` to show a message from the application, or `hint` to show instructions.
- Set `read_only` to keep the text available for reading and copying. The form can still send its value.
- Set `disabled` to remove its controls from the tab order and leave its value out of the request.
- Set `typed` and bind the edit type in the form to record whether the person made a judgment, correction or override.

## Edit

Tab moves into the format toolbar, then into the editable area. In the toolbar, use the arrow keys to move between buttons, Home for the first button and End for the last. Press Enter or Space to apply a format. Select text before you apply a mark. At a caret, an inline mark applies to new typing. Use Control or Command with B for strong, I for emphasis, E for inline code and K for a link.

Each format button shows a symbol. The `icon` stroke uses the button text color. The `tooltip` part shows the format name below the buttons when you move the pointer over a button or move the focus to it. Press Escape to close the tooltip. See the [theme rules](../../docs/guides/theme.md#what-a-page-must-not-change).

If a heading skips a level, the editor keeps the last valid value and shows the highest level you can use at that position.

Use the link control to enter a full address. The page must permit its scheme. Press Escape to close the address control and return to the editable area. Select a link and press Link again to remove it. A click in the editable text does not open a link.

The editor reads paste and drop as data. It keeps supported blocks and text. It drops unsafe elements and uses only link addresses that the page permits. In a page with a Content Security Policy, the browser can report a violation for an inline event handler attribute, which the editor discards from the pasted HTML without running the handler. An edit that exceeds a limit leaves the last valid value in place and shows a message below the editor.

The browser check shows that the inert document where the editor parses pasted HTML starts no request.
