# Theme the kit

This guide gives each design token that a page can set, the light and dark themes, forced colors and reduced motion. It also gives the parts that a page must not change. The example page [examples/guides/theme.html](../../examples/guides/theme.html) shows the kit theme and a second theme, `forest`, on one page.

## How a theme works

Each kit element reads its style from CSS custom properties. `src/tokens/tokens.css` sets them on `:root`. A custom property goes into each shadow root of the page, so an element uses the value of its nearest ancestor that sets it. Thus a page can theme the full page on `:root`, or only one part of the page on a container element.

The kit has no other style input. The shadow root of each element keeps its own rules, and a page style cannot select the nodes in it, except through a `part` name.

`tools/tokens.py --write` writes `tokens.css` from `src/tokens/tokens.json`. Do not edit `tokens.css`. To change the kit tokens, change `tokens.json`. A page theme sets the properties in its own style sheet.

## The tokens

Each token has a light value and a dark value. The table gives the CSS property, the kit values and the use.

| CSS property | Light | Dark | Use |
|---|---|---|---|
| `--mu-color-surface` | `#ffffff` | `#171b21` | The ground of a card, a form, a message and a secondary button. |
| `--mu-color-text` | `#141a23` | `#e6e9ee` | The text on the surface. |
| `--mu-color-text-muted` | `#566170` | `#9ba5b1` | Captions, labels of facts, the actor type and the state text. |
| `--mu-color-border` | `#7c8694` | `#6f7986` | The edge of a card, a field and a message. |
| `--mu-color-accent` | `#1f5fbf` | `#8cb4f5` | The ground of a primary button, and the mark of an agent message. |
| `--mu-color-on-accent` | `#ffffff` | `#0b1a33` | The text on the accent. |
| `--mu-color-focus` | `#1f5fbf` | `#8cb4f5` | The focus ring. |
| `--mu-color-danger` | `#a3231a` | `#f4aba4` | A refusal, an error and `Not done`. |
| `--mu-type-body` | `400 0.9375rem/1.55` | same | The body text, as a `font` value with the font stack. |
| `--mu-type-caption` | `400 0.75rem/1.5` | same | Captions and state text, as a `font` value with the font stack. |
| `--mu-type-weight-strong` | `600` | same | A title and an actor name. |
| `--mu-space-1`, `--mu-space-2`, `--mu-space-3`, `--mu-space-4` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem` | same | The gaps and the padding. |
| `--mu-radius-1`, `--mu-radius-2` | `0.375rem`, `0.625rem` | same | The corners. |
| `--mu-motion-fast` | `120ms` | same | The time of a transition. It is `0ms` in reduced motion. |
| `--mu-size-column-narrow`, `--mu-size-column-medium`, `--mu-size-column-wide` | `12rem`, `16rem`, `22rem` | same | The minimum column width of a grid. |

The font stack of the two type tokens is `Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif`. The kit loads no font. If the page does not supply Instrument Sans, the browser uses the next font of the stack. [docs/brand/](../brand/README.md) gives the source of each value.

Each contract lists the tokens of its component in its `tokens` key. `tests/test_tokens.py` checks that each of them exists.

## Light and dark

The kit uses the dark values when the browser theme is dark. A page can select one theme with the `data-mu-theme` attribute on the root element:

- `data-mu-theme="light"` keeps the light values in a dark browser theme.
- `data-mu-theme="dark"` gives the dark values in a light browser theme.

Each element uses only the tokens, so the two themes need no other change.

## Forced colors and reduced motion

In forced colors, each element uses system colors: `ButtonText` and `ButtonFace` for a button, `CanvasText` for an edge and the state text, and `Highlight` for the focus ring. The tokens have no effect on these colors. A theme thus cannot make an element unreadable in forced colors.

In reduced motion, `tokens.css` sets `--mu-motion-fast` to `0ms`. Each shadow root also removes each transition and each animation with an `!important` rule. Thus a theme cannot turn motion on again in reduced motion.

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

Use `#rrggbb` values. Then `tools/tokens.py` can compute each ratio with its `contrast` function. If the ground of the page is not `--mu-color-surface`, check the danger color against that ground too. Each message of the thread sits on the surface, but the thread element has no ground of its own. Its notices of a stream error and of a failed source sit on the ground of the page.

Load the theme style sheet after `tokens.css`. A theme on `:root` has the same specificity as the light rule of `tokens.css`, so the later style sheet wins.

## What a page must not change

Each rule protects a principle of the [constitution](../../CONSTITUTION.md#principles).

- **Do not hide, cover or recolor the state text.** The parts `status`, `reference` and `state` show `Pending`, `Done`, `Not done`, `Partial` and the reference of a receipt. Principle 6 needs the true state in words. The color is never the only signal.
- **Do not remove the focus ring.** Do not set `outline: none` on a part. If you set `--mu-color-focus`, keep 3:1 against the surface. The kit draws the ring with `:focus-visible` in each shadow root.
- **Do not hide or change the provenance.** The parts `provenance`, `authorship`, `citation`, `locator` and `open` show the actor and the source of the content. Principle 3 needs the actor of each content.
- **Do not hide the refusal, the confirm step or the thread notices.** The parts `confirm`, `cancel`, `accept`, `stream` and `source` show what a person must know before an action, and the errors of a stream.
- **Do not set `forced-color-adjust: none` on a kit element, and do not change the system colors of forced colors.** Principle 7 needs each element to respect forced colors.
- **Do not turn on motion in reduced motion.** If you set `--mu-motion-fast`, set it to `0ms` in `@media (prefers-reduced-motion: reduce)` too.
- **Do not change the meaning of a color.** `--mu-color-danger` shows a refusal and an error. Do not give it a color that a person can read as success.
- **Do not put content into a style.** A token value comes from the application, never from a model, a tool or a document. Principle 5 keeps untrusted content as data.

A page can style these parts for layout, for example a margin or a width, if it keeps each rule above: `actions`, `button`, `card`, `empty`, `excerpt`, `facts`, `form`, `input`, `label`, `layout`, `list`, `mark`, `passage`, `quote`, `span` and `text`. `seed-tray` in [examples/register.js](../../examples/register.js) shows that an application element can add its own part, for example `tray`.

## Run the page

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/examples/guides/theme.html`. Change the browser theme to dark to see the dark values.
