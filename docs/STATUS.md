# Status

2026-11-28. Release 0.9.0 is ready for the owner to tag. The v0.9 scope is complete. The kit has contract format 2, the tokens, the primitives, the catalog components, the message envelope and the thread for people and agents. An application can register its own contract and element. The kit has no workbench shell and no panels. [Decision 0001](decisions/0001-build-tools.md) gives the build tools and the dependency rule.

## In release 0.9.0

- A compact visual design (decision 0009). New tokens set the control size, the touch size, the icon size and the field width. Each control is 32 CSS pixels with a mouse and 44 CSS pixels on a touch screen. The dialog and drawer close is an x, and the editable form can save with an icon (#204).
- The table and the data grid have a lighter style, and the table sort control has a sort mark (#204). Each table column takes the width of its text, and a narrow table scrolls in its own area (#193).
- The approvals example has an icon approve, an icon reject and a confirm step. The confirm step of a reject keeps its text (#204).
- A page override of an old token name still applies after a rename (#195).

## In release 0.8.0

- A receipt can give the optional fields `service` and `code`. A refusal shows them as text. `serviceHandler` binds one action handler to one base URL and one service name (#190).
- A service status strip shows the state of each service as text and announces changes (#191). Its details stay correct after a reorder, and a remade row keeps the focus (#197).
- The page style keeps a wide plain table in the scroll box `data-mu-scroll` and breaks a long token in plain page text (#194).
- An example page shows one region for each of three synthetic services, each with its own fixture API (#189).

## In release 0.7.0

- Compact icon controls for cards, card grids and the rich text link editor (#180). Their tooltip text floats, so no other control moves (#186).
- Completed buttons stay done when the same action returns after a refusal. Grid edits pause until a valid fill returns (#144).
- An image redirect policy example, one mailbox per mail link and an optional check of message actors (#144).
- Dismiss controls for unreadable queue records. The queue holds the owner lock after close while an active try finishes its storage work (#144).
- A run steps helper and a synthetic example. A thread shows `run-steps` fills (#168).
- Two browser checks wait for their elements (#141). Accessibility checks use the project page rules from [Decision 0006](decisions/0006-axe-core.md).

## In release 0.6.0

- Searchable select, multiple choice, toggle, range, date range, time and local date and time fields (#120, #121, #122, #123, #124, #150). An editable form also accepts registered fields (#125).
- Theme presets and a component gallery (#126). Each contract declares its style parts (#135).
- An app shell, navigation, page controls and state components (#127, #128).
- Run steps and a plan, with an approval queue for proposed actions (#129). Rich text shows approval marks from page code for the current fill (#137, #172).
- A rich text editor with symbols on its format buttons (#130, #175). The offline queue checks rich text without loading the catalog (#176).
- Clearer refusals and thread cards, a distinct style for completed actions, and retry and cancel controls for pending grid and upload actions (#132, #133, #134, #138).
- A long thread benchmark with a render time limit in the browser check (#131). Accessibility checks use the project page rules from [Decision 0006](decisions/0006-axe-core.md).

## In release 0.5.0

- The offline mode with a queue of pending actions, a service worker for page files and the `mu-action-queue` component (#12). [Offline queue contract](contracts/offline-queue.md) gives the rules.
- Security review fixes for pending actions, receipt checks and stored queue records (#15).
- An icon display for the action button (#118).
- A compact density preset and a full-width page option (#119).
- Documentation for server side rendering, browser support, action labels, narration claims and form choice (#136).

## In release 0.4.0

- Helper functions to build fills, mount components and export tool schemas (#104).
- The short contract form, format 3 (#103), and the default page style (#98).
- Collapsible cards (#96), a read more control for long text (#97) and the interaction details of the components (#101).
- One entry point for the examples (#99), a docs panel on each example (#100) and a reliable quickstart server (#111).

## In release 0.3.0

- Typed form edits (judgment, correction or override) and the input types number, date, choice and long text.
- The form card for long forms.
- The evidence components: `mu-diff`, `mu-table` and `mu-status`. The narration check for card claims.
- More components: `mu-image`, `mu-chart`, `mu-rich-text`, `mu-data-grid` and `mu-upload`.
- The offline data source interface (`read` and `mu-source-status`). The offline queue is not built.
- Decision 0006 on axe-core: the kit keeps zero development dependencies.
- Two examples on a fixture API: a review queue and a snapshot compare. The kit has no review panel and no knowledge panel. A service builds its own dashboard from an example.

## Plan

The GitHub milestones hold the issues of each release.

| Release | Scope |
|---|---|
| v0.1 | The component catalog and its contract format. Tokens, primitives, cards, action buttons, editable forms and card grids. The contract tests, the accessibility checks and the build check |
| v0.2 | The message envelope with actors and typed parts. A thread for people and agents, with streaming. A refusal of undeclared components. A receipt for each action |
| v0.3 | Typed form edits and more input types. Evidence components: a diff, a table and a status. More components, and examples on a fixture API. Complete, in release 0.3.0 |
| v0.4 | Usability: helper functions, the short contract form, the default page style, collapsible cards, the example entry point and docs panels. Complete, in release 0.4.0 |
| v0.5 | The offline mode, security review fixes, action button icons, compact density, full-width pages and design documentation. Complete, in release 0.5.0 |
| v0.6 | New form fields, support for registered fields and a rich text editor. Theme presets and a gallery, an application shell and page controls, views for agent work and document approvals, clearer thread cards and refusals, a long thread benchmark, declared part names, a distinct done style, and exits for pending grid and upload actions. Complete, in release 0.6.0 |
| v0.7 | Compact icon controls with floating tooltips, action and queue checks, link and image rules, a run steps helper and waits in browser checks. Complete, in release 0.7.0 |
| v0.8 | Service names and reason codes in refusals, a service handler, a service status strip, a page with one region for each service and page width rules. Complete, in release 0.8.0 |
| v0.9 | A compact visual design with icon controls, a lighter table and data grid, table column widths from the text, an icon approve and reject with a confirm step, and old token names after a rename. Complete, in release 0.9.0 |
| v1.0 | A stable envelope and catalog contract, with a compatibility statement |

## Next

1. The owner tags release 0.9.0 after this PR merges.
2. Make the envelope and the catalog contract stable for v1.0 (#17).
3. Run the offline queue check on a phone width with a service worker (#205).
4. Check each component with forced colors and reduced motion (#206).
5. Review the security of the kit on the release candidate (#207).
6. Make the docs short, current and complete for a new user (#208).
