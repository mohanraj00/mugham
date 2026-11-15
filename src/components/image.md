# Image

`mu-image` shows an image in a message or in a card. Its contract is [catalog/image.json](../../catalog/image.json).
The page sets the permitted origins before it gives a fill:

```js
import { define, MuImage } from './src/components/index.js';
define();
MuImage.allowedOrigins = [location.origin, 'https://example.org'];
```

The property applies to all images on the page, including images that the thread creates. Its default is an empty list.
Each entry must be an exact `http:` or `https:` origin, with no path, final slash, credentials, query or fragment.
The setter copies the list and freezes the copy. A later change to the input list has no effect.
A fill has no origin field and cannot change this policy. No HTML attribute sets this policy.
When page code changes the policy, each connected image checks its URL again. A refused image needs a new fill.
An image that connects again also checks the current policy.

The fill has these fields:

| Field | Rule |
|---|---|
| `url` | Required. 1 to 2048 code points. Parsed with `new URL` against the page origin, not the page path or a base element. |
| `alt` | Required. 0 to 500 code points. It must contain text other than white space unless `decorative` is `true`. |
| `decorative` | Optional boolean. If absent, the image has meaning and needs a text alternative. Use `alt: ''` for a decorative image. |
| `caption` | Optional. 1 to 500 code points. Shows only as text. |
| `width`, `height` | Required integers from 1 to 4096. They set the fixed box ratio. The natural image ratio does not change the box. |

The authorship slot is required and must agree with the actor that the page or the thread binds.
The element shows the author as text. The caption and the alternative never become markup.

Only an `http:` or `https:` URL with a permitted origin and no credentials can load. Other schemes, including
`javascript:`, `data:` and `blob:`, and URLs that cannot be parsed show a refusal notice. A refusal sets no image source.
After this check, the element sets only the `img.src` property. It uses `referrerpolicy="no-referrer"` and
`decoding="async"`. A fill cannot set `srcset` or request options.

The origin check applies to the supplied URL. The browser handles redirects. Set the page CSP `img-src` to the
same permitted origins to restrict redirect requests too. The example permits only its own origin.

| State | Result |
|---|---|
| `loading` | The fixed box and `Loading image.` show. The open button is disabled. |
| `default` | The loaded image shows. The button can open it at full size. |
| `error` | `Image failed to load.` and the text alternative show as text. The box stays fixed and the button stays disabled. |
| `refused` | A status notice gives the refusal reason as text. No image request starts for this fill. |

A canvas with no drawing context holds the box ratio. It is hidden from the accessibility tree and reserves space
without putting data into CSS. The image fits inside that box, also when its natural ratio is different.

The `Open image at full size` button includes the text alternative in its accessible name.
It opens a native modal dialog named `Full-size image`.
It moves the loaded image into the dialog, with no second request. The image uses its natural dimensions.
The dialog scrolls if the image is larger than the viewport. Focus goes to `Close image`.
The native modal dialog makes the page behind it inert, so Tab and Shift+Tab do not move the focus to the page. Escape or the close button closes it and returns focus to the image button.
The state stays `default` while the dialog is open.

Page code can create `MuImage` directly or use `document.createElement('mu-image')` after `define()`.
The thread accepts an image part and binds its envelope actor. To place an image in the current card,
page code uses the card's page-owned `actions` slot. The fill does not create that child.
[examples/image.html](../../examples/image.html) shows a message and a card with a small SVG written by hand.

The image adds only `aria-hidden` to the attribute list of `src/render/dom.js`. The canvas needs it.
The other image attributes use DOM properties. [tests/browser/image.js](../../tests/browser/image.js) checks
loading, loaded, failed, refused, decorative and dialog states in the four media modes.
