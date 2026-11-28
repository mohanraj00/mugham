# Theme a page

Release: v0.9.0

## Purpose

Change the colors, the type and the spaces of the kit with your own values.

## API call

Load `src/tokens/tokens.css` before the kit code. Set the `--mu-` custom properties on a container. For a page style with no CSS of your own, also load `src/styles/page.css`.

## Example

<!-- source: examples/guides/assemble.html -->
```html
  <link rel="stylesheet" href="../../src/tokens/tokens.css">
  <link rel="stylesheet" href="../../src/styles/page.css">
```

## Result

The page uses the light tokens or the dark tokens, as the browser theme says. Forced colors and reduced motion apply with no work from the page.

## Errors

The kit does not check a theme. A color that fails a contrast pair makes the page hard to read. Do not override the state text, the focus ring, the provenance or forced colors.

[Theme the kit](../theme.md) gives each token, a second theme and the contrast pairs.
