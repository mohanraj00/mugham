# For coding agents

This guide is for a coding agent that builds a UI with the kit. Obey each rule. Read the file of the task before you write code. Verify the page with the checklist.

## Rules

1. Fill only a declared component. Each component has a contract in `catalog/`, or a contract that the application registers with `register`. The kit refuses each other component.
2. Give an element its content only through its `fill` property, with data that the contract accepts. Never write markup, style or script into a fill.
3. Never put model output, tool output or document text into `innerHTML`, a style or a script. In an application element, make each node with `el` and `text` from `src/render/dom.js`.
4. Bind each tool in code with the `action` property of the element, or with `bind` of `mu-thread`. A fill never names a tool. The label of the binding must be the label of the fill.
5. Show an action as done only with `receipt()`, after the response of the API. Give a receipt with `ok` set to `false` if the request fails.
6. Set `actor` before `fill`. Use the actor of the envelope or of your session, never the authorship claim of a fill.
7. Load `src/tokens/tokens.css` first. Theme the page only with the `--mu-` properties. Do not override the state text, the focus ring, the provenance or forced colors.
8. Add no runtime dependency and no build step. Use only synthetic data in examples and tests.

## The file to read for each task

| Task | Read |
|---|---|
| Build a page | [assemble.md](assemble.md), then [examples/guides/assemble.js](../../examples/guides/assemble.js) |
| Fill a component | The contract in [catalog/](../../catalog/README.md), then [contracts.md](contracts.md) |
| Know the contract format | [catalog/schema/README.md](../../catalog/schema/README.md) |
| Bind an action, a confirm step or a form | [catalog/README.md#actions](../../catalog/README.md#actions) |
| Add a domain component | [catalog/README.md#application-contracts](../../catalog/README.md#application-contracts), then [examples/register.js](../../examples/register.js) |
| Show a thread or read agent events | [src/thread/README.md](../../src/thread/README.md), then [docs/contracts/envelope.md](../contracts/envelope.md) |
| Theme the page | [theme.md](theme.md) |
| Change the kit itself | [AGENTS.md](../../AGENTS.md) and [.agents/skills/component-workflow/SKILL.md](../../.agents/skills/component-workflow/SKILL.md) |

## A binding

<!-- source: examples/guides/assemble.js -->
```js
renew.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
```

<!-- source: examples/guides/assemble.js -->
```js
renew.addEventListener('mu-action', async (event) => {
  renew.receipt(await api(event.detail));
});
```

## Checklist

Verify each item before you report the page as done.

- [ ] The page loads `src/tokens/tokens.css` before the kit code, and it is served over HTTP.
- [ ] The page calls `define` of `src/components/index.js`, and `define` of `src/thread/index.js` if it uses `mu-thread`.
- [ ] No element shows `Refused`, and `data-state` is not `refused` on an element, except for each fill that you planned to refuse.
- [ ] No fill has an `actions` key, a key that its contract does not declare, or markup that you expect to render.
- [ ] Each action element has a binding. A press shows `Pending`, and only the receipt shows `Done` or `Not done`.
- [ ] Each message of the thread shows the correct actor name and type: `Person`, `Agent` or `System`.
- [ ] Each component with `ai_content` set to `true` shows `Author:` with the bound actor.
- [ ] The page has no `innerHTML`, no inline script and no inline style. It works with the content security policy of [examples/guides/assemble.html](../../examples/guides/assemble.html).
- [ ] The page works with the keyboard only: Tab reaches each control, and Enter and Space press it.
- [ ] The page works in the light theme, the dark theme, forced colors and reduced motion. Each theme color keeps the contrast pairs of [theme.md](theme.md#the-contrast-of-a-theme).
- [ ] `make check` passes.
