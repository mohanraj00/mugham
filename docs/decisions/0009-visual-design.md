# 0009: A compact visual design

Status: proposed, 2026-11-27. Issue: mohanraj00/mugham#204.

This note is a draft for an owner choice. Phase 1 of #204 has a prototype on the branch `claude/204-design-review`. The prototype changes the tokens and a small set of components so that the owner can see the direction. Phase 1 merges nothing. After the owner chooses, phase 2 builds the result in PRs, contract first.

## Context

The owner looked at the examples on 2026-11-27 and wrote these comments:

- Save can be a simple green check.
- Close can be an x.
- Sort can be a character icon, not a button.
- The data grid is plain.
- Accept, reject and confirm can be icons.
- The components must look compact and pleasing, not mechanical.

The audit of the 50 examples is in `outputs/204/audit.md` of the local work folder. It has 51 findings. These are the main causes:

1. Each control has a minimum size of 44 px × 44 px. 44 px is the AAA target size (WCAG 2.5.5). The kit needs 24 px (WCAG 2.2, 2.5.8, AA). With a mouse, the large controls look heavy.
2. Each action is a filled accent button. Save, Approve, Reject and Open have the same color and weight, so a page has no hierarchy of actions.
3. Cards, fields, cells and buttons use the strong border color. Many strong lines make a grid of boxes.
4. Each field fills the full width of its form, also for a short value.
5. The data grid draws a strong border on each cell, uses 44 px rows and has a frame that is wider than its columns.
6. The sort control of a table is a boxed button in each header cell.

## Decision (proposed)

### 1. Target size and density

The kit adds a control size token and a touch size token. A control uses the control size with a fine pointer (a mouse) and the touch size with a coarse pointer (a touch screen).

| Token | Default | Compact density | Use |
|---|---|---|---|
| `size.control` | 2rem (32 px) | 1.75rem (28 px) | The height and the minimum width of a button, a select and a text input. |
| `size.control-touch` | 2.75rem (44 px) | 2.75rem (44 px) | The same, with `@media (pointer: coarse)`. |
| `size.icon` | 1rem (16 px) | 0.875rem (14 px) | The size of an icon in a control. |
| `size.field` | 20rem | 18rem | The maximum width of a single-line field in a form. A long text field and a rich text field keep the full width. |

Each shadow root and the page style read one computed value, `--mu-target`. The base sheet sets it from `size.control` and, for a coarse pointer, from `size.control-touch`. Thus each control of the kit has a target of 28 px or more. 28 px is more than the 24 px minimum. On a phone, the target stays at 44 px.

The type scale and the space scale do not change. The compact density keeps its current type and space values, and now also makes the controls smaller.

### 2. The icon set

The kit keeps its own inline SVG icons. Each icon is a path constant on a 16 × 16 grid, with a 2 px round stroke. The kit adds no font and no dependency.

| Icon | Use | Status |
|---|---|---|
| `check` | Save, approve, accept, done | Exists |
| `cross` | Close, dismiss, reject, cancel | Exists |
| `chevron` | Card toggle, disclosure | Exists |
| `sort-none` | A sortable column with no sort | New |
| `sort-up` | The ascending sort | New |
| `sort-down` | The descending sort | New |
| `more` | A menu of more actions | New, phase 2 |

An icon is decoration (`aria-hidden="true"`). The control that holds it keeps the full text as its accessible name, and the kit shows the same text as a tooltip on hover and on keyboard focus. Escape closes the tooltip.

### 3. Where an icon replaces the text

| Control | Owner of the text | Default | Icon |
|---|---|---|---|
| Dialog and drawer close | The application (`close_label`) | Icon | `cross` |
| Table sort | The application (column label) | Text with a sort mark | `sort-none`, `sort-up`, `sort-down` after the label |
| Confirm step: accept | The application (`confirm.label`) | Follows the action button | `check` |
| Confirm step: cancel | The kit (`Cancel`) | Follows the action button | `cross` |
| Pending exits: retry and cancel | The kit | Follows the action button | `retry`, `cross` |
| Editable form save | The application (`submit_label`) | Text. The binding can ask for an icon | `check` |
| Action button | The application (`label`) | Text. The binding can ask for an icon | The icon of the binding |

The sort control stays a button, because a person must reach it with the keyboard. The button has no frame. It shows the column label and a small sort mark. The `aria-sort` attribute of the header cell keeps the sort state for a screen reader.

### 4. Where the text stays

- An action with a large effect, for example "Delete the account" or "Send to all members". The application keeps the text display.
- An action with a meaning that an icon cannot show, for example "Open T-2041" or "Load image".
- The confirm step of a destructive action. In the prototype, a confirm step shows text if the action button uses the `delete` icon. Phase 2 can add a `destructive` flag to the confirm binding.
- The refusal and its next step (principle 6). The kit never makes the refusal an icon.
- Each control when an ancestor has `control-display="text"`.

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
- Row header cells: the normal weight. The kit does not know a total row, so an application marks it with a page style on a declared part.
- Number columns: the header aligns at the end, the same as its numbers. The numbers use tabular figures.
- Frame: the frame fits the columns (`inline-size: fit-content`, with `max-inline-size: 100%`). A wide grid scrolls in its frame.
- Focus: the focused cell keeps the 2 px focus ring inside the cell.
- Forced colors: each line becomes `CanvasText`.

