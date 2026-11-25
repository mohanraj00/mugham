# Theme the kit

This guide gives each design token that a page can set, the light and dark themes, forced colors and reduced motion. It also gives the parts that a page must not change. The example page [examples/guides/theme.html](../../examples/guides/theme.html) shows the kit theme and a second theme, `forest`, on one page.

## How a theme works

Each kit element reads its style from CSS custom properties. `src/tokens/tokens.css` sets them on `:root`. A custom property goes into each shadow root of the page, so an element uses the value of its nearest ancestor that sets it. Thus a page can theme the full page on `:root`, or only one part of the page on a container element.

The kit has no other style input. The shadow root of each element keeps its own rules, and a page style cannot select the nodes in it, except through a `part` name. The optional [default page style](#the-default-page-style) styles the page around the elements, and it uses only the tokens.

`tools/tokens.py --write` writes `tokens.css` from `src/tokens/tokens.json`. Do not edit `tokens.css`. To change the kit tokens, change `tokens.json`. A page theme sets the properties in its own style sheet.

## The tokens

Each token has a light value and a dark value. The table gives the CSS property, the kit values and the use.

| CSS property | Light | Dark | Use |
|---|---|---|---|
| `--mu-color-surface` | `#ffffff` | `#171b21` | The ground of a card, a form, a message and a secondary button. |
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
| `--mu-type-body` | `400 0.9375rem/1.55` | same | The body text, as a `font` value with the font stack. |
| `--mu-type-caption` | `400 0.75rem/1.5` | same | Captions and state text, as a `font` value with the font stack. |
| `--mu-type-weight-strong` | `600` | same | A title and an actor name. |
| `--mu-type-heading-1`, `--mu-type-heading-2`, `--mu-type-heading-3` | `600 2rem/1.15`, `600 1.5rem/1.25`, `600 1.125rem/1.35` | same | The headings of the default page style, as `font` values with the font stack. |
| `--mu-type-code` | `400 0.84375rem/1.6` | same | Code in the default page style, as a `font` value with the code font stack. |
| `--mu-space-1`, `--mu-space-2`, `--mu-space-3`, `--mu-space-4` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem` | same | The gaps and the padding. |
| `--mu-space-5`, `--mu-space-6` | `1.5rem`, `2rem` | same | The larger spaces of the default page style. |
| `--mu-radius-1`, `--mu-radius-2` | `0.375rem`, `0.625rem` | same | The corners. |
| `--mu-motion-fast` | `120ms` | same | The time of a transition. It is `0ms` in reduced motion. |
| `--mu-size-column-narrow`, `--mu-size-column-medium`, `--mu-size-column-wide` | `12rem`, `16rem`, `22rem` | same | The minimum column width of a grid. |
| `--mu-size-page` | `64rem` | same | The maximum width of the content in the default page style. |

The font stack of the body, caption and heading tokens is `Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif`. The font stack of the code token is `Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. The kit loads no font. If the page does not supply the first font of a stack, the browser uses the next font of the stack. [docs/brand/](../brand/README.md) gives the source of each value.

Each contract lists the tokens of its component in its `tokens` key. `tests/test_tokens.py` checks that each of them exists.

## Light and dark

The kit uses the dark values when the browser theme is dark. A page can select one theme with the `data-mu-theme` attribute on the root element:

- `data-mu-theme="light"` keeps the light values in a dark browser theme.
- `data-mu-theme="dark"` gives the dark values in a light browser theme.

Each element uses only the tokens, so the two themes need no other change.

After a successful receipt, the action shows `Done` at full opacity. The action button and the form submit buttons use `--mu-color-success` for their edge and text. An action button with an icon display shows a check. The data grid uses this color in its receipt below the grid, and the upload uses it on each completed file. If you set this token, keep a text contrast of at least 4.5:1 against the surface and the page ground. The copy control uses the standard control edge and can wrap below the reference.

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
| `table`, `button`, `select` | A plain table has a line below each row. A plain button and a plain select have the control edge `--mu-color-border`, a minimum size of 44 by 44 CSS pixels, and a hover state. |
| Focus | A ring of 2px in `--mu-color-focus` on each focused control of the page. |

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

Compact density reduces the first four space tokens, the body and caption type sizes, and the minimum widths of grid columns. Use these tokens for gaps, content padding and text. The preset uses the same colors in each theme as the default density.

Keep each control target at least 44 by 44 CSS pixels (`2.75rem` with a root size of 16px). Keep the root font size and the control minimum sizes. A radio or checkbox and its label make one target. Keep the 2px focus ring and the contrast ratios for text, control edges and focus rings.

With `page.css`, set `data-mu-page="full"` on `<html>` to set `--mu-size-page` to `100%`. The header, main content and footer use the available width and keep the side space that `--mu-space-4` gives. You can use this option with either density.

The [density example](../../examples/tables/density.html) uses full width. It shows the same synthetic card grid and data grid in both densities, side by side on a wide screen.

## A second theme

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
  --mu-color-text: #16241a;
  --mu-color-text-muted: #46584b;
  --mu-radius-2: 0.25rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-mu-theme="light"]) .theme-forest {
```

The dark values come in two rules, the same as in `tokens.css`: one rule for a dark browser theme, and one rule for `data-mu-theme="dark"`. A theme on `:root` needs the same two dark rules, with selectors at least as specific as the rules of `tokens.css`. The page puts the elements in the container:

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

A page with the default page style also has text, links and controls on the page ground. Then a theme must also keep these ratios:

| Front | Back | Minimum |
|---|---|---|
| `--mu-color-text` | `--mu-color-page` | 4.5:1 |
| `--mu-color-text-muted` | `--mu-color-page` | 4.5:1 |
| `--mu-color-accent` | `--mu-color-page` | 4.5:1 |
| `--mu-color-danger` | `--mu-color-page` | 4.5:1 |
| `--mu-color-border` | `--mu-color-page` | 3:1 |
| `--mu-color-focus` | `--mu-color-page` | 3:1 |

The edge of a card, a form and a message is a mix of `--mu-color-border` at 45% and no color. This edge is not a control, so it has no minimum ratio. The edge of each control uses the full `--mu-color-border`.

Use `#rrggbb` values. Then `tools/tokens.py` can compute each ratio with its `contrast` function. If the ground of the page is not `--mu-color-surface`, check the danger color against that ground too. Each message of the thread sits on the surface, but the thread element has no ground of its own. Its notices of a stream error and of a failed source sit on the ground of the page.

Load the theme style sheet after `tokens.css`. A theme on `:root` has the same specificity as the light rule of `tokens.css`, so the later style sheet wins.

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

The image parts are `image`, `box`, `caption` and `dialog`. Keep the box ratio and its loading and failed notices visible. Keep the caption and the full-size close button visible. The `open` part must keep its focus ring.

The card parts include `toggle`, `icon`, `body` and `collapsed-summary`. Keep the toggle, its border and its focus ring visible. The part `icon` is the chevron of the toggle, and it takes the text color of the toggle. The kit hides the body only when the card can collapse. Do not change this rule or hide a pending action with page styles. The short summary shows only while the card is collapsed.

The action button uses the `icon` part in `icon` and `both` displays. Keep the icon visible and let its stroke take the button text color. In `icon` display, the `tooltip` part shows the button label on hover and focus. Keep its text and border visible in forced colors. Keep the `button` part at least 44 by 44 CSS pixels and keep its focus ring. The `status` and `reference` parts keep their text in each display.

The toggle field parts are `target`, `input`, `label` and `state`. Keep the `target` at least 44 by 44 CSS pixels. Keep the `input`, its focus ring and the `label` visible. In switch display, keep the switch border visible in forced colors and the `On` or `Off` text in the `state` part visible in each theme.

The text limit parts are `read-more-content` and `read-more-toggle`. Keep the full text in the content part. Keep the compact toggle, its underline and its focus ring visible when the text exceeds the limit. Keep its border visible in forced colors. Do not add a fade or a height animation.

The rich text parts are `rich-text`, `code`, `link` and `target`. Keep the underline and the focus ring of the `link` part. Do not hide the `target` part, because it shows the address that a link opens.

The data grid parts are `data-grid`, `title`, `scroll` and `cell`. Do not hide the `title` part, because it shows the title that the application gives. Keep the `changed` part of a cell, the `status` part below the grid and the receipt reference visible. They show the state of an edit and the reason of a refused value. Keep the focus ring of a cell and of the `editor` part.

The exit of a pending action is the part `exit`, with the buttons `retry` and `cancel`. Do not hide them, because they are the only exit of an action with no receipt. The parts of `mu-action-queue` are `queue`, `label`, `summary`, `actions`, `action`, `name`, `state`, `queued`, `retry`, `cancel` and `dismiss`. Do not hide the `state` part or a button of an action. They show `Pending` and `Not done` for each action of the offline queue, and they let a person retry, cancel or dismiss it.

The upload parts are `upload`, `help`, `limits`, `drop`, `choose`, `files`, `file`, `name`, `size`, `remove` and `send`. Do not hide the `limits` part, because it shows the accepted types and the limits of the application. Do not hide the `problems` part, the `state` part or the `reference` part. They show the reason of a refused file, the state of each file and the reference of its receipt.

## Run the page

```sh
python3 tools/serve.py
```

Open `http://localhost:8000/examples/guides/theme.html`. Change the browser theme to dark to see the dark values.
