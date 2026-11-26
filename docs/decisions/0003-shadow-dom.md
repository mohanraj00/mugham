# 0003: Shadow DOM and its effect on a test harness

Status: proposed, 2026-11-12. Issue: mohanraj00/mugham#38.

## Context

Each component of the kit is a custom element. All elements extend `MuElement` in `src/primitives/base.js`. The constructor calls `attachShadow({ mode: 'open', delegatesFocus })`. It then sets `adoptedStyleSheets` to the shared base sheet and the sheets of the element. `delegatesFocus` is true for the elements that a person can focus: the button, the field, the action button and the editable form.

An application styles a component with custom properties. A test harness or a script that reads the page must cross the shadow boundary. This record gives the reasons for shadow DOM, the alternative, and the effects.

## Options

### Option A: shadow DOM, open mode (current)

- The element renders into an open shadow root. Its styles are in the root.
- Advantages: a style rule of the page cannot change a component by accident. The component cannot change the page. The fill is data, and the render replaces all children of the root, so the page markup around the element stays apart from the render of the model content. The kit needs no class prefix and no build step for style scope. This keeps principle 2: no dependency, no compile step.
- Disadvantages: `document.querySelector` does not find the content inside a component. A harness must cross each root. A page stylesheet cannot style the inside.

### Option B: shadow DOM, closed mode

- `attachShadow({ mode: 'closed' })`.
- Advantages: a script of the page cannot reach the root.
- Disadvantages: the kit gains no security. A script on the page can replace `attachShadow` before the kit loads, and the platform gives no hard barrier. Principle 5 already treats untrusted content as text, so a closed root adds nothing. Closed mode also blocks the harness and the tests of the kit.

### Option C: light DOM

- The element renders into its own children, with scoped class names or attribute selectors.
- Advantages: `querySelector` and page CSS work with no extra step. Tools that read the page see the content at once.
- Disadvantages: a page rule can reach the inside of each component. The kit must keep a naming scheme to avoid a clash. The render of model content is in the page tree, where each page script and rule can change it. The kit cannot keep a contract for the style states.

## Comparison

| Topic | A: open | B: closed | C: light |
|---|---|---|---|
| Style scope | Platform | Platform | Naming rules |
| Page CSS reaches the inside | No | No | Yes |
| Custom properties reach the inside | Yes | Yes | Yes |
| `querySelector` finds the inside | No | No | Yes |
| Harness can read the inside | Yes, with the root | No | Yes |
| Accessibility tree | Complete | Complete | Complete |

## Decision

Option A. The kit uses open shadow roots. The owner accepts this record with the PR.

## How a test harness reads a component

1. The accessibility tree is the first choice. Browsers flatten the shadow tree into the accessibility tree, so a role and an accessible name are the same as for light DOM. `tools/browser_check.mjs` reads the tree through the Chrome DevTools Protocol and checks the roles and names. A harness that tests what a person or a screen reader gets uses this path.
2. The open root is the second choice, for the state and the text that the tree does not show. `element.shadowRoot` gives the root. A harness enters each nested root, for example `mu-card-grid` holds `mu-card`. `tests/browser/components.js` does this with `deepQuery` and `deepText`.
3. The host gives the state without a root. `data-state` has the values `default`, `refused`, `empty`, `disabled`, `pending`, `done` and `error`. The `fill` and `value` properties and the `mu-action`, `mu-edit` and `mu-refused` events are on the host. The events are `composed`, so a listener on the page receives them.
4. Do not use a selector that crosses a root in the document. Some tools pierce open roots (for example the selector engines of browser drivers). Use them only as a convenience. The record does not depend on them.

## How an application styles a component

- Custom properties are the public style interface. `src/tokens/tokens.css` defines the `--mu-*` tokens on `:root`. Custom properties inherit through the shadow boundary. An application sets a token on the page, or on one host, and the component uses it. The contract of each component lists the tokens it uses, and a browser check shows that the styles use only the declared tokens.
- The dark theme comes from `prefers-color-scheme`. An application can force the light theme with the attribute `data-mu-theme="light"` on the root element.
- Forced colors and reduced motion are in the component styles. An application does not need to handle them.
- Parts are a second interface. The render code sets a `part` attribute on the main inner elements, for example `card`, `button`, `status`, `form`, `list` and `input`. A page rule such as `mu-card::part(card)` styles one part. A part gives no access to the children of a part. A part of a nested element is reachable from the page only when the outer element exports it. The amendment for issue 135 replaces the v0.2 rule that the kit does not use `exportparts`.
- Each contract declares its parts and its custom properties. In v0.2 the catalog did not declare the parts. The amendment for issue 135 replaces that rule.
- The kit has no `<slot>`. The fill is data, so an application cannot put markup inside a component. This keeps principle 1.

## Amendment for issue 135

The contract of each kit component declares its style parts. The optional `parts` list in formats 2 and 3 gives each name, its use and its guardrail flag. When the kit shows a guardrail part, a page must keep it visible.

A component can use `exportparts` to give a page access to selected parts of a nested element. The outer contract declares each exported name with a prefix from the inner element, for example `card-title` on `mu-card-grid`. An exported part keeps the guardrail flag of the inner part.

A test scans the render source and compares each component's direct and exported part names with its contract in both directions. The [theme guide](../guides/theme.md#declared-parts) lists the names and the visibility rules for page styles.

## Effects

- A script that reads the page text with `document.body.innerText` or `textContent` of the page sees no component content. A scraper must cross the roots, or use the accessibility tree.
- An application cannot make a refusal, an error or a receipt disappear with a page rule. The state is honest (principle 6).
- A page rule cannot hide the focus ring or the pending state of an action, except through a part. An application that restyles a part owns the result.
- Server side rendering gives no content, because the kit renders on the device. Declarative shadow DOM is out of scope for v0.2.

## Checks

`tests/browser/components.js` has these checks for this record:

- Each element has an open shadow root.
- A custom property on a host changes the style inside.
- A rule of the page does not reach the shadow tree, but a `::part()` rule reaches a part.

Earlier checks already use the open root and the accessibility tree. No earlier check disagreed with this record, so the PR changes no earlier check.
