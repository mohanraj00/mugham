# 0009: A compact visual design

Status: accepted, 2026-11-27. Issue: mohanraj00/mugham#204.

The owner looked at a prototype of this design on 2026-11-27 and chose option A for each of the four choices at the end of this note. The kit builds the decision in three PRs:

1. This note, the tokens, the target size, the icon display of the dialog and drawer close, and the icon save of the editable form.
2. The table and the data grid style, with the sort mark.
3. The approval accept, reject and confirm step, and the retry and cancel exits of a pending action.

## Context

The owner looked at the examples on 2026-11-27 and wrote these comments:

- Save can be a simple green check.
- Close can be an x.
- Sort can be a character icon, not a button.
- The data grid is plain.
- Accept, reject and confirm can be icons.
- The components must look compact and pleasing, not mechanical.

An audit of the 50 examples at 1280 px and 375 px found 51 problems. These are the main causes:

1. Each control has a minimum size of 44 px × 44 px. 44 px is the AAA target size (WCAG 2.5.5). The kit needs 24 px (WCAG 2.2, 2.5.8, AA). With a mouse, the large controls look heavy.
2. Each action is a filled accent button. Save, Approve, Reject and Open have the same color and weight, so a page has no hierarchy of actions.
3. Cards, fields, cells and buttons use the strong border color. Many strong lines make a grid of boxes.
4. Each field fills the full width of its form, also for a short value.
5. The data grid draws a strong border on each cell, uses 44 px rows and has a frame that is wider than its columns.
6. The sort control of a table is a boxed button in each header cell.

## Decision

### 1. Target size and density

The kit adds a control size token and a touch size token. A control uses the control size with a fine pointer (a mouse) and the touch size with a coarse pointer (a touch screen).

| Token | Default | Compact density | Use |
|---|---|---|---|
| `size.control` | 2rem (32 px) | 1.75rem (28 px) | The height and the minimum width of a button, a select and a text input. |
| `size.control-touch` | 2.75rem (44 px) | 2.75rem (44 px) | The same, with `@media (pointer: coarse)`. |
| `size.icon` | 1rem (16 px) | 0.875rem (14 px) | The size of an icon in a control. |
| `size.field` | 20rem | 18rem | The maximum width of a single-line field in an editable form. A long text field and a rich text field keep the full width. |

Each control of the kit uses `size.control` as its target size. With a coarse pointer, the base sheet of each kit element sets `size.control` to the value of `size.control-touch` on the host, and the default page style gives a plain button and a plain select the touch size. Thus each control of the kit has a target of 28 px or more with a mouse, and 44 px on a touch screen. 28 px is more than the 24 px minimum.

A theme must not set `size.control` below 1.5rem (24 px). The type scale and the space scale do not change. The compact density keeps its current type and space values, and now also makes the controls, the icons and the fields smaller.

### 2. The icon set

The kit keeps its own inline SVG icons. Each icon is a path constant on a 16 × 16 grid, with a 2 px round stroke. The kit adds no font and no dependency.

| Icon | Use |
|---|---|
| `check` | Save, approve, accept, done |
| `cross` | Close, dismiss, reject, cancel |
| `retry` | The retry exit of a pending action |
| `chevron` | Card toggle, disclosure |
| `sort-none` | A sortable column with no sort (PR 2) |
| `sort-up` | The ascending sort (PR 2) |
| `sort-down` | The descending sort (PR 2) |

An icon is decoration (`aria-hidden="true"`). The control that holds it keeps the full text as its accessible name, and the kit shows the same text as a tooltip on hover and on keyboard focus. Escape closes the tooltip.

### 3. Where an icon replaces the text

| Control | Owner of the text | Default | Icon |
|---|---|---|---|
| Dialog and drawer close | The application (`close_label`) | Icon | `cross` |
| Table sort | The application (column label) | Text with a sort mark | `sort-none`, `sort-up`, `sort-down` after the label |
| Confirm step of a check action: accept | The application (`confirm.label`) | Follows the action button | `check` |
| Confirm step of a check action: cancel | The kit (`Cancel`) | Follows the action button | `cross` |
| Pending exits: retry and cancel | The kit | Follows the action button | `retry`, `cross` |
| Editable form save | The application (`submit_label`) | Text. The binding can ask for an icon | The icon of the binding |
| Action button | The application (`label`) | Text. The binding can ask for an icon | The icon of the binding |

The sort control stays a button, because a person must reach it with the keyboard. The button has no frame. It shows the column label and a small sort mark. The `aria-sort` attribute of the header cell keeps the sort state for a screen reader.

### 4. Where the text stays

- An action with a large effect, for example "Delete the account" or "Send to all members". The application keeps the text display.
- An action with a meaning that an icon cannot show, for example "Open T-2041" or "Load image".
- The confirm step of an action with the `cross` icon (for example a reject) or the `delete` icon. A check for a rejection or two crosses in one step are not clear, so this step shows its text.
- The refusal and its next step (principle 6). The kit never makes the refusal an icon.
- Each kit control when the element or an ancestor has `control-display="text"`. In the icon display of an action button or an editable form, the control then shows its label next to its icon.

