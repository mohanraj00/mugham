# Status

2026-11-18. Release 0.2.1 is the newest release. The v0.3 scope is complete on the main branch, and it is not released. The owner decides on the v0.3 release. The kit has contract format 2, the tokens, the primitives, the catalog components, the message envelope and the thread for people and agents. An application can register its own contract and element. The kit has no workbench shell and no panels. [Decision 0001](decisions/0001-build-tools.md) gives the build tools and the dependency rule.

## On the main branch, not released

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
| v0.3 | Typed form edits and more input types. Evidence components: a diff, a table and a status. More components, and examples on a fixture API. Complete on the main branch |
| v0.4 | The offline mode with a queue of pending actions. An interface for an offline data source. A security review of the action path and the offline queue |
| v1.0 | A stable envelope and catalog contract, with a compatibility statement |

## Next

1. The owner decides on the v0.3 release. A release needs the owner approval for the tag.
2. Build the v0.4 scope: the offline mode with a queue of pending actions (#12), then the security review of the renderer, the action path and the offline queue (#15).
3. Make the envelope and the catalog contract stable for v1.0 (#17).
