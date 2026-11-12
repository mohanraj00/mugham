# Mugham constitution

Version 4, 2026-11-12.

## Purpose

Mugham is a UI toolkit for agentic applications. The name is the Tamil word for "face". The kit gives a chat thread for people and agents, cards, action buttons, editable forms and card grids. A component catalog declares each component. The kit runs on each device as a progressive web app, with an offline mode. The kit has no workbench shell and no panels. The owner of a service or an application can build a dashboard with the kit.

### Consumers

- Developers of vertical AI applications. They build the screens of their application from the catalog.
- Agents. An agent fills a declared component with data, and it proposes actions.
- People who use an application: end users, reviewers, approvers and operators. Several people and several agents can be in one thread.
- Owners of a service API who build a standalone dashboard with the kit. The owner of the dashboard develops it, not mugham.

## Boundaries

Mugham owns the components, the component catalog and its contract format. It also owns the message envelope, the thread and the offline queue. It owns no workbench shell and no panel.

An application owns its screens, its domain cards, its wording, its decisions, its users and its sign-in. A service owns its API and each decision that its API makes. A dashboard that uses the kit changes state only through the API of its service.

Mugham does not decide. An action goes to the API of the application or the service, and that API decides. Mugham shows the result.

These items are out of scope: a model runtime, an agent framework, an identity provider, a server framework and a design tool.

## Principles

1. **The catalog is the contract.** Each component has a contract file. The contract declares the data, the states, the tokens, the accessibility rules, and if the component shows AI content. A model fills only declared components, with data that the contract accepts. A model never sends markup, style or code. The thread refuses an undeclared component and shows the refusal.
2. **No dependencies.** The published kit has no third-party runtime dependency: no framework, no library and no copied third-party code. The kit uses only web standards, for example custom elements, ES modules and CSS custom properties. The source is plain JavaScript, so the kit has no compile step. A tool that only builds or tests the kit needs a decision record, and its code never goes into the package (decision 0001). To add a runtime dependency, first amend this principle. Each build of the same source gives the same bytes.
3. **Each actor is named.** Each message has an actor type (human, agent or system) and an actor id. The kit never shows the content of an agent as the content of a person.
4. **Each action has a receipt.** An action is a tool name and its arguments. The kit shows an action as done only after the receipt of the API comes back. Each form edit records its type: judgment, correction or override.
5. **Untrusted content stays data.** Model output, tool output and document text show as text. The kit never puts them into markup or script. A link from such content loads only after a person clicks it.
6. **State is honest.** The kit shows the true state of each message and each action. While an agent streams a message, the kit marks the message as partial. When the device is offline, the kit keeps each action in a queue and shows it as pending. A pending action goes through after the device reconnects. The kit never shows a partial message as final or a pending action as done.
7. **Accessible by default.** Each component works with a keyboard and a screen reader. Each component respects forced colors and reduced motion.
8. **Framework and vendor neutral.** An application uses the kit with any web framework, or with none. The kit binds to no model vendor and no agent framework. The catalog fill format is the native contract of the kit. An adapter maps an outside agent protocol to that format.

## Evidence

Each component has contract tests and accessibility checks. A build check compares the bytes of two builds. Each example that reads a service API runs against a fixture API with synthetic data. A test that uses a released service pins its version. Do not claim speed, model quality or compatibility without a test that shows it.

## Contributions

Do not add private product material, product names, brand assets, customer data, credentials or generated binaries. The one exception is the README screenshots in `docs/screenshots/`. `make screenshots` makes them from synthetic data. They show only the highlights of the kit, with 16 images maximum, and the package does not contain them. Examples and test data are synthetic and neutral. Review each example before its first commit. The license is Apache-2.0.

## Governance

<!-- governance:start v1 -->
This project follows the project standard in `docs/STANDARD.md`. That file is an exact copy from `mohanraj00/.github`. The standard owns the rules for builds, reviews, approvals and CI. A project exception to the standard is valid only when the standard records it.

The documents own these topics:

- `CONSTITUTION.md`: the purpose, the boundaries, the principles, the evidence rules, the contribution rules and the version log.
- `docs/STANDARD.md`: the builds, the reviews, the approvals and CI.
- `AGENTS.md`: the layout, the check command and the review guidelines.
- `CLAUDE.md` and `GEMINI.md`: imports only.

These rules apply to each change:

1. A harness does not review its own change. The Codex security review is the one exception, as the standard says.
2. The agents use the owner login. An agent never approves a PR and never merges a level 1 PR. An agent never adds the labels `accepted`, `security-reviewed`, `cross-reviewed` or `ready-for-review`.
3. The owner merges each level 1 PR.
4. Each tag, release, package publication, visibility change and outreach step needs a separate owner approval.
<!-- governance:end v1 -->

## Amendment

Change this constitution when the owner changes direction or evidence changes a decision. A change is a level 1 PR. Record the reason in the change, and add an entry to the version log.

Change the governance block only with a new version of the template in `mohanraj00/.github`.

## Version log

### Version 4, 2026-11-12

The README screenshots in `docs/screenshots/` are an exception to the rule against generated binaries. They show only the highlights of the kit, with 16 images maximum. Reason: the owner wants the README to show the kit to people and to LLMs, so that more projects use it. A script makes the images again from synthetic data, and the owner updates the highlights when the kit grows.

### Version 3, 2026-11-12

Mugham is a UI toolkit for agentic applications. The kit has no runtime dependency, and a new one needs an amendment of this constitution. The kit is neutral to the framework, the model vendor and the agent framework. The kit marks partial and pending state. Reason: the owner wants a clear identity for the kit and a firm rule against dependencies. The rule keeps the kit small, portable and easy to review.

### Version 2, 2026-11-12

Mugham is a UI kit with examples. It has no workbench shell and no panels. Reason: the owner decided that each project builds its own standalone dashboard with the kit, and that an application owns any integrated workbench. This keeps the kit independent of each service and keeps its scope small.

### Version 1, 2026-11-10

The first version of the constitution. Reason: the start of the project.
