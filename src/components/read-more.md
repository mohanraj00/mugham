# Read more

`mu-text`, `mu-excerpt` and `mu-rich-text` accept the optional data key `clamp`. It must be an integer from 1 to 20. It sets the initial height in lines of the text font. Rich text can have larger headings and gaps, so its limit is a height in body text lines. Without this key, the text shows in full, as before.

If the text exceeds the limit, a native button shows `Read more`. A press shows the full text and changes the label to `Read less`. Enter and Space work. Focus stays on the same button. Its `aria-expanded` state and `aria-controls` target tell a screen reader what it controls. The text has the part `read-more-content`. The button has the part `read-more-toggle`.

The control uses the caption font, the accent color and an underline. Its width fits its label. It has a minimum target size of 2.75 rem (44 CSS pixels) in each direction and no padding. When the text is clipped, the last visible line ends with an ellipsis. A gap of `space.1` separates it from the text. Long labels wrap within the available width. The focus ring stays visible. In forced colors, the control also has a visible border.

The limit is visual only. All text stays in the DOM, the accessibility tree and page search. No text has `hidden`, `inert` or `aria-hidden`. Rich text controls outside the short view stay in the keyboard order. Focus on such a control opens the full text. Source and author details stay outside the limit.

A `ResizeObserver` checks the height after a width change. A short text has no visible button. If a wider view removes overflow, the button hides. If overflow returns, the prior open or closed choice applies. A new fill starts closed. The control has no fade or animation. It has a visible border in forced colors.

Page code can set `read-more-label` and `read-less-label` attributes on the element. These labels are page policy, not fill data. A label change takes effect at once. An absent or blank label uses the default.

```js
text.setAttribute('read-more-label', 'Show full text');
text.setAttribute('read-less-label', 'Show short text');
text.fill = { component: 'text', version: '0.1.0', data: { text: passage, clamp: 3 } };
```

For plain text parts of `mu-thread`, page code sets `thread.clamp` to an integer from 1 to 20. `null` is the default and shows full text. An invalid value throws `TypeError`. This policy applies to current and future plain text parts, with no change to the envelope or events. Set the same two label attributes on the thread. A text delta updates the same text and button, so the open choice and focus stay. A component part uses its own fill and label attributes.

[The excerpt example](../../examples/evidence/excerpt.html) has a long synthetic passage with this control.
