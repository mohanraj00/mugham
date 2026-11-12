<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logos/mugham-lockup-dark.svg">
  <img src="docs/brand/logos/mugham-lockup.svg" alt="mugham" width="224" height="64">
</picture>

# mugham

Mugham is a UI toolkit for agentic applications. The name is the Tamil word for "face".

Agents and LLMs: read [CONSTITUTION.md](CONSTITUTION.md) and [AGENTS.md](AGENTS.md) first.

Status: release `v0.1.0` is out. It has the contract format, the design tokens, the primitives and the first catalog components. The thread, the message envelope and the offline mode are not built yet. The plan is in [docs/STATUS.md](docs/STATUS.md) and in the GitHub milestones.

## What it gives

- **A thread for people and agents.** Several people and several agents can be in one conversation. Each message names its actor.
- **Declared components.** Cards, action buttons, editable forms and card grids come from a component catalog. A model fills a declared component with data. It never sends markup or code.
- **Actions with receipts.** An action goes to the API of your application. The kit shows it as done only after the receipt comes back.
- **Each device.** The kit runs as a progressive web app. In offline mode, it keeps each action in a queue and shows it as pending.
- **Examples.** Synthetic examples show how to build a page from the catalog.
- **No dependencies.** The kit uses only web standards and has no third-party runtime dependency. It works with any web framework, or with none.

## Highlights

The images show the light theme. If your viewer uses the dark theme, the images show the dark theme.

**Actions with receipts.** The application binds the tool. A press shows `Pending`. The button shows `Done` or `Not done` only after the receipt of the API comes back.

| Pending | Done | Not done |
|---|---|---|
| <picture>  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/action-button-pending-dark.png">  <img src="docs/screenshots/action-button-pending-light.png" alt="Renew button with the status Pending" width="300"></picture> | <picture>  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/action-button-done-dark.png">  <img src="docs/screenshots/action-button-done-light.png" alt="Renew button with the status Done" width="300"></picture> | <picture>  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/action-button-error-dark.png">  <img src="docs/screenshots/action-button-error-light.png" alt="Renew button with the status Not done and a reason" width="300"></picture> |

**Cards and card grids.** A model fills a card with data. It never sends markup or style.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/card-dark.png">
  <img src="docs/screenshots/card-light.png" alt="A card: Field guide to moss, a summary, a due date, and the facts Shelf and Renewals" width="420">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/card-grid-dark.png">
  <img src="docs/screenshots/card-grid-light.png" alt="Three loan cards in two columns" width="600">
</picture>

**Editable forms.** A person edits the values and saves them as one action. The form shows `Done` only after the receipt comes back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/editable-form-done-dark.png">
  <img src="docs/screenshots/editable-form-done-light.png" alt="A form with two fields, a Save button and the status Done" width="420">
</picture>

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

The first five components are primitives. The other components use them.

### Make the screenshots again

The images come from a fixture page with synthetic data, [tests/browser/gallery.html](tests/browser/gallery.html). The script uses Node.js and Chrome only. It writes the images to [docs/screenshots/](docs/screenshots/). The images are not in the package. The constitution allows 16 images maximum, so the images show only the highlights.

```sh
make screenshots
```

If Chrome is not at its usual path, set `CHROME` to the path of the Chrome executable.

## Try it

The examples use synthetic data. Serve the repository root with a static file server, then open an example:

```sh
python3 -m http.server 8000
```

- [examples/primitives.html](examples/primitives.html): each primitive. Open `http://localhost:8000/examples/primitives.html`.
- [examples/loans.html](examples/loans.html): a card, an action button, a card grid and a form. Open `http://localhost:8000/examples/loans.html`.

Run the project checks with `make check`. The checks need Python 3, Node.js and Chrome.

## Brand

The logo files, the colors and the type rules are in [docs/brand/](docs/brand/README.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [constitution](CONSTITUTION.md). Report a possible vulnerability as [SECURITY.md](SECURITY.md) says.

## License

Apache-2.0. See [LICENSE](LICENSE).
