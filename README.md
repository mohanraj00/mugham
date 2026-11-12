<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logos/mugham-lockup-dark.svg">
  <img src="docs/brand/logos/mugham-lockup.svg" alt="mugham" width="224" height="64">
</picture>

# mugham

Mugham is a UI kit with examples for AI applications. The name is the Tamil word for "face".

Status: release `v0.1.0` is out. It has the contract format, the design tokens, the primitives and the first catalog components. The thread, the message envelope and the offline mode are not built yet. The plan is in [docs/STATUS.md](docs/STATUS.md) and in the GitHub milestones.

## What it gives

- **A thread for people and agents.** Several people and several agents can be in one conversation. Each message names its actor.
- **Declared components.** Cards, action buttons, editable forms and card grids come from a component catalog. A model fills a declared component with data. It never sends markup or code.
- **Actions with receipts.** An action goes to the API of your application. The kit shows it as done only after the receipt comes back.
- **Each device.** The kit runs as a progressive web app. In offline mode, it keeps each action in a queue and shows it as pending.
- **Examples.** Synthetic examples show how to build a page from the catalog.
- **Few dependencies.** The kit uses web standards and has no third-party runtime dependency.

## Brand

The logo files, the colors and the type rules are in [docs/brand/](docs/brand/README.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [constitution](CONSTITUTION.md). Report a possible vulnerability as [SECURITY.md](SECURITY.md) says.

## License

Apache-2.0. See [LICENSE](LICENSE).
