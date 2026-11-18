# Interaction details

This page lists the interaction rules that each component of the kit follows. Issue #101 added them. `tests/browser/states.js` checks each rule in headless Chrome, in the light theme, the dark theme, forced colors and reduced motion.

## Control states

The base style in `src/render/dom.js` gives each control the same states. A control is a button, a text input, a radio option or the summary of a diff part.

| State | What a person sees |
| --- | --- |
| Hover | A button and a summary get a layer of 8% of their own text color. A text input gets a border in its text color. A radio option gets the layer on its row. |
| Pressed | The layer is 14%. A text input takes the focus and shows the focus ring. |
| Focus | An outline of 2px in `color.focus`, with an offset of 2px. The ring is the same in each component. |
| Disabled | An opacity of 0.6 and the `not-allowed` cursor. A disabled control shows no hover and no pressed state. |
| Busy | A pending action has `aria-busy="true"` and the `progress` cursor. It accepts no second press. |

The layer uses the text color of the control, so each theme gives the states and the kit needs no new token. In forced colors, hover shows as a `Highlight` border on a button and a text input, and as a `Highlight` outline on a summary and a radio option. Pressed shows as a `Highlight` ground on a button and a summary. A disabled control uses `GrayText`.

The image button is one exception. The image covers the layer, so hover shows as a border in the text color, and pressed makes the image lighter.

The focus ring has two exceptions in its offset. A cell of a data grid has the ring inside its edge, so the scroll area does not cut it. A point of a chart has an offset of 3px, so the mark does not hide it. The width and the color are the same.

## Touch targets

Each touch target is 44 by 44 CSS pixels at the minimum. A radio and its label are one target. The cell of a data grid is the target of its editor, and each cell is 44 CSS pixels high at the minimum. The browser check measures each control in each shadow root, on each check page and each example page.

Two items are not in this rule. A link in a sentence of a rich text has the size of its text. A point of a chart has the size that its data gives.

## Actions

A pending action shows `Pending`, and its control has `aria-busy="true"` and `aria-disabled="true"`. A second press sends no second request. The receipt changes the state in the same task, with no delay and no animation.

## Empty and refused states

Each empty state and each refused state has a short text that tells the person what to do next.

| Component | State | Text |
| --- | --- | --- |
| `card-grid` | `empty` | `No cards. Change the request, or try again later.` |
| `table`, `data-grid` | `empty` | `No rows. Change the request, or try again later.` |
| `rich-text` | `empty` | `No text. Ask for the text again.` |
| `citation` | `empty` | `No source given. Ask for the source before you use this text.` |
| `source-status` | `empty` | `No records. Add a record, or try again later.` |
| `diff` | `empty` | `No changes. You do not need to review these versions.` |
| `diff`, one part | `empty` | `No changes. You do not need to review this part.` |
| Each component | `refused` | `Refused <name>: <first error>`, then `Ask for this content again. If the refusal shows again, tell the owner of the application.` |

The refusal is one status. The part `reason` holds the reason, and the part `next` holds the next step. A refused part of a thread and a refused message show the same next step.

The `text` primitive is one exception. An empty text shows nothing, because the application puts a text in a sentence or next to a label.

## Tables

A table of more than 30rem scrolls in its own area, and its column headers stay in view. The author of the table stays in view at the bottom of the area. The data grid has the same rule for its column headers and its row headers.

## Copy controls

A code block of a rich text and the reference of a receipt have a `Copy` button, with the names `Copy code` and `Copy reference`. A press writes the text to the clipboard. The button shows `Copied` for 2 seconds, only after the browser accepts the text. A status with `role="status"` gives `Copied` to a screen reader. If the browser refuses, the button shows `Not copied`, and the status tells the person to select the text and copy it.

The text goes only to the clipboard, and only after a person presses the button. The copy control of a reference comes after the status of the action and not in it, because the status is a live region for text. The parts are `copy` and `copy-status`.

## Motion

Each transition of the kit is `motion.fast`, which is 120 ms. The base style stops each transition and each animation when the person asks for reduced motion.

## Card collapse

The collapse toggle of a card shows a chevron after its text. The chevron points down on a collapsed card and up on an expanded card. It is an inline SVG that the kit draws with `icon()` in `src/render/dom.js`, with `aria-hidden="true"`. No data goes into it. The button keeps its accessible name, for example `Expand Rivers and deltas`. The chevron turns in 120 ms, and with no animation under reduced motion. It uses the text color of the button, so it shows in forced colors.

A collapsed card has 8px between its header, its status, its short summary and its provenance, and no empty space below the last part. The controls of a card grid have 8px above them and 12px below them, at each width from 375 CSS pixels up. The browser check measures the two rules at 375, 768 and 1280 CSS pixels.

## No contract change

These rules change no contract key and no token list. The base style uses `color.focus`, `color.danger`, `type.caption`, `space.2` and `motion.fast` for each component.
