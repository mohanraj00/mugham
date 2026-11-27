# Card and card grid

`mu-card` shows a title, an optional summary, date, facts and provenance. The application puts action controls in the `actions` slot. A fill cannot add an action.

The card is an article with its title as its accessible name. Each fact label and value align on the baseline. A card in a thread uses `--mu-color-surface-subtle` and shows its edge in forced colors.

The author line shows the name first and shows the type and id in muted text, as in `Author: Catalog agent (agent, a-catalog)`. If the author has no name, the line shows `Author: agent, a-catalog`. If the author and the message actor have the same type and id, the visible line shows `Author: same as the message`. A screen reader reads the full author line. If the card gives no name for that actor, the full line uses the name from the message when available. A different author shows in full.

## Collapse

The optional data key `collapsible: true` adds one native header button. `collapsed: true` starts the card collapsed. If `collapsible` is false or absent, `collapsed` has no effect and the card has no toggle. An expanded collapsible card has `data-state="expanded"`. A collapsed card has `data-state="collapsed"`. Other cards keep `data-state="default"`.

The button has `aria-expanded` and `aria-controls`. Enter and Space toggle the card. The button stays in the DOM, so focus stays on it. If page code collapses a card while focus is in its body or actions, focus goes to the toggle. A collapsed card shows its title, optional `status` text and optional `collapsed_summary` text. The short summary has at most 200 characters. The provenance stays visible near the header in both states, including when the card starts collapsed. It shows the author and any citation only once. The body and actions are hidden and leave the keyboard order. Collapse changes no action control or action state.

Page code can read and set the boolean property `card.collapsed`. A card refuses a collapse while an action in the card needs a receipt or shows a confirm step or a failed receipt. This rule applies to the property and to a fill with `collapsed: true`. An action that needs a receipt or shows a failed receipt expands a collapsed card. This rule also applies to nested action controls and actions added after the fill. The card can collapse after the action leaves the error state, if no other action needs it to stay open. A receipt does not collapse the card.

Each change sends a bubbling, composed `mu-collapse` event with `detail: { collapsed: boolean }`. Initial rendering sends no event. A new fill resets the start state and sends the event if the state changes. A refused collapse and a request for the current state send no event. The kit uses no browser storage for this state. The application can listen to the event and give the next fill its chosen start state.

The toggle uses the parts `toggle` and `title`. Its controlled area uses `body`, and the short summary uses `collapsed-summary`. The status uses `status`. The toggle has a visible border in forced colors. The card has no height animation, including under reduced motion.

The toggle shows a chevron by default. The chevron points down on a collapsed card and up on an expanded card. The `icon` part takes the button text color. The button has the accessible name `Expand <title>` or `Collapse <title>`. The `tooltip` part shows that name below the header on hover and on keyboard focus. Escape closes the tooltip. A collapsed card has 8px between its parts and no empty space below the last part. [Interaction details](interaction.md#card-collapse) gives the rules.

## Grid controls

The optional grid data key `collapse_controls: true` adds `Expand all` and `Collapse all` buttons above a nonempty list. The controls affect only collapsible cards. They keep focus on the pressed grid button. `Collapse all` skips a card while an action in it needs a receipt or shows a confirm step or a failed receipt. Each card that changes sends its own event. An empty grid keeps its empty text and has no controls. The controls have 8px above them and 12px below them, at each width from 375 CSS pixels up.

Use the `expand-all` and `collapse-all` parts to style the buttons. The `icon` part shows a double chevron down for expand and a double chevron up for collapse. The `tooltip` part shows the name of the icon button below the controls on hover and on keyboard focus. Escape closes it. The grid also exports the `card-tooltip` part of each nested card.

Set `control-display="text"` on a card, its grid or an ancestor to show the text labels. The card keeps its chevron after the label. Set the attribute on an ancestor before the fill or before you attach the filled element. An attribute change on a card or grid updates its controls. A grid also updates its nested cards. Read the [control display rules](../../docs/guides/theme.md#control-display).

[examples/cards/loans.html](../../examples/cards/loans.html) shows a collapsible card and a grid with both controls.
