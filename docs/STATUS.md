# Status

2026-11-12. Release 0.1.0 is tagged. The kit has the contract format, the tokens, the primitives and the first catalog components. The kit has no workbench shell and no panels. [Decision 0001](decisions/0001-build-tools.md) gives the build tools and the dependency rule.

## Plan

The GitHub milestones hold the issues of each release.

| Release | Scope |
|---|---|
| v0.1 | The component catalog and its contract format. Tokens, primitives, cards, action buttons, editable forms and card grids. The contract tests, the accessibility checks and the build check |
| v0.2 | The message envelope with actors and typed parts. A thread for people and agents, with streaming. A refusal of undeclared components. A receipt for each action |
| v0.3 | Typed form edits and more input types. Evidence components: a diff, a table and a status |
| v0.4 | The offline mode with a queue of pending actions. An interface for an offline data source. A security review of the action path and the offline queue |
| v1.0 | A stable envelope and catalog contract, with a compatibility statement |

## Next

1. Build the evidence components and the extension point for application contracts.
