# Guides

Release: v0.9.0

Each guide states facts that the code proves. The code of each guide is in [examples/guides/](../../examples/guides/). `tools/browser_check.mjs` runs each guide page and checks the expected results. `tests/test_guides.py` checks that each code block is part of a checked file.

- [Contracts](contracts.md): what a contract declares, how the kit checks and refuses a fill, the slots, the action binding and an application contract.
- [Assemble a page](assemble.md): the tokens, `define`, a stack and a grid of cards, an action with a receipt, a thread with an event source, and an image origin policy.
- [Theme the kit](theme.md): each token, the light and dark themes, forced colors, reduced motion, a second theme, and what a page must not change.
- [For coding agents](agents.md): the rules, the file to read for each task, and a checklist to verify a page.

## Operations

Each page gives the purpose, the API call, a minimal example, the result and the errors of one public operation. Each example is an exact part of an example page or a test that `make check` runs.

| Operation | API |
|---|---|
| [Show a component](operations/show-a-component.md) | `define`, `mount` |
| [Check a fill](operations/check-a-fill.md) | `fill`, `createKit`, `validateFill`, `describe`, `toolSchema` |
| [Send an action](operations/send-an-action.md) | `action`, `onAction`, `serviceHandler` |
| [Show a thread](operations/show-a-thread.md) | `mu-thread`: `read`, `push`, `bind`, `perform` |
| [Register a component](operations/register-a-component.md) | `register` |
| [Queue an action offline](operations/queue-an-action-offline.md) | `openQueue`, `queueActions`, `queueFill` |
| [Read an offline source](operations/read-an-offline-source.md) | `read`, `statusFill` |
| [Show run steps](operations/show-run-steps.md) | `createRunSteps` |
| [Check narration](operations/check-narration.md) | `checkNarration` |
| [Theme a page](operations/theme-a-page.md) | `tokens.css`, `--mu-` properties |
