# Interaction details

This page lists the interaction rules that each component of the kit follows. Issue #101 added them. `tests/browser/states.js` checks each rule in headless Chrome, in the light theme, the dark theme, forced colors and reduced motion.

## Control states

The base style in `src/render/dom.js` gives each control the same states. A control is a button, a text input, a radio option or the summary of a diff part.

| State | What a person sees |
| --- | --- |
| Hover | A button and a summary get a layer of 8% of their own text color. A text input gets a border in its text color. A radio option gets the layer on its row. |
| Pressed | The layer is 14%. A text input takes the focus and shows the focus ring. |
| Focus | An outline of 2px in `color.focus`, with an offset of 2px. The ring is the same in each component. |
| Disabled | An opacity of 0.6 and the `not-allowed` cursor. A disabled control shows no hover and no pressed state. The label of a disabled radio option has the same style. |
| Busy | A pending action has `aria-busy="true"` and the `progress` cursor. It accepts no second press. |
| Done | A completed action shows `Done` at full opacity. Its edge and state text use `color.success`. |

The layer uses the text color of the control, so each theme gives the states and the kit needs no new token. In forced colors, hover shows as a `Highlight` border on a button and a text input, and as a `Highlight` outline on a summary and a radio option. Pressed shows as a `Highlight` ground on a button and a summary. A disabled control uses `GrayText`.

An unavailable action button uses the surface color, the muted text color and the standard control edge at full opacity. In forced colors, a completed button uses `ButtonText` and the state text uses `CanvasText`.

The image button is one exception. The image covers the layer, so hover shows as a border in the text color, and pressed makes the image lighter.

The focus ring has two exceptions in its offset. A cell of a data grid has the ring inside its edge, so the scroll area does not cut it. A point of a chart has an offset of 3px, so the mark does not hide it. The width and the color are the same.

## Touch targets

Each touch target is 44 by 44 CSS pixels at the minimum. A radio and its label are one target. The cell of a data grid is the target of its editor, and each cell is 44 CSS pixels high at the minimum. The browser check measures each control in each shadow root, on each check page and each example page.

Two items are not in this rule. A link in a sentence of a rich text has the size of its text. A point of a chart has the size that its data gives.

## Actions

A pending action shows `Pending`, and its control has `aria-busy="true"` and `aria-disabled="true"`. A second press sends no second request. A valid receipt changes the state in the same task, with no delay and no animation. A receipt with `ok: false` shows `Not done`. If a required confirmation fails before send, the status shows `Not done: The request did not leave this device. Confirm the action and try again.`

An action button or form that gets no valid receipt stays pending. After a failed call or an invalid or refused result, the helper lets the element offer Retry and Cancel. The element also offers these controls after its wait limit. Retry sends the same key with a new id. The offline queue sets its own pending detail.

After a successful receipt, the action button and the submit buttons of both forms stay `aria-disabled="true"` and accept no second press. An action button in `icon` or `both` display shows a check and keeps its accessible name. A data grid shows `Done` and the receipt below the grid. A person can make another edit. An upload shows `Done` on each completed file. The Upload button uses the done style when all files are done, and a person can still choose more files up to the file limit.

## Empty and refused states

Each empty state and each refused state has a short text that tells the person what to do next.

| Component | State | Text |
| --- | --- | --- |
| `card-grid` | `empty` | `No cards. Change the request, or try again later.` |
| `table`, `data-grid` | `empty` | `No rows. Change the request, or try again later.` |
| `rich-text` | `empty` | `No text. Ask for the text again.` |
| `citation` | `empty` | `No source given. Ask for the source before you use this text.` |
| `source-status` | `empty` | `No records. Add a record, or try again later.` |
| `approval-queue` | `empty` | `No items need a decision. Check again later.` |
| `diff` | `empty` | `No changes. You do not need to review these versions.` |
| `diff`, one part | `empty` | `No changes. You do not need to review this part.` |
| Each component | `refused` | `This content did not show because it did not match the rules of the application.` Some components give a more specific sentence. |

The element shows the reason in the part `reason`. Then the part `next` shows `Ask for this content again. If the refusal shows again, tell the owner of the application.` A refused thread part uses the same display rules. A refused message also shows the same next step.

The part `details` is a closed disclosure with the label `Technical details`. When you open it, you can read the component name, if available, and the validation errors. The text stays plain. Press Tab to reach the label and Enter or Space to open or close the disclosure. The `Copy technical details` button copies the text inside. The element sends `mu-refused` with all errors in `event.detail.errors`.

The `text` primitive is one exception. An empty text shows nothing, because the application puts a text in a sentence or next to a label.

## Tables

A table of more than 30rem scrolls in its own area, and its column headers stay in view. The author of the table stays in view at the bottom of the area. The data grid has the same rule for its column headers and its row headers.

## Copy controls

A code block, a receipt reference and the technical details of a refusal each have a `Copy` button. A press writes the text to the clipboard. The button shows `Copied` for 2 seconds, only after the browser accepts the text. The accessible name of the button does not change. A status with `role="status"` gives `Copied` to a screen reader. If the browser refuses, the button shows `Not copied`, and the status tells the person to select the text and copy it.

The text goes only to the clipboard, and only after a person presses the button. The receipt reference and its copy control share a row below the action status. The control uses the standard control edge, which is less strong than its text. The target is at least 44 by 44 CSS pixels. If the row is too narrow, the control wraps below the reference. The action status stays in its own live region. The parts are `reference`, `copy` and `copy-status`.

## Motion

Each transition of the kit is `motion.fast`, which is 120 ms. The base style stops each transition and each animation when the person asks for reduced motion.

## Card collapse

The collapse toggle of a card shows a chevron by default. The chevron points down on a collapsed card and up on an expanded card. It is an inline SVG that the kit draws with `icon()` in `src/render/dom.js`, with `aria-hidden="true"`. No data goes into it. The button keeps its accessible name, for example `Expand Rivers and deltas`. Its tooltip shows that name on hover and on keyboard focus. The chevron turns in 120 ms. It turns at once under reduced motion. It uses the text color of the button, so it shows in forced colors.

A collapsed card has 8px between its header, its status, its short summary and its provenance, and no empty space below the last part. The controls of a card grid have 8px above them and 12px below their group, at each width from 375 CSS pixels up. The browser check measures the two rules at 375, 768 and 1280 CSS pixels with the tooltips closed.

## Contract changes

The five action components add `color.success` to their token lists. No data key, state or event changes. The base style uses `color.focus`, `color.danger`, `type.caption`, `space.2` and `motion.fast` for each component.
