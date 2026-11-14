# Status

2026-11-14. Release 0.2.1 is ready for the owner to tag. The kit has contract format 2, the tokens, the primitives, the catalog components, the message envelope and the thread for people and agents. An application can register its own contract and element. The kit has no workbench shell and no panels. [Decision 0001](decisions/0001-build-tools.md) gives the build tools and the dependency rule.

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

1. Build the v0.3 scope: typed form edits, more input types, and the evidence components diff, table and status.
