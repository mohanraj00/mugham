# Mugham constitution

Version 1, 2026-11-10.

## Purpose

Mugham is a UI kit and a workbench for AI applications. The name is the Tamil word for "face". The kit gives a chat thread for people and agents, cards, action buttons, editable forms and card grids. A component catalog declares each component. The kit runs on each device as a progressive web app, with an offline mode. The workbench is a shell with one panel for each connected service.

### Consumers

- Developers of vertical AI applications. They build the screens of their application from the catalog.
- Agents. An agent fills a declared component with data, and it proposes actions.
- People who use an application: end users, reviewers, approvers and operators. Several people and several agents can be in one thread.
- Services that supply a workbench panel through a read API. The first services are entelos, groundgate, aavanam, nookku and koodam.

## Boundaries

Mugham owns the components, the component catalog and its contract format. It also owns the message envelope, the thread, the workbench shell, the panel contract and the offline queue.

An application owns its screens, its domain cards, its wording, its decisions, its users and its sign-in. A service owns the API of its panel and each decision that the panel shows.

Mugham does not decide. An action goes to the API of the application or the service, and that API decides. Mugham shows the result.

These items are out of scope: a model runtime, an agent framework, an identity provider, a server framework and a design tool.

## Principles

1. **The catalog is the contract.** Each component has a contract file. The contract declares the data, the states, the tokens, the accessibility rules, and if the component shows AI content. A model fills only declared components, with data that the contract accepts. A model never sends markup, style or code. The thread refuses an undeclared component and shows the refusal.
2. **Few dependencies.** The kit uses web standards, for example custom elements. The kit has no third-party runtime dependency. A new runtime dependency is a level 1 change. Each build of the same source gives the same bytes.
3. **Each actor is named.** Each message has an actor type (human, agent or system) and an actor id. The kit never shows the content of an agent as the content of a person.
4. **Each action has a receipt.** An action is a tool name and its arguments. The kit shows an action as done only after the receipt of the API comes back. Each form edit records its type: judgment, correction or override.
5. **Untrusted content stays data.** Model output, tool output and document text show as text. The kit never puts them into markup or script. A link from such content loads only after a person clicks it.
6. **Offline is honest.** When the device is offline, the kit keeps each action in a queue and shows it as pending. A pending action goes through after the device reconnects. The kit never shows a pending action as done.
7. **Accessible by default.** Each component works with a keyboard and a screen reader. Each component respects forced colors and reduced motion.

## Evidence

Each component has contract tests and accessibility checks. A build check compares the bytes of two builds. Each workbench panel has a seam test in this project. The seam test pins a released version of its service. Do not claim speed, model quality or compatibility without a test that shows it.

## Contributions

Do not add private product material, product names, brand assets, customer data, credentials or generated binaries. Examples and test data are synthetic and neutral. Review each example before its first commit. The license is Apache-2.0.

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

### Version 1, 2026-11-10

The first version of the constitution. Reason: the start of the project.
