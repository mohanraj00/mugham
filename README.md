<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logos/mugham-lockup-dark.svg">
  <img src="docs/brand/logos/mugham-lockup.svg" alt="mugham" width="224" height="64">
</picture>

# mugham

Mugham is a UI toolkit for agentic applications. A coding agent, or a model at run time, builds the UI from declared components. The page keeps control:

- A model fills only declared components, with data that the contract accepts. It never sends markup, style or code.
- Each message names its actor: a person, an agent or the system.
- The page binds each tool in code. A fill never names a tool.
- An action shows `Done` only after the receipt of your API comes back.

Start with the [quickstart](#quickstart) or the [guides](docs/guides/README.md). The kit has no runtime dependency and no build step. The name is the Tamil word for "face".

Agents and LLMs: read [CONSTITUTION.md](CONSTITUTION.md) and [AGENTS.md](AGENTS.md) first.

Status: release `v0.2.1` is the newest. It has the contract format 2, the design tokens, the primitives, the catalog components, the message envelope and the thread for people and agents. The offline mode is not built yet. The plan is in [docs/STATUS.md](docs/STATUS.md) and in the GitHub milestones.

## Docs

The [guides](docs/guides/README.md) show how to build a page with the kit. A check runs the code of each guide.

- [Contracts](docs/guides/contracts.md): what a contract declares, how the kit refuses a fill, and how to register an application contract.
- [Assemble a page](docs/guides/assemble.md): a stack, a grid of cards, an action with a receipt and a thread.
- [Theme the kit](docs/guides/theme.md): each token, the two themes, forced colors, reduced motion and the parts a page must not change.
- [For coding agents](docs/guides/agents.md): the rules, the file to read for each task and a checklist.

## The thread

These four frames come from [examples/thread.html](examples/thread.html), in order. Two people and two agents talk about a synthetic library loan. If your viewer uses the dark theme, the images show the dark theme.

1. **People and agents.** Robin and Sam are people. The catalog agent answers and fills a declared card. Each message shows the name and the type of its actor, and each agent message has a mark at its left edge. The card shows `Author:` with the agent that filled it.

   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/thread-1-people-and-agents-dark.png">
     <img src="docs/screenshots/thread-1-people-and-agents-light.png" alt="Messages from Robin, Person and Sam, Person, then two messages from Catalog agent, Agent. The second message has the card Field guide to moss, with the facts Shelf B-14 and Renewals 1 of 3." width="520">
   </picture>

2. **A refused part.** The catalog agent sends a component with the name `banner`. No contract has this name, so the thread does not show the part. It shows the refusal as text.

   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/thread-2-refused-dark.png">
     <img src="docs/screenshots/thread-2-refused-light.png" alt="A message from Catalog agent, Agent, with the text: Refused: the thread did not show this part. component: no contract has the name banner" width="520">
   </picture>

3. **The action is pending.** The renewal agent proposes the Renew action. The page binds the tool `library.renew` in code. A person presses the button, and it shows `Pending` while the request goes to the API.

   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/thread-3-pending-dark.png">
     <img src="docs/screenshots/thread-3-pending-light.png" alt="A message from Renewal agent, Agent, with a Renew button and the status Pending" width="520">
   </picture>

4. **The action is done.** The receipt of the API comes back. Only then does the button show `Done`, with the message and the reference of the receipt.

   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/thread-4-done-dark.png">
     <img src="docs/screenshots/thread-4-done-light.png" alt="The Renew button with the status Done: The loan is renewed to 2026-12-08. Reference: R-0001" width="520">
   </picture>

`make screenshots` makes these images again from the example and its synthetic data. It uses Node.js, Python 3 and Chrome. If Chrome is not at its usual path, set `CHROME` to the path of the Chrome executable. The images are not in the package.

## Build a UI with a coding agent

Give the agent the task and the guide. For example:

```text
Build a page with the mugham kit that <your task>.
Read docs/guides/agents.md first and obey each rule.
Use only components that have a contract in catalog/ or a contract that you register.
Bind each tool in code. Show Done only after the receipt of the API.
Verify the page with the checklist of the guide.
```

The guide [docs/guides/agents.md](docs/guides/agents.md) gives the rules, the file to read for each task and a checklist. The other [guides](docs/guides/README.md) give the code of each step.

Run these checks:

1. Verify the page with each item of the [checklist](docs/guides/agents.md#checklist).
2. Load the page in a browser. Make sure that no element shows `Refused`, except for each fill that you planned to refuse.
3. If the agent changes this repository, run `make check`. The checks need Python 3, Node.js and Chrome.

## What it gives

- **A thread for people and agents.** Several people and several agents can be in one conversation. Each message names its actor.
- **Declared components.** Cards, action buttons, editable forms and card grids come from a component catalog. A model fills a declared component with data. It never sends markup or code.
- **Actions with receipts.** An action goes to the API of your application. The kit shows it as done only after the receipt comes back.
- **Examples.** Synthetic examples show how to build a page from the catalog.
- **No dependencies.** The kit uses only web standards and has no third-party runtime dependency. It works with any web framework, or with none.

## Catalog

Each component has a contract file in [catalog/](catalog/README.md). The contract declares the data, the states and the accessibility rules. A model fills a component only with data that its contract accepts.

| Component | What it does | Contract |
|---|---|---|
| `mu-text` | Shows a run of text. It never shows the value as markup. | [text.json](catalog/text.json) |
| `mu-button` | Sends a press event to the code that contains it. | [button.json](catalog/button.json) |
| `mu-field` | A labeled text input, with a hint, an error and a disabled state. | [field.json](catalog/field.json) |
| `mu-stack` | Puts its child elements in one column or one row. | [stack.json](catalog/stack.json) |
| `mu-grid` | Puts its child elements in columns of equal width. | [grid.json](catalog/grid.json) |
| `mu-card` | Shows a title, a summary, a date and up to six facts. | [card.json](catalog/card.json) |
| fact | A label and a value in a card. It has no element of its own. | [fact.json](catalog/fact.json) |
| `mu-action-button` | A button for one action. It shows done only after the receipt comes back. | [action-button.json](catalog/action-button.json) |
| `mu-editable-form` | Up to 20 text fields. A person edits the values and submits them as one action. | [editable-form.json](catalog/editable-form.json) |
| `mu-card-grid` | A labeled list of cards in columns of equal width. | [card-grid.json](catalog/card-grid.json) |
| `mu-citation` | The source of a claim: a source name, a locator as text and an open button. | [citation.json](catalog/citation.json) |
| `mu-excerpt` | A passage of a source as text with a marked span, the source name, the locator as text and an open button. | [excerpt.json](catalog/excerpt.json) |

The first five components are primitives. The other components use them.

## Quickstart

The examples are ES modules that import JSON files. A browser blocks module imports from a `file:` page. Thus the page needs an HTTP server. The kit has no dependency, so there is nothing to install.

1. Install Python 3 and Git. Use a browser from the [browser support](#browser-support) list.
2. Clone the repository and go to its root:

```sh
git clone https://github.com/mohanraj00/mugham.git
cd mugham
```

3. Start a static file server at the repository root:

```sh
python3 -m http.server 8000
```

   If port 8000 is in use, the command fails with an error. Choose a different port, for example `python3 -m http.server 8001`, and use that port in the next step.

4. Open an example in the browser. The examples use synthetic data. The URLs below use port 8000.
   - `http://localhost:8000/examples/primitives.html`: each primitive.
   - `http://localhost:8000/examples/loans.html`: a card, an action button, a card grid and a form.
   - `http://localhost:8000/examples/citation.html`: a citation in a message, a citation with no source and a refused citation.
   - `http://localhost:8000/examples/excerpt.html`: an excerpt of a synthetic document in a message, and a refused excerpt.
   - `http://localhost:8000/examples/provenance.html`: a card with the authorship slot and the citation slot, and a refused card.
   - `http://localhost:8000/examples/register.html`: an application contract and element for a synthetic seed tray, a refused fill, and the tray in a thread.

5. For the thread example, stop the static server and start the example server. It streams synthetic agent events as server-sent events and gives the receipt of each action:

```sh
python3 tools/thread_server.py
```

   The server prints the URL of the example. Open that URL. The default port is 8765. If that port is in use, the server takes a free port and prints its URL. To choose the port, use `python3 tools/thread_server.py --port 8766`. If a port that you chose is in use, the server prints one line that names the port and exits with an error. Then choose a different port. Two people and two agents talk about a loan. The thread refuses one undeclared component. The Renew action shows `Done` only after the receipt comes back.

6. For the example apps, start the fixture API of the apps. It prints the URL of each app. The default port is 8770. If that port is in use, the server takes a free port.

```sh
python3 tools/apps_server.py
```

   - `http://127.0.0.1:8770/examples/apps/support/`: a support desk. A person opens a ticket, corrects the reply that an agent drafts, and sends it.
   - `http://127.0.0.1:8770/examples/apps/changes/`: a change review. An agent proposes a timetable change with a citation and source excerpts. A reviewer approves it with a confirm step and gets a receipt reference.
   - `http://127.0.0.1:8770/examples/apps/inspection/`: a field inspection for a phone. A registered checklist component, a findings form and a close action with a confirm step.

To use the kit in your own page, serve `src/` and `catalog/` from one origin, load `src/tokens/tokens.css`, then import `define` from `src/components/index.js` and call it. [src/README.md](src/README.md) gives the steps.

Each release has the archive `mugham.tar` and its `mugham.tar.sha256` file as release assets. Two builds of the same source give the same bytes. The release publishes no package ([decision 0004](docs/decisions/0004-package.md)).

Run the project checks with `make check`. The checks need Python 3, Node.js and Chrome.

## Browser support

The kit imports JSON files with the syntax `import x from './x.json' with { type: 'json' }`. A browser must support this syntax. These are the minimum versions:

| Browser | Minimum version |
|---|---|
| Chrome and Edge | 123 |
| Safari | 17.2 |
| Firefox | 138 |

The checks of the project run in one pinned version of Chrome. They do not test the other browsers.

## Stability

The stability of the element API (the elements and their properties), the events (`mu-press`, `mu-edit`, `mu-action` and `mu-refused`) and contract format 2 is **experimental**, before v1.0. Each of them can change in a minor release. Format 1 changed in v0.2.0 ([mugham#35](https://github.com/mohanraj00/mugham/issues/35)). The [changelog](CHANGELOG.md) lists each change. v1.0 gives a compatibility statement.

## Brand

The logo files, the colors and the type rules are in [docs/brand/](docs/brand/README.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [constitution](CONSTITUTION.md). Report a possible vulnerability as [SECURITY.md](SECURITY.md) says.

## License

Apache-2.0. See [LICENSE](LICENSE).