The plain table (`mu-table`) gets the same row lines, header and sort marks.

### 7. The default of `control-display`, and the upgrade

Today, `control-display` controls only the card toggle, the two card grid controls and the two rich text link buttons. The default is `icon`.

The proposal makes these kit controls also follow `control-display`: the dialog and drawer close, the confirm step, the pending exits and the table sort mark. The default stays `icon`. An application that wants text sets `control-display="text"` on an ancestor.

The action button and the editable form keep their own `display` binding, because the application owns their label. Their default stays `text`. Thus a label of the application never changes into an icon after an upgrade. The editable form gets the `icon` and `display` keys in its binding, the same as the action button. This is an addition, so it is a minor release.

These are the effects for an application that upgrades, with the rules of decision 0008 (#17):

| Change | Class in 0008 | Release |
|---|---|---|
| New token names `size.control`, `size.control-touch`, `size.icon`, `size.field` | A new token name | Minor |
| Smaller control size, new row lines, new header style | Token values and shadow DOM | Provisional, minor |
| The dialog close shows an icon, with `close_label` as its name and tooltip | Shadow DOM, a default of a kit control | Minor, with an upgrade note |
| The confirm step follows the display of its action button | Shadow DOM | Minor, with an upgrade note |
| New icon names in the action button `icon` enum | A new enum value | Minor |
| The `icon` and `display` keys in the editable form binding | A new optional key | Minor |
| No declared part changes its name. New parts (`sort-mark`) | A new part | Minor |

The upgrade note tells an application:

- If you want the old text close and the text confirm step, set `control-display="text"` on the page root.
- If you want the old 44 px targets with a mouse, set `--mu-size-control: 2.75rem` in your theme.
- The accessible name of each control does not change.

### 8. Tests in phase 2

- The contract tests check each new icon name and each new binding key.
- The browser checks measure each control: 24 px or more with a fine pointer, 44 px or more with a coarse pointer.
- The browser checks find the accessible name and the tooltip of each icon control, and check that Escape closes the tooltip.
- The tests that check 44 px today change to check the target token.
- The screenshot set and the contrast tests run in light, dark and forced colors.

## Owner choices

Each choice gives my recommendation first.

### C1. Control size with a mouse

- **A. 32 px controls, 44 px on touch (recommended).** The page looks compact with a mouse, and a phone keeps the large target. The compact density gives 28 px.
- B. 28 px controls, 44 px on touch. The most compact view. It is near the size of a dense desktop tool.
- C. Keep 44 px everywhere, and change only the borders and the colors. The safest target, but the page still looks heavy.

### C2. Style of the save and approve icon

- **A. A filled green button with a white check (recommended).** The action is clear as a button, and the color tells the meaning. Reject is a quiet button with an x.
- B. A green check with no fill, in a quiet button. The lightest view, but the button edge is less clear.
- C. Keep the accent color for all icon buttons. One color for each action, as today.

### C3. Sort mark

- **A. An SVG arrow after the label. The sorted column shows an up or a down arrow. Other columns show a faint double arrow (recommended).** The mark is the same in each font, and each column tells that it can sort.
- B. A text character (↑, ↓, ↕) after the label. This is what the owner wrote, but the shape changes with the font.
- C. Only the sorted column shows a mark. The header is quiet, but a person does not see which columns can sort.

### C4. Icon stroke

- **A. 2 px round stroke, as today (recommended).** The icons stay clear at 14 px and 16 px, and in forced colors.
- B. 1.5 px round stroke. The icons look lighter, but a thin line is less clear at the compact size.

## Prototype on the branch

The prototype shows the direction. It is not the phase 2 code.

- Tokens: `size.control`, `size.control-touch`, `size.icon` and `size.field`. Each control of the kit uses `--mu-target` in place of 44 px.
- Editable form: an optional check icon for save, in the success color. The status is next to the button. Single-line fields have a maximum width.
- Dialog and drawer: the close button is an x, with the close label as its name and tooltip.
- Table: the sort button has no frame and shows a sort mark.
- Data grid: light row lines, compact rows, a distinct header, end-aligned number headers and a frame that fits the columns.
- Action button: the check is green, the cross is quiet, and the confirm step and the pending exits follow the display of the button.
- Examples: the pickup branch form, the approvals card and the garden form ask for the icon display.

## Consequences

- The kit looks compact with a mouse and stays large on touch.
- An application label never changes into an icon without a change in the application.
- Many browser checks that measure 44 px must change in phase 2.
- The screenshots in `docs/screenshots/` need a new set after phase 2.