### 5. Color and weight of actions

| Action | Style |
|---|---|
| Save, approve, accept (icon `check`) | A filled success button with a white check. |
| Reject, close, cancel (icon `cross`) | A quiet button: no fill, a light border, the text color. |
| A primary text action | The filled accent button, with the new compact size. |
| Other text actions | The outline button, with the light border. |

Color is never the only signal. Each control has an icon shape and a text name, and the forced colors mode replaces each color with system colors.

### 6. The data grid

- Row lines: one line under each row in the light border color (`color.border-subtle`). No line between columns.
- Row height: the control size (`size.control`), with the space token `space.1` above and below the text.
- Header: the `color.surface-subtle` background, caption size text in the strong weight, and the muted text color. The header row is sticky as today.
- Row header cells: the normal weight.
- Number columns: the header aligns at the end, the same as its numbers. The numbers use tabular figures.
- Frame: the frame fits the columns (`inline-size: fit-content`, with `max-inline-size: 100%`). A wide grid scrolls in its frame.
- Focus: the focused cell keeps the 2 px focus ring inside the cell.
- Forced colors: each line becomes `CanvasText`.

The plain table (`mu-table`) gets the same row lines, header and sort marks.

### 7. The default of `control-display`, and the upgrade

Before this decision, `control-display` controlled only the card toggle, the two card grid controls and the two rich text link buttons. The default is `icon`.

These kit controls also follow `control-display`: the dialog and drawer close, the confirm step, the pending exits, and the icon display of an action button or an editable form. The default stays `icon`. An application that wants text sets `control-display="text"` on the element or an ancestor.

A kit element reads the setting when it renders and when it connects to the page. A change of the attribute on the element updates its controls. A change on a card or a card grid also updates the controls of the elements in it. A change on another ancestor applies at the next render or connection.

The action button and the editable form keep their own `display` binding, because the application owns their label. Their default stays `text`. Thus a label of the application never changes into an icon after an upgrade. The editable form accepts the `icon` and `display` keys in its binding, the same as the action button. This is an addition, so it is a minor release.

These are the effects for an application that upgrades, with the rules of decision 0008 (#17):

| Change | Class in 0008 | Release |
|---|---|---|
| New token names `size.control`, `size.control-touch`, `size.icon`, `size.field` | A new token name | Minor |
| Smaller control size, new row lines, new header style | Token values and shadow DOM | Provisional, minor |
| The dialog close shows an icon, with `close_label` as its name and tooltip | Shadow DOM, a default of a kit control | Minor, with an upgrade note |
| The confirm step follows the display of its action button | Shadow DOM | Minor, with an upgrade note |
| The `icon` and `display` keys in the editable form binding | A new optional key | Minor |
| New parts (`icon` and `tooltip` of the dialog, drawer and editable form, `sort-mark`) | A new part | Minor |

The upgrade note tells an application:

- If you want the old text close and the text confirm step, set `control-display="text"` on the page root.
- If you want the old 44 px targets with a mouse, set `--mu-size-control: 2.75rem` in your theme.
- The accessible name of each control does not change.

### 8. Tests

- The contract tests check each new icon name and each new binding key.
- The browser checks measure each control: 24 px or more and the control size with a fine pointer, and 44 px or more with a coarse pointer.
- The browser checks find the accessible name and the tooltip of each icon control, and check that Escape closes the tooltip.
- The tests that checked 44 px with a mouse now check the target token.
- The screenshot set and the contrast tests run in light, dark and forced colors.

## Owner choices

The owner chose option A for each choice on 2026-11-27.

### C1. Control size with a mouse

- **A. 32 px controls, 44 px on touch (chosen).** The page looks compact with a mouse, and a phone keeps the large target. The compact density gives 28 px.
- B. 28 px controls, 44 px on touch.
- C. Keep 44 px everywhere, and change only the borders and the colors.

### C2. Style of the save and approve icon

- **A. A filled green button with a white check (chosen).** Reject is a quiet button with an x.
- B. A green check with no fill, in a quiet button.
- C. Keep the accent color for all icon buttons.

### C3. Sort mark

- **A. An SVG arrow after the label (chosen).** The sorted column shows an up or a down arrow. Other columns that can sort show a faint double arrow.
- B. A text character (↑, ↓, ↕) after the label.
- C. Only the sorted column shows a mark.

### C4. Icon stroke

- **A. 2 px round stroke, as before (chosen).** The icons stay clear at 14 px and 16 px, and in forced colors.
- B. 1.5 px round stroke.

## Consequences

- The kit looks compact with a mouse and stays large on touch.
- An application label never changes into an icon without a change in the application.
- The browser checks that measured 44 px with a mouse now measure the control size.
- The screenshots in `docs/screenshots/` need a new set after the three PRs.
