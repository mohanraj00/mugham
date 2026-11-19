# Status

2026-11-19. Release 0.4.0 is ready for the owner to tag. The v0.4 scope is complete. The kit has contract format 2, the tokens, the primitives, the catalog components, the message envelope and the thread for people and agents. An application can register its own contract and element. The kit has no workbench shell and no panels. [Decision 0001](decisions/0001-build-tools.md) gives the build tools and the dependency rule.

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
| v0.5 | The offline mode with a queue of pending actions (#12). A security review of the action path and the offline queue (#15) |
| v1.0 | A stable envelope and catalog contract, with a compatibility statement |

## Next

1. The owner tags release 0.4.0 after this PR merges. A release needs the owner approval for the tag.
2. Build the v0.5 scope: the offline mode with a queue of pending actions (#12), then the security review of the renderer, the action path and the offline queue (#15).
3. Make the envelope and the catalog contract stable for v1.0 (#17).
