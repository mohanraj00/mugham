# Theme the kit

Set a preset on the page, then change individual tokens in a style sheet if necessary. The [component gallery](../../examples/guides/gallery.html) shows all three presets in light and dark mode.

## How a theme works

Each kit element reads its style from CSS custom properties. `src/tokens/tokens.css` sets them on `:root`. A custom property goes into each shadow root of the page, so an element uses the value of its nearest ancestor that sets it. Thus a page can theme the full page on `:root`, or only one part of the page on a container element.

The shadow root of each element keeps its own rules. A page style can select its parts by name. The optional [default page style](#the-default-page-style) styles the page around the elements, and it uses only the tokens.

`tools/tokens.py --write` writes `tokens.css` from `src/tokens/tokens.json`. Do not edit `tokens.css`. To change the kit tokens, change `tokens.json`. A page theme sets the properties in its own style sheet.

## The tokens

Each token has a light value and a dark value. The table gives the CSS property, the kit values and the use.

| CSS property | Light | Dark | Use |
|---|---|---|---|
| `--mu-color-surface` | `#ffffff` | `#171b21` | The ground of a standalone card, a form, a message and a secondary button. |
| `--mu-color-surface-subtle` | `#eff2f5` | `#1f242b` | The ground of a card in a thread message and of a nested group. Use the text and muted text tokens on it. |
| `--mu-color-page` | `#f7f8fa` | `#0f1217` | The ground of a page in the default page style. |
| `--mu-color-text` | `#141a23` | `#e6e9ee` | The text on the surface. |
| `--mu-color-text-muted` | `#566170` | `#9ba5b1` | Captions, labels of facts, the actor type and the state text. |
| `--mu-color-border` | `#7c8694` | `#6f7986` | The edge of a control, for example a field or a button. The edge of a card, a form and a message is a lighter mix of this color. |
| `--mu-color-border-subtle` | `#e0e4ea` | `#2a3038` | A rule of the default page style, for example the line below the page header. It is never the edge of a control. |
| `--mu-color-accent` | `#1f5fbf` | `#8cb4f5` | The ground of a primary button, and the mark of an agent message. |
| `--mu-color-on-accent` | `#ffffff` | `#0b1a33` | The text on the accent. |
| `--mu-color-focus` | `#1f5fbf` | `#8cb4f5` | The focus ring. |
| `--mu-color-danger` | `#a3231a` | `#f4aba4` | A refusal, an error and `Not done`. |
| `--mu-color-success` | `#1b7a45` | `#73d39f` | The edge and state text of a completed action. |
| `--mu-color-on-success` | `#ffffff` | `#082519` | Text on a success label. |
| `--mu-color-warning`, `--mu-color-on-warning` | `#774a00`, `#ffffff` | `#ffca76`, `#2c1900` | The ground and text of a warning label. |
| `--mu-color-info`, `--mu-color-on-info` | `#215d85`, `#ffffff` | `#9bd7ff`, `#0c2336` | The ground and text of an information label. |
| `--mu-color-hover`, `--mu-color-on-hover` | `#eef2f7`, `#141a23` | `#252d39`, `#e6e9ee` | The ground and text of a control under the pointer. |
| `--mu-color-selected`, `--mu-color-on-selected` | `#e2ecfb`, `#102b55` | `#293c58`, `#ecf3ff` | The ground and text of a selected control. |
| `--mu-type-body` | `400 0.9375rem/1.55` | same | The body text, as a `font` value with the font stack. |
| `--mu-type-caption` | `400 0.75rem/1.5` | same | Captions and state text, as a `font` value with the font stack. |
| `--mu-type-weight-strong` | `600` | same | A title and an actor name. |
| `--mu-type-heading-1`, `--mu-type-heading-2`, `--mu-type-heading-3` | `600 2rem/1.15`, `600 1.5rem/1.25`, `600 1.125rem/1.35` | same | The headings of the default page style, as `font` values with the font stack. |
| `--mu-type-code` | `400 0.84375rem/1.6` | same | Code in the default page style, as a `font` value with the code font stack. |
| `--mu-space-1`, `--mu-space-2`, `--mu-space-3`, `--mu-space-4` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem` | same | The gaps and the padding. |
| `--mu-space-5`, `--mu-space-6` | `1.5rem`, `2rem` | same | The larger spaces of the default page style. |
| `--mu-radius-1`, `--mu-radius-2` | `0.375rem`, `0.625rem` | same | The corners. |
| `--mu-radius-3`, `--mu-radius-pill` | `1rem`, `9999px` | same | A large corner and a fully rounded end. |
| `--mu-elevation-1` | `0 1px 3px #141a2326` | `0 1px 3px #00000080` | The shadow of a group. |
| `--mu-elevation-2` | `0 4px 12px #141a2333` | `0 4px 12px #00000099` | The shadow of a raised surface. |
| `--mu-motion-fast` | `120ms` | same | The time of a transition. It is `0ms` in reduced motion. |
| `--mu-easing-standard`, `--mu-easing-enter` | `cubic-bezier(0.2, 0, 0, 1)`, `cubic-bezier(0, 0, 0.2, 1)` | same | The curves of a standard transition and a transition that shows new content. |
| `--mu-size-column-narrow`, `--mu-size-column-medium`, `--mu-size-column-wide` | `12rem`, `16rem`, `22rem` | same | The minimum column width of a grid. A table column is from half of the narrow size to the wide size. |
| `--mu-size-page` | `64rem` | same | The maximum width of the content in the default page style. |
| `--mu-size-control` | `2rem` | same | The target size of a control with a fine pointer (a mouse): the minimum height and width of a button, a select and a text input. |
| `--mu-size-control-touch` | `2.75rem` | same | The target size of a control with a coarse pointer (a touch screen). Each kit element and the default page style use it in place of `--mu-size-control` when the pointer is coarse. |
| `--mu-size-icon` | `1rem` | same | The size of an icon in a control. |
| `--mu-size-field` | `20rem` | same | The maximum width of a single-line field in an editable form. |

The font stack of the body, caption and heading tokens is `Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif`. The font stack of the code token is `Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. The kit loads no font. If the page does not supply the first font of a stack, the browser uses the next font of the stack. [docs/brand/](../brand/README.md) gives the base colors, spacing and type.

Each contract lists the tokens of its component in its `tokens` key. `tests/test_tokens.py` checks that each of them exists.

## Presets and color mode

Set `data-mu-theme` on `<html>` to select a preset.

| Value | Effect |
|---|---|
| `neutral` | The default colors, type and spacing. The page also uses this preset when the attribute is absent. |
| `high-contrast` | Stronger contrast for text, control edges and focus rings. |
| `compact` | The neutral colors with the type sizes, spacing and column widths of [compact density](#compact-density-and-full-width). |

Each preset has light and dark values. Set `data-mu-mode="light"` or `data-mu-mode="dark"` on `<html>` to select a mode. For example, use `<html lang="en" data-mu-theme="high-contrast" data-mu-mode="dark">`. Without a mode attribute, the kit follows the browser preference. Existing pages can continue to use `data-mu-theme="light"` or `data-mu-theme="dark"` for the neutral preset.

To change a few tokens of a preset, load a page style sheet after `tokens.css`. For example, use `:root[data-mu-theme="compact"]` and set `--mu-radius-2` to `0.5rem` and `--mu-space-5` to `1.25rem`. The rule applies in both modes. To change a color, also set the matching foreground or ground and [check the contrast](#the-contrast-of-a-theme) in each mode.

After a successful receipt, the action shows `Done` at full opacity. The action button and the form submit buttons use `--mu-color-success` for their edge and text. An action button with an icon display shows a check. The data grid uses this color in its receipt below the grid, and the upload uses it on each completed file. If you set this token, keep a text contrast of at least 4.5:1 against the surface and the page ground. The copy control uses the standard control edge and can wrap below the reference.

`mu-status` uses success colors for `Passed` and warning colors for `Pending`. The label text and border pattern show the state in each preset and in forced colors.

## Forced colors and reduced motion

In forced colors, each element uses system colors: `ButtonText` and `ButtonFace` for a button, `CanvasText` for an edge and the state text, and `Highlight` for the focus ring. A completed button uses `ButtonText`. An unavailable action button uses `GrayText`. The tokens have no effect on these colors.

In reduced motion, `tokens.css` sets `--mu-motion-fast` to `0ms`. Each shadow root also removes each transition and each animation with an `!important` rule. Thus a theme cannot turn motion on again in reduced motion.

## The default page style

`src/styles/page.css` is the default style of a page. It styles only the page around the kit elements: the ground, the width, the page header, the headings, the text, the links, the code, and the plain tables and controls of the page. Each color, each type size and each space comes from a token, so a theme of the tokens also changes the page. The style loads no font and makes no request.

To use the default style, link it after the tokens:

<!-- source: examples/guides/theme.html -->
```html
  <link rel="stylesheet" href="../../src/tokens/tokens.css">
  <link rel="stylesheet" href="../../src/styles/page.css">
```

The style gives these rules:

| Part of the page | Rule |
|---|---|
| `body` | The ground `--mu-color-page`, the text color `--mu-color-text` and the type `--mu-type-body`. |
| `body > header` | The page header: a bar on the surface color with a line below. Its `h1` is the page name, its `p` is a short muted text, and its `nav` holds links at the end of the bar. |
| `body > main`, `body > footer` | The content and the footer. They have the same side space as the header, and `--mu-size-page` is their maximum width. |
| Blocks in `main`, `section`, `article` and `aside` | A block has no margin of its own. It gets `--mu-space-4` from the block before it. A `h2` or a `h3` gets `--mu-space-6` before it. The block after a `h1` gets `--mu-space-3`, and the block after each other heading gets `--mu-space-2`. |
| `h1` to `h4` | The heading tokens. A `h4` has the body size and the strong weight. |
| `a` | The accent color, always with an underline. |
| `code`, `kbd`, `pre` | The code token on the surface color, with a subtle edge. |
| `table`, `button`, `select` | A plain table has a line below each row. A plain button and a plain select have the control edge `--mu-color-border`, the target size as the minimum size, and a hover state. |
| `[data-mu-scroll]` | A box for wide content, for example a plain table. The box scrolls to the side, so the page does not. A table cell does not break its text, so a wide table keeps its columns and scrolls in the box. |
| `p`, `li`, `dt`, `dd`, `blockquote`, `figcaption`, `caption` | A long token with no break point, for example a digest, breaks at the edge of the block. A heading wraps only at spaces, and a `pre` block scrolls. |
| Focus | A ring of 2px in `--mu-color-focus` on each focused control of the page. |

A plain table that can be wider than the page goes in a scroll box. Put the table in a `div` with the attribute `data-mu-scroll`. The table keeps its `table` display, so a screen reader still reads it as a table, with its header cells. The style cannot know if the box overflows, so the page makes the box a keyboard target: give the `div` `tabindex="0"`, `role="region"` and a name in `aria-label`. Then a keyboard user can focus the box and scroll it with the arrow keys. `tests/browser/page-width.html` shows the markup, and `tools/browser_check.mjs` checks it at 1280 and 375 CSS pixels.

In forced colors, the page uses `Canvas`, `CanvasText`, `LinkText`, `ButtonFace` and `ButtonText`. In reduced motion, the page has no transition. The table gives the ground of the page in each mode, and `tools/browser_check.mjs` checks it on the theme page:

| Mode | Ground of the page |
|---|---|
| Light | `#f7f8fa` |
| Dark | `#0f1217` |
| Forced colors | `Canvas` |

To use your own page style instead, do not link `page.css`. Link `tokens.css` and your own style sheet. Each kit element needs only the tokens, so it looks the same on your page.

To change only some rules, link your style sheet after `page.css`. The block spacing rules have a specificity of zero, so each rule of your style sheet wins. A container that sets its own `gap` removes the block space of its children with `margin-block-start: 0`, as `examples/apps/app.css` does. Each example page uses the default style, and `examples/page.css` holds only the layout classes of the examples.

## Compact density and full width

Set `data-mu-density="compact"` on `<html>` to use compact density on the full page. To use it in one part of a page, set the attribute on the container of that part. The elements in the container use the compact tokens, also in their shadow roots.

Compact density reduces the first four space tokens, the body and caption type sizes, the minimum widths of grid columns, the control size (`1.75rem`), the icon size (`0.875rem`) and the field width (`18rem`). The touch size does not change. Use these tokens for gaps, content padding and text. The `compact` theme preset uses these density values on the full page. Use the density attribute to apply the same spacing to a container or to use compact density with high contrast.

Keep each control target at the target size or larger. The target size is `--mu-size-control` with a fine pointer (32 by 32 CSS pixels by default, 28 in compact density) and `--mu-size-control-touch` with a coarse pointer (44 by 44 CSS pixels). Do not set `--mu-size-control` below `1.5rem` (24 CSS pixels, WCAG 2.5.8). To keep 44 by 44 CSS pixel targets with a mouse, set `--mu-size-control: 2.75rem` in your theme. Keep the root font size and the control minimum sizes. A radio or checkbox and its label make one target. Keep the 2px focus ring and the contrast ratios for text, control edges and focus rings.

With `page.css`, set `data-mu-page="full"` on `<html>` to set `--mu-size-page` to `100%`. The header, main content and footer use the available width and keep the side space that `--mu-space-4` gives. You can use this option with either density.

The [density example](../../examples/tables/density.html) uses full width. It shows the same synthetic card grid and data grid in both densities, side by side on a wide screen.

## A custom theme

[examples/guides/theme.css](../../examples/guides/theme.css) sets the `forest` theme on each element in a `.theme-forest` container. It gives a light value and a dark value for each color, and it changes one corner radius:

<!-- source: examples/guides/theme.css -->
```css
.theme-forest {
  --mu-color-accent: #2b6a3c;
  --mu-color-border: #6b7f70;
  --mu-color-danger: #a3231a;
  --mu-color-focus: #2b6a3c;
  --mu-color-on-accent: #ffffff;
  --mu-color-surface: #f5f8f3;
  --mu-color-surface-subtle: #ecf2e9;
  --mu-color-text: #16241a;
  --mu-color-text-muted: #46584b;
  --mu-radius-2: 0.25rem;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-mu-mode="light"], [data-mu-theme="light"]:not([data-mu-mode]))) .theme-forest {
```

The dark values come in two rules, the same as in `tokens.css`. One rule follows a dark browser preference and the other follows an explicit dark mode. A custom theme on `:root` needs selectors at least as specific as the rules of `tokens.css`. The page puts the elements in the container.

<!-- source: examples/guides/theme.html -->
```html
    <section id="kit" aria-label="Kit theme"></section>
    <section id="forest" class="theme-forest" aria-label="Forest theme"></section>
```

Expected result:

| Mode | Kit section | Forest section |
|---|---|---|
| Light | The `Renew` button has the ground `#1f5fbf`. | The `Renew` button has the ground `#2b6a3c`. The card has the ground `#f5f8f3` and corners of 4px. |
| Dark | The `Renew` button has the ground `#8cb4f5`. | The `Renew` button has the ground `#8ccf9d`. The card has the ground `#111a14`. |
| Forced colors | The button text and edge use `ButtonText`. The card edge uses `CanvasText`. | The same as the kit section. |
| Reduced motion | No transition. | No transition. |

`tools/browser_check.mjs` opens the page in the four modes and checks this table. `tests/test_guides.py` checks the colors of `theme.css` against the contrast pairs of `tests/test_tokens.py`, in the light theme and in the dark theme.

## The contrast of a theme

A theme must keep these contrast ratios (WCAG 2.2, 1.4.3 and 1.4.11) in the light theme and in the dark theme:

| Front | Back | Minimum |
|---|---|---|
| `--mu-color-text` | `--mu-color-surface` | 4.5:1 |
| `--mu-color-text-muted` | `--mu-color-surface` | 4.5:1 |
| `--mu-color-on-accent` | `--mu-color-accent` | 4.5:1 |
| `--mu-color-accent` | `--mu-color-surface` | 4.5:1 |
| `--mu-color-danger` | `--mu-color-surface` | 4.5:1 |
| `--mu-color-border` | `--mu-color-surface` | 3:1 |
| `--mu-color-focus` | `--mu-color-surface` | 3:1 |
| `--mu-color-on-success`, `--mu-color-on-warning`, `--mu-color-on-info` | The respective success, warning or info token | 4.5:1 |
| `--mu-color-on-hover`, `--mu-color-on-selected` | The respective hover or selected token | 4.5:1 |
| `--mu-color-text`, `--mu-color-text-muted` | `--mu-color-surface-subtle` | 4.5:1 |
| `--mu-color-border` | `--mu-color-surface-subtle` | 3:1 |
| `--mu-color-focus` | `--mu-color-surface-subtle` | 3:1 |
| `--mu-color-success`, `--mu-color-warning`, `--mu-color-info` | `--mu-color-surface` or `--mu-color-page` | 4.5:1 |
| `--mu-color-on-hover`, `--mu-color-on-selected` as an edge | `--mu-color-surface` or `--mu-color-page` | 3:1 |
| `--mu-color-focus` | `--mu-color-hover` or `--mu-color-selected` | 3:1 |

A page with the default page style also has text, links and controls on the page ground. Then a theme must also keep these ratios:

| Front | Back | Minimum |
|---|---|---|
| `--mu-color-text` | `--mu-color-page` | 4.5:1 |
| `--mu-color-text-muted` | `--mu-color-page` | 4.5:1 |
| `--mu-color-accent` | `--mu-color-page` | 4.5:1 |
| `--mu-color-danger` | `--mu-color-page` | 4.5:1 |
| `--mu-color-border` | `--mu-color-page` | 3:1 |
| `--mu-color-focus` | `--mu-color-page` | 3:1 |

The edge of a standalone card, a form and a message is a mix of `--mu-color-border` at 45% and no color. This edge is not a control, so it has no minimum ratio. A card in a thread shows its edge in forced colors. The edge of each control uses the full `--mu-color-border`.

Use `#rrggbb` values. Then `tools/tokens.py` can compute each ratio with its `contrast` function. If the ground of the page is not `--mu-color-surface`, check the danger color against that ground too. Each message of the thread sits on the surface, but the thread element has no ground of its own. Its notices of a stream error and of a failed source sit on the ground of the page.

Load the theme style sheet after `tokens.css`. A theme on `:root` has the same specificity as the light rule of `tokens.css`, so the later style sheet wins.

The browser check opens the gallery at 375 CSS pixels in each preset and mode. Set `MUGHAM_GALLERY_SHOTS` to an output folder before you run `node tools/browser_check.mjs` to save six PNG images for review. The images are optional and do not affect the check result.

## Control display

These kit controls show icons by default: the card toggle, the two card grid controls, the two rich text link buttons, and the close of a dialog or a drawer. Each icon control keeps its text as its accessible name and shows the text as a tooltip on hover and on keyboard focus. Escape closes the tooltip. Set `control-display="text"` on a component or an ancestor to show the text labels. Set the ancestor attribute before the fill or before you attach the filled component. The closest setting applies, even across a shadow root. An empty value or `icon` selects icons. An attribute change on a component updates its controls. An attribute change on a card or a card grid also updates the controls of the elements in it. A change on a different ancestor applies at the next render or connection.

The action button and the editable form keep the `display` of their binding, because the application owns their label. The default is `text`. If the binding gives `icon` and `display: 'icon'`, the control shows the icon, and `control-display="text"` shows the label next to the icon.

Keep the icon buttons at the target size and keep their focus rings visible. Let each icon take the button text color. Keep the text and border of the `tooltip`, `card-tooltip` and `link-tooltip` parts visible in forced colors when the kit shows them. Keep the tooltips clear of the content and the editor.

`Read more`, `Read less` and the `Retry` and `Cancel` exits for pending actions keep their text.

## Declared parts

Use a selector such as `mu-card::part(title)` to style a part. Each contract in [the catalog](../../catalog/) gives the descriptions and the guardrail flags for its parts. A catalog entry with no element has an empty list. The thread renders message envelopes and has its own row below.

An asterisk marks a guardrail part. Keep it visible when the kit shows it. Run `python3 -B tools/theme_parts.py path/to/theme.css` to check a style sheet. The check warns about direct `::part()` rules that set `display: none`, `visibility: hidden`, `visibility: collapse` or zero opacity on a catalog guardrail. Check the rest of the visibility rules on the page.

| Element | Parts |
|---|---|
| `mu-accordion` | `copy`\*, `copy-status`\*, `details`\*, `heading`\*, `next`\*, `panel`\*, `reason`\*, `toggle`\* |
| `mu-action-button` | `accept`\*, `button`, `cancel`\*, `confirm`\*, `copy`\*, `copy-status`\*, `details`\*, `exit`\*, `icon`\*, `next`\*, `reason`\*, `reference`\*, `retry`\*, `status`\*, `tooltip`\* |
| `mu-action-queue` | `action`, `actions`, `cancel`\*, `copy`\*, `copy-status`\*, `details`\*, `dismiss`\*, `label`, `name`, `next`\*, `queue`, `queued`, `reason`\*, `retry`\*, `state`\*, `summary` |
| `mu-approval-queue` | `action-button-accept`\*, `action-button-button`, `action-button-cancel`\*, `action-button-confirm`\*, `action-button-copy`\*, `action-button-copy-status`\*, `action-button-exit`\*, `action-button-reference`\*, `action-button-retry`\*, `announcement`\*, `approval-mark`\*, `authorship`\*, `copy`\*, `copy-status`\*, `details`\*, `empty`, `item`, `label`\*, `list`\*, `next`\*, `reason`\*, `state`\*, `summary`\*, `title`\* |
| `mu-app-shell` | `copy`\*, `copy-status`\*, `details`\*, `main`\*, `menu`\*, `next`\*, `reason`\*, `side`\*, `skip`\*, `top`\* |
| `mu-avatar` | `copy`\*, `copy-status`\*, `details`\*, `initials`\*, `next`\*, `reason`\* |
| `mu-badge` | `copy`\*, `copy-status`\*, `details`\*, `label`\*, `next`\*, `reason`\* |
| `mu-breadcrumbs` | `copy`\*, `copy-status`\*, `current`\*, `details`\*, `link`\*, `list`\*, `nav`\*, `next`\*, `reason`\*, `separator` |
| `mu-button` | `button`, `copy`\*, `copy-status`\*, `details`\*, `next`\*, `reason`\* |
| `mu-card-grid` | `card-status`\*, `card-title`, `card-toggle`\*, `card-tooltip`\*, `collapse-all`\*, `copy`\*, `copy-status`\*, `details`\*, `empty`, `expand-all`\*, `icon`\*, `list`, `next`\*, `reason`\*, `tooltip`\* |
| `mu-card` | `actions`, `authorship`\*, `body`\*, `card`, `citation`\*, `collapsed-summary`, `copy`\*, `copy-status`\*, `details`\*, `facts`, `icon`\*, `locator`\*, `next`\*, `open`\*, `provenance`\*, `reason`\*, `status`\*, `title`, `toggle`\*, `tooltip`\* |
| `mu-chart` | `authorship`\*, `bar`\*, `chart`\*, `copy`\*, `copy-status`\*, `details`\*, `next`\*, `point`\*, `reason`\*, `segment`\*, `value`\* |
| `mu-choice-field` | `choices`\*, `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-citation` | `authorship`\*, `citation`\*, `copy`\*, `copy-status`\*, `details`\*, `empty`, `locator`\*, `next`\*, `open`\*, `provenance`\*, `quote`, `reason`\* |
| `mu-data-grid` | `authorship`\*, `cancel`\*, `cell`, `changed`\*, `copy`\*, `copy-status`\*, `data-grid`, `details`\*, `editor`, `empty`, `exit`\*, `next`\*, `pending`\*, `reason`\*, `reference`\*, `retry`\*, `scroll`, `status`\*, `title`\*, `value` |
| `mu-date-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-date-range-field` | `copy`\*, `copy-status`\*, `date-label`\*, `details`\*, `edit-type`\*, `end`\*, `group`\*, `label`\*, `next`\*, `problem`\*, `reason`\*, `start`\* |
| `mu-date-time-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\*, `time-zone`\* |
| `mu-dialog` | `body`\*, `close`\*, `copy`\*, `copy-status`\*, `details`\*, `dialog`\*, `icon`\*, `next`\*, `reason`\*, `title`\*, `tooltip`\* |
| `mu-drawer` | `body`\*, `close`\*, `copy`\*, `copy-status`\*, `details`\*, `dialog`\*, `icon`\*, `next`\*, `reason`\*, `title`\*, `tooltip`\* |
| `mu-diff` | `after`\*, `authorship`\*, `before`\*, `change`, `changes`, `citation`\*, `copy`\*, `copy-status`\*, `counts`, `details`\*, `diff`, `empty`, `kind`\*, `label`, `locator`\*, `next`\*, `open`\*, `part`, `provenance`\*, `reason`\*, `summary`, `title`, `value`, `version`\*, `versions` |
| `mu-editable-form` | `accept`\*, `authorship`\*, `button`, `cancel`\*, `citation`\*, `confirm`\*, `copy`\*, `copy-status`\*, `details`\*, `exit`\*, `form`, `icon`\*, `locator`\*, `next`\*, `open`\*, `provenance`\*, `reason`\*, `reference`\*, `retry`\*, `status`\*, `tooltip`\* |
| `mu-empty-state` | `action`\*, `copy`\*, `copy-status`\*, `details`\*, `next`\*, `reason`\*, `text`\*, `title`\* |
| `mu-excerpt` | `authorship`\*, `citation`\*, `copy`\*, `copy-status`\*, `details`\*, `excerpt`, `locator`\*, `mark`, `next`\*, `open`\*, `passage`, `provenance`\*, `read-more-content`\*, `read-more-toggle`\*, `reason`\*, `span` |
| `mu-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-form-card` | `accept`\*, `authorship`\*, `button`, `cancel`\*, `changed`\*, `citation`\*, `confirm`\*, `copy`\*, `copy-status`\*, `details`\*, `editor`, `exit`\*, `form`, `label`, `line`, `line-number`, `lines`, `locator`\*, `next`\*, `note`\*, `open`\*, `provenance`\*, `read-only`\*, `reason`\*, `reference`\*, `retry`\*, `save`, `section`, `status`\*, `value` |
| `mu-grid` | `copy`\*, `copy-status`\*, `details`\*, `layout`, `next`\*, `reason`\* |
| `mu-image` | `authorship`\*, `box`\*, `caption`\*, `copy`\*, `copy-status`\*, `details`\*, `dialog`\*, `image`, `next`\*, `open`\*, `reason`\*, `status`\* |
| `mu-long-text-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-menu` | `copy`\*, `copy-status`\*, `details`\*, `item`\*, `menu`\*, `next`\*, `reason`\*, `trigger`\* |
| `mu-multi-choice-field` | `checkbox`\*, `checkbox-label`\*, `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `group`\*, `label`\*, `listbox`\*, `next`\*, `option`\*, `popup`\*, `problem`\*, `reason`\*, `remove`\*, `search`\*, `status`\*, `tag`, `tag-text`\*, `tags` |
| `mu-number-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-pagination` | `copy`\*, `copy-status`\*, `details`\*, `gap`, `nav`\*, `next`\*, `next-page`\*, `page`\*, `previous-page`\*, `reason`\* |
| `mu-plan` | `announcement`\*, `authorship`\*, `copy`\*, `copy-status`\*, `details`\*, `list`\*, `name`\*, `next`\*, `reason`\*, `state`\*, `task` |
| `mu-progress` | `bar`\*, `copy`\*, `copy-status`\*, `details`\*, `indicator`\*, `label`\*, `next`\*, `reason`\*, `value`\* |
| `mu-range-field` | `controls`\*, `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `group`\*, `handle-label`\*, `label`\*, `next`\*, `number`\*, `problem`\*, `reason`\*, `slider`\* |
| `mu-rich-text-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `format`\*, `icon`\*, `input`\*, `label`\*, `link-apply`\*, `link-cancel`\*, `link-editor`\*, `link-tooltip`\*, `next`\*, `problem`\*, `reason`\*, `status`\*, `toolbar`\*, `tooltip`\* |
| `mu-rich-text` | `approval-mark`\*, `authorship`\*, `code`, `copy`\*, `copy-status`\*, `details`\*, `empty`, `link`\*, `next`\*, `read-more-content`\*, `read-more-toggle`\*, `reason`\*, `rich-text`, `target`\* |
| `mu-run-steps` | `announcement`\*, `arguments`\*, `authorship`\*, `copy`\*, `copy-status`\*, `detail`\*, `details`\*, `list`\*, `name`\*, `next`\*, `panel`\*, `reason`\*, `result`\*, `state`\*, `step`, `toggle`\*, `tool`\* |
| `mu-select-field` | `control`\*, `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `label`\*, `listbox`\*, `next`\*, `option`\*, `popup`\*, `problem`\*, `reason`\*, `search`\*, `status`\*, `value`\* |
| `mu-service-status` | `copy`\*, `copy-status`\*, `details`\*, `empty`, `label`\*, `metadata`\*, `next`\*, `reason`\*, `service`\*, `state`\*, `strip`\*, `trigger`\* |
| `mu-skeleton` | `copy`\*, `copy-status`\*, `details`\*, `line`\*, `next`\*, `reason`\*, `status`\* |
| `mu-source-status` | `checked`\*, `copy`\*, `copy-status`\*, `details`\*, `empty`, `label`, `next`\*, `reason`\*, `source`\*, `state`\* |
| `mu-stack` | `copy`\*, `copy-status`\*, `details`\*, `layout`, `next`\*, `reason`\* |
| `mu-status` | `authorship`\*, `copy`\*, `copy-status`\*, `details`\*, `label`\*, `next`\*, `reason`\*, `status`\*, `text`\* |
| `mu-steps` | `back`\*, `copy`\*, `copy-status`\*, `details`\*, `list`\*, `next`\*, `position`\*, `reason`\*, `state`\*, `step`\* |
| `mu-table` | `authorship`\*, `copy`\*, `copy-status`\*, `details`\*, `empty`, `next`\*, `reason`\*, `sort-status`\*, `table` |
| `mu-tabs` | `copy`\*, `copy-status`\*, `details`\*, `next`\*, `panel`\*, `reason`\*, `tab`\*, `tablist`\* |
| `mu-text` | `copy`\*, `copy-status`\*, `details`\*, `next`\*, `read-more-content`\*, `read-more-toggle`\*, `reason`\*, `text` |
| `mu-thread` | `copy`\*, `copy-status`\*, `details`\*, `list`, `next`\*, `read-more-content`\*, `read-more-toggle`\*, `reason`\*, `source`\*, `state`\*, `stream`\* |
| `mu-time-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\* |
| `mu-toast` | `close`\*, `copy`\*, `copy-status`\*, `details`\*, `message`\*, `next`\*, `reason`\*, `toast`\* |
| `mu-toggle-field` | `copy`\*, `copy-status`\*, `details`\*, `edit-type`\*, `input`\*, `label`\*, `next`\*, `problem`\*, `reason`\*, `state`\*, `target` |
| `mu-tooltip` | `copy`\*, `copy-status`\*, `details`\*, `next`\*, `reason`\*, `tooltip`\* |
| `mu-upload` | `authorship`\*, `cancel`\*, `choose`, `copy`\*, `copy-status`\*, `details`\*, `drop`, `file`, `files`, `help`, `label`, `limits`\*, `name`, `next`\*, `problems`\*, `reason`\*, `reference`\*, `remove`, `retry`\*, `send`, `size`, `state`\*, `status`\*, `upload` |

### Exported parts

Use these names on the outer element. Each alias starts with the name of the inner element without `mu-`. For example, `mu-card-grid::part(card-title)` styles the title of each nested card.

| Outer element | Inner element | Inner part | Exported name |
|---|---|---|---|
| `mu-approval-queue` | `mu-action-button` | `accept` | `action-button-accept` |
| `mu-approval-queue` | `mu-action-button` | `button` | `action-button-button` |
| `mu-approval-queue` | `mu-action-button` | `cancel` | `action-button-cancel` |
| `mu-approval-queue` | `mu-action-button` | `confirm` | `action-button-confirm` |
| `mu-approval-queue` | `mu-action-button` | `copy` | `action-button-copy` |
| `mu-approval-queue` | `mu-action-button` | `copy-status` | `action-button-copy-status` |
| `mu-approval-queue` | `mu-action-button` | `exit` | `action-button-exit` |
| `mu-approval-queue` | `mu-action-button` | `reference` | `action-button-reference` |
| `mu-approval-queue` | `mu-action-button` | `retry` | `action-button-retry` |
| `mu-card-grid` | `mu-card` | `status` | `card-status` |
| `mu-card-grid` | `mu-card` | `title` | `card-title` |
| `mu-card-grid` | `mu-card` | `toggle` | `card-toggle` |
| `mu-card-grid` | `mu-card` | `tooltip` | `card-tooltip` |

## What a page must not change

Each rule protects a principle of the [constitution](../../CONSTITUTION.md#principles).

- **Do not hide, cover or recolor the state text.** The parts `status`, `reference` and `state` show `Pending`, `Done`, `Not done`, `Partial` and the reference of a receipt. The parts `source` and `checked` of `mu-source-status` show the state of an offline data source and the time of its last confirmed read. Principle 6 needs the true state in words. The color is never the only signal.
- **Keep the table sort text visible.** The part `sort-status` gives the sorted column and its direction.
- **Keep the chart labels and focus visible.** The parts `chart`, `point`, `bar`, `segment` and `value` show the data and the current point. Keep the series numbers and line patterns distinct.
- **Do not remove the focus ring.** Do not set `outline: none` on a part. If you set `--mu-color-focus`, keep 3:1 against the surface. The kit draws the ring with `:focus-visible` in each shadow root.
- **Do not hide or change the provenance.** The parts `provenance`, `authorship`, `citation`, `locator` and `open` show the actor and the source of the content. Principle 3 needs the actor of each content.
- **Keep the next step and the details control of a refusal visible.** The part `next` tells the person what to do. The part `details` contains the `Technical details` control. Do not hide it or remove its focus ring. The parts `copy` and `copy-status` give the copy button and its status. The status tells a screen reader when the copy completes. [Interaction details](../../src/components/interaction.md) gives the rules.
- **Do not hide the refusal, the confirm step or the thread notices.** The parts `confirm`, `cancel`, `accept`, `stream` and `source` show what a person must know before an action, and the errors of a stream. The parts `edit-type` and `reason` ask for the type of an edit and tell why a submit sent no action. The part `problem` tells why a value is not valid. In a form card, the parts `changed`, `read-only` and `note` tell which values changed, which values a person cannot edit, and why a submit sent nothing. Principle 4 needs the type of each form edit. In a diff, the parts `kind`, `version`, `before` and `after` tell the kind of each change and the version of each value.
- **Do not set `forced-color-adjust: none` on a kit element, and do not change the system colors of forced colors.** Principle 7 needs each element to respect forced colors.
- **Do not turn on motion in reduced motion.** If you set `--mu-motion-fast`, set it to `0ms` in `@media (prefers-reduced-motion: reduce)` too.
- **Do not change the meaning of a color.** `--mu-color-danger` shows a refusal and an error. Do not give it a color that a person can read as success.
- **Do not put content into a style.** A token value comes from the application, never from a model, a tool or a document. Principle 5 keeps untrusted content as data.

A page can style these parts for layout, for example a margin or a width, if it keeps each rule above: `actions`, `button`, `card`, `choices`, `empty`, `excerpt`, `facts`, `form`, `input`, `label`, `layout`, `list`, `mark`, `passage`, `quote`, `span`, `table` and `text`. The form card adds the layout parts `section`, `lines`, `line`, `line-number`, `value`, `editor` and `save`. The diff adds the layout parts `diff`, `title`, `versions`, `counts`, `summary`, `changes`, `change` and `value`. `seed-tray` in [examples/cards/register.js](../../examples/cards/register.js) shows that an application element can add its own part, for example `tray`.

Keep the `dialog`, `title`, `body` and `close` parts of a dialog or drawer visible while it is open. Keep the close button at the target size or larger and keep its focus ring visible. Let the browser hide the modal when it is closed.

Keep the menu `trigger` and each `item` at the target size or larger. Keep their focus rings visible. Let the `menu` scroll when it is too tall for the available space.

Keep the `tooltip` text and border visible while it is open. Leave space for it above or below the target. Keep the target and its focus ring visible.

Keep the `toast` and its `message` visible while the toast is open. If it has a `close` button, keep the button at the target size or larger and keep its focus ring visible.

Keep the `tablist` and each `tab` visible. Let the list wrap on narrow screens. Keep the selected tab easy to identify in each theme. Keep each tab and accordion `toggle` at the target size or larger and keep their focus rings visible. Keep each accordion `heading` visible and keep each `panel` visible when its control shows it.

Keep the app shell landmarks `top`, `side` and `main` visible in their active layout. Keep the `skip` part visible on focus and keep the `menu` part visible on narrow screens. Give each control in the top and side slots a target at the target size or larger and a visible focus ring.

Let the breadcrumb `list` and pagination `nav` wrap. Keep the current page distinct in each theme and in forced colors. Keep each `link`, `page`, `previous-page` and `next-page` target at the target size or larger and keep its focus ring visible.

Let the wizard `list` wrap and keep each `step`, its `position` and its `state` visible. Give each `back` button a target of at the target size or larger and keep its focus ring visible.

Keep the run step and plan `list`, `authorship`, `name` and `state` visible. Keep the `announcement` in the accessibility tree. Keep each run step `toggle` at the target size or larger with a visible focus ring. Keep the `panel` and its text visible while the disclosure is open. Let long detail, arguments and result text wrap on narrow screens.

Keep the approval `list`, `label`, `authorship`, `title`, `summary` and `state` visible. Keep the `announcement` in the accessibility tree. Let the item text and decisions wrap. Keep the action controls, confirmation, pending exits and receipt details visible when they are available. Keep the controls at the target size or larger with a visible focus ring.

Keep the progress `label` and `value` visible. Keep the `bar` edge and fill distinct in forced colors. Keep the `indicator` visible for unknown progress and stop its motion when the person asks for reduced motion.

Keep the empty state `title` and `text` visible. Keep a named control in its `action` slot at the target size or larger and keep its focus ring visible.

Keep each skeleton `line` visible in forced colors. Keep the `status` and its accessible name while content loads. Stop the motion of each line when the person asks for reduced motion.

Keep the badge `label` and the avatar `initials` legible in each theme and in forced colors. Keep the badge text visible in each tone.

The image parts are `image`, `box`, `caption` and `dialog`. Keep the box ratio and its loading and failed notices visible. Keep the caption and the full-size close button visible. The `open` part must keep its focus ring.

The card parts include `toggle`, `icon`, `body` and `collapsed-summary`. Keep the toggle, its border and its focus ring visible. The part `icon` is the chevron of the toggle, and it takes the text color of the toggle. The kit hides the body only when the card can collapse. Do not change this rule or hide a pending action with page styles. The short summary shows only while the card is collapsed.

The action button uses the `icon` part in `icon` and `both` displays. Keep the icon visible and let its stroke take the button text color. In `icon` display, the `tooltip` part shows the button label on hover and focus. Keep its text and border visible in forced colors. Keep the `button` part at the target size or larger and keep its focus ring. The `status` and `reference` parts keep their text in each display.

In a rich text field, keep the `format` buttons at the target size or larger. Keep their focus rings and pressed states visible. Let the `toolbar` wrap on narrow screens. Keep each format symbol visible and let the `icon` stroke take the button text color. Keep the `tooltip` text and border visible in forced colors. Keep the tooltip clear of the `input` part.

The toggle field parts are `target`, `input`, `label` and `state`. Keep the `target` at the target size or larger. Keep the `input`, its focus ring and the `label` visible. In switch display, keep the switch border visible in forced colors and the `On` or `Off` text in the `state` part visible in each theme.

The select field parts are `label`, `control`, `value`, `popup`, `search`, `listbox`, `option`, `status` and `problem`. Keep the `control`, `search` and each `option` at the target size or larger. Keep the value, the focus rings and the active and selected options distinct in each theme and in forced colors. Let the listbox scroll inside the popup. Keep the status visible when the search has no match.

The multi-choice field parts shared by both displays are `label`, `group` and `problem`. The short display adds `checkbox-label` and `checkbox`. Keep the labels and native check marks visible. The tag picker adds `tags`, `tag`, `tag-text`, `remove`, `search`, `popup`, `listbox`, `option` and `status`. Let tags wrap and let the listbox scroll within the popup. Keep the selection check marks, the active option ring and the search status visible.

Keep each `checkbox`, `remove`, `search` and `option` at the target size or larger. Keep each focus ring visible, also in forced colors. Let the field fit at 375 CSS pixels without horizontal scroll. The `edit-type` and `reason` parts use the shared rules for typed fields.

The range field parts are `label`, `group`, `handle-label`, `controls`, `slider` and `number`. The `group` and `handle-label` parts show with two handles. Keep each slider next to its number box in `controls`. Keep the labels, slider track and thumb, number box border and focus rings visible in each theme and in forced colors. Keep each `slider` and `number` at the target size or larger. Let the field fit at 375 CSS pixels without horizontal scroll.

The date range field parts are `label`, `group`, `date-label`, `start` and `end`. The time and date-time fields have `label` and `input` parts. The date-time field adds `time-zone`. Keep each label and the time zone visible. Let the time zone wrap. Keep the native controls, their borders and their focus rings visible in each theme and in forced colors. Keep each input at the target size or larger. Let the fields fit at 375 CSS pixels without horizontal scroll. Keep the `problem` part visible when it has text.

The text limit parts are `read-more-content` and `read-more-toggle`. Keep the full text in the content part. Keep the compact toggle, its underline and its focus ring visible when the text exceeds the limit. Keep its border visible in forced colors. Do not add a fade or a height animation.

Keep the rich text field `label`, `input` and `toolbar` visible. Let the `format` buttons wrap and keep each button at the target size or larger. Keep the pressed state distinct in each media mode. Keep focus rings visible on the format buttons, the editable area and the controls in `link-editor`. Keep the `problem`, `status` and `edit-type` parts visible when the field shows them. Let the field and its status text wrap at 375 CSS pixels.

Keep the `approval-mark` text visible in rich text and in the approval queue. The rich text also has `rich-text`, `code`, `link` and `target` parts. Keep the underline and the focus ring of the `link` part. Do not hide the `target` part, because it shows the address that a link opens.

The data grid parts are `data-grid`, `title`, `scroll` and `cell`. Do not hide the `title` part, because it shows the title that the application gives. Keep the `changed` part of a cell, the `status` part below the grid and the receipt reference visible. They show the state of an edit and the reason of a refused value. Keep the focus ring of a cell and of the `editor` part.

The part `pending` shows that an action is pending and gives the reason for the wait when available. The exit of a pending action is the part `exit`, with the buttons `retry` and `cancel`. Do not hide them, because they are the only exit of an action with no receipt. The parts of `mu-action-queue` are `queue`, `label`, `summary`, `actions`, `action`, `name`, `state`, `queued`, `retry`, `cancel` and `dismiss`. Do not hide the `state` part or a button of an action. They show `Pending` and `Not done` for each action of the offline queue, and they let a person retry, cancel or dismiss it.

The upload parts are `upload`, `help`, `limits`, `drop`, `choose`, `files`, `file`, `name`, `size`, `remove` and `send`. Do not hide the `limits` part, because it shows the accepted types and the limits of the application. Do not hide the `problems` part, the `state` part or the `reference` part. They show the reason of a refused file, the state of each file and the reference of its receipt.

## Run the page

```sh
python3 tools/serve.py
```

Open `http://localhost:8000/examples/guides/theme.html`. Change the browser theme to dark to see the dark values.
