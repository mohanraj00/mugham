# Card and card grid

`mu-card` shows a title, an optional summary, date, facts and provenance. The application puts action controls in the `actions` slot. A fill cannot add an action.

## Collapse

The optional data key `collapsible: true` adds one native header button. `collapsed: true` starts the card collapsed. If `collapsible` is false or absent, `collapsed` has no effect and the card has no toggle. An expanded collapsible card has `data-state="expanded"`. A collapsed card has `data-state="collapsed"`. Other cards keep `data-state="default"`.

The button has `aria-expanded` and `aria-controls`. Enter and Space toggle the card. The button stays in the DOM, so focus stays on it. If page code collapses a card while focus is in its body or actions, focus goes to the toggle. A collapsed card shows its title, optional `status` text and optional `collapsed_summary` text. The short summary has at most 200 characters. The body, provenance and actions are hidden and leave the keyboard order. Collapse changes no action control or action state.

Page code can read and set the boolean property `card.collapsed`. A card refuses a collapse while an action in the card is pending, waits for a receipt or shows a confirm step. A pending action that starts in a collapsed card expands it. This rule also applies to nested action controls and actions added after the fill. A receipt does not collapse the card.

Each change sends a bubbling, composed `mu-collapse` event with `detail: { collapsed: boolean }`. Initial rendering sends no event. A new fill resets the start state and sends the event if the state changes. A refused collapse and a request for the current state send no event. The kit uses no browser storage for this state. The application can listen to the event and give the next fill its chosen start state.

The toggle uses the parts `toggle` and `title`. Its controlled area uses `body`, and the short summary uses `collapsed-summary`. The status uses `status`. The toggle has a visible border in forced colors. The card has no height animation, including under reduced motion.

## Grid controls

The optional grid data key `collapse_controls: true` adds `Expand all` and `Collapse all` buttons above a nonempty list. The controls affect only collapsible cards. They keep focus on the pressed grid button and use the pending rule of each card. Each card that changes sends its own event. An empty grid keeps its empty text and has no controls.

[examples/loans.html](../../examples/loans.html) shows a collapsible card and a grid with both controls.
