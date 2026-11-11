# Mugham brand

This page gives the rules for the Mugham logo, colors and type. The files in this folder are the source of the brand.

## The mark

The mark is a lowercase m with two arches and one dot. The two arches are the two actors in one thread: a person and an agent. The right arch is short, and a dot completes it. The dot is the receipt: an action is complete only when its receipt comes back.

| File | Use |
| --- | --- |
| [mugham-mark.svg](logos/mugham-mark.svg) | The mark on a light ground. |
| [mugham-mark-dark.svg](logos/mugham-mark-dark.svg) | The mark on a dark ground or on `brand-ink`. |
| [mugham-mark-mono.svg](logos/mugham-mark-mono.svg) | One color (`brand-ink`), for print or a one-color place. |
| [mugham-icon.svg](logos/mugham-icon.svg) | The dark mark on a `brand-ink` tile. For a favicon, an avatar or a package page. |
| [mugham-wordmark.svg](logos/mugham-wordmark.svg) | The word mugham on a light ground. The letters are lines, so the file needs no font. |
| [mugham-wordmark-dark.svg](logos/mugham-wordmark-dark.svg) | The wordmark on a dark ground. |
| [mugham-lockup.svg](logos/mugham-lockup.svg) | The mark and the wordmark on one baseline, on a light ground. |
| [mugham-lockup-dark.svg](logos/mugham-lockup-dark.svg) | The lockup on a dark ground. |

Each file is an SVG with no font, no script and no link.

- Keep a clear space of one arch width (18 of the 64 units) on each side of the mark.
- Use the mark at 16px minimum. Use the lockup at 24px high or more.
- Use the files as they are. Use the `-dark` files on a dark ground. An `<img>` does not take `currentColor`, so use a different file for a different ink.

Obey these rules:

- Do not change the colors of the arches. Do not move the dot or add a second dot.
- Do not draw eyes, a mouth or a face in the arches. The face is the interface, not a picture.
- Do not rotate, stretch or outline the mark. Do not add a gradient, a shadow or a glow.
- Do not put the mark on `accent`, on `brand-signal` or on a photo.
- Do not set the name in a font next to the mark. Use the wordmark or the lockup.

## Color

[tokens.json](tokens.json) gives each color token, with a light value, a dark value and a usage note. Each text pair has a contrast of 4.5:1 or more in each theme. Each control edge, focus ring and icon has 3:1 or more.

- `bg`, `surface` and `surface-raised` are the grounds. `ink` and `ink-muted` are the text colors.
- `accent` is for the one primary action in a view, for links and for a selected tab. `on-accent` is the text on `accent`.
- `ok`, `warn`, `error` and `pending` are only for state. Each state has its own `-bg` fill and always a word. Color is never the only signal.
- `actor-person` and `actor-agent` mark the actor of a message. The actor name always shows, because in dark mode the two hues have the same lightness.
- `brand-ink`, `brand-light`, `brand-signal` and the other `brand-` tokens are only for the logo, brand panels and the social image. `brand-signal` (Peacock) is only for the receipt dot. It is never text and never a state.

## Type

The brand uses three typefaces. Each typeface has a system fallback stack:

| Use | Stack |
| --- | --- |
| UI text (`sans`) | `"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif` |
| Code, ids and receipts (`mono`) | `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| The Tamil name (`tamil`) | `"Noto Sans Tamil", "Tamil Sangam MN", Latha, sans-serif` |

The kit loads no font from a network, because it has no third-party runtime dependency. If an application does not supply the font files, the browser uses the system fallback. Each style must work in the fallback.

## Tokens in the kit

[tokens.json](tokens.json) is the source for the kit tokens of [issue 2](https://github.com/mohanraj00/mugham/issues/2). The first kit tokens are in review now. A later PR maps the brand values into them. This PR does not change the kit tokens or the primitives.

## Voice

The product voice is ASD-STE100 Simplified Technical English.

- Start a button label with a verb: "Approve", "Send back", "Retry".
- Use numbers, not adjectives: "3 changed fields".
- Say what the state is, in words: "Sent. The receipt is not back yet."
- Write Mugham in text. Write mugham, in lower case, in the wordmark and in a command.
- Use neutral, synthetic examples only.
