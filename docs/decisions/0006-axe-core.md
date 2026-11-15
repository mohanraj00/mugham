# 0006: axe-core as a test-only tool

Status: proposed, 2026-11-15. Issue: mohanraj00/mugham#39.

## Context

Decision 0001 chose Option A: no development dependency. The accessibility checks are project rules in `tools/browser_check.mjs` and in the tests. Decision 0001 also named Option C as a later step: a pinned copy of axe-core in the test page only. This record decides on Option C.

The constitution forbids a third-party runtime dependency. A tool that only builds or tests the kit needs a decision record, and its code never goes into the package. A dependency manifest is a level 1 path. Issue mohanraj00/mugham#15, the security review of the offline queue, comes after this decision.

The markup of the kit is small and controlled:

- Each node comes from `el()` and `text()` in `src/render/dom.js`. `el()` accepts 15 attributes only, and it throws on each other attribute. The ARIA attributes are `role`, `aria-label`, `aria-describedby`, `aria-invalid`, `aria-live` and `aria-disabled`.
- Data goes into text nodes only. `tests/test_sinks.py` refuses markup sinks in `src/`.
- Each contract declares the role, the accessible name, the keys, forced colors and reduced motion of its component.

Thus most axe-core rules apply to markup that the kit cannot make. Examples are the rules for images, frames, tables, media, `lang`, `accesskey` and the attributes outside the list of `el()`.

## Options

### Option A: reject axe-core, and add project rules for the risks that apply

- The kit keeps zero development dependencies, no download in CI and no lock file.
- The project adds generic rules to the browser check for the axe-core risks that apply to the markup of the kit.
- Disadvantages: the project keeps its rules up to date itself. A new kind of markup needs a new rule.

### Option B: accept axe-core as in Option C of decision 0001

- `tools/browser_check.mjs` loads one pinned copy of axe-core into each check page and fails on a violation. The download has a SHA-256 check, and the file stays out of the checkout and out of the package. `tools/build.py` reads only the files that Git tracks in `src/`, `catalog/` and `LICENSE`, so the archive does not change, and the byte-identical build check does not change.
- The project gets a mature rule set.
- Disadvantages: each local check and each CI run downloads third-party code, or the project keeps a copy in the checkout. An update of the version is a review of a large file of minified code. The rule set mostly checks markup that the kit cannot make. axe-core does not check the keyboard, forced colors or reduced motion, so the project rules stay.

## Coverage

This table gives the axe-core rules that apply to the markup of the kit, and the project rule that covers the same risk.

| Risk | axe-core rule | Project rule |
|---|---|---|
| A control has no accessible name. | `button-name`, `input-button-name`, `label`, `link-name`, `aria-input-field-name`, `aria-toggle-field-name` | The browser check: each control in the accessibility tree of each check page and each example has a name. `tests/test_accessible_names.py`: each contract takes its name from a fixed text or a required field that cannot be blank. The browser check also reads the expected role and name of each page. |
| A group or a region has no name. | `aria-dialog-name`, `region` | The contract declares the name of each role. The browser check reads the expected names. |
| An id shows two times, or an id reference finds no target. | `duplicate-id-aria`, `aria-valid-attr-value` for the id references | The browser check: in each root, each id is unique, and each `aria-describedby`, `aria-labelledby` and `for` finds its target in the same root. |
| An ARIA attribute or role is not valid. | `aria-valid-attr`, `aria-roles`, `aria-allowed-attr` | `el()` accepts only the 15 attributes of its list. The browser check: each role is a known role, and each value of `aria-invalid`, `aria-live` and `aria-disabled` is valid. |
| A `tabindex` above 0 changes the focus order. | `tabindex` | The browser check: each `tabindex` is `-1` or `0`. |
| The text has too little contrast. | `color-contrast` | `tests/test_tokens.py`: the contrast of the text, muted text, accent, danger, border and focus tokens on the surface, in the light theme and in the dark theme. The browser check: the body text of each example app has a contrast of 4.5 or more. |
| A control cannot get the focus, or the focus order is wrong. | `focus-order-semantics`, `scrollable-region-focusable` (experimental) | The keyboard steps of the browser check: Tab, Enter, Space, Escape and the arrow keys on each component with a key in its contract. |
| A state shows with color only. | No rule | The browser checks of each component: the state text, the change markers and the edit type show as text. |
| Forced colors and reduced motion. | No rule | The four media modes of the browser check. |

`tests/browser/rules.html` has one defect of each kind that the generic rules check. The browser check fails if the rules do not find each defect.

These axe-core risks have no project rule, because the kit cannot make the markup: images with no text, frames, tables, media, the `lang` of the page and `accesskey`. An application that adds this markup owns its checks.

## Decision

Proposed: Option A. The kit does not use axe-core. Reasons:

- The constitution keeps the kit with no dependency, and the project has no development dependency now. Option B adds the first one for a small gain.
- `el()` limits the markup of the kit. The generic rules cover the axe-core risks that apply to this markup, and the fixture shows that the rules find each defect.
- A download of third-party code in each run adds a supply chain risk to the security review of mohanraj00/mugham#15.

Thus no dependency manifest changes, the dependency rule of decision 0001 does not change, and the build does not change.

Make a new record and examine Option B again if one of these occurs:

- A component makes markup that the generic rules do not cover, for example a table, an image or a dialog.
- A defect of accessibility comes in after a release, and an axe-core rule would find it.
- The kit gets a screen reader test plan that needs a mature rule set.
