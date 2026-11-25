# For coding agents

This guide is for a coding agent that builds a UI with the kit. Obey each rule. Read the file of the task before you write code. Verify the page with the checklist.

## Rules

1. Fill only a declared component. Each component has a contract in `catalog/`, or a contract that the application registers with `register`. The kit refuses each other component.
2. Give an element its content only through its `fill` property, with data that the contract accepts. Never write markup, style or script into a fill.
3. Never put model output, tool output or document text into `innerHTML`, a style or a script. In an application element, make each node with `el` and `text` from `src/render/dom.js`.
4. Bind each tool in code with the `action` property of the element, or with `bind` of `mu-thread`. A fill never names a tool. The label of the binding must be the label of the fill.
5. Return the receipt of the API to `onAction` or pass it to `receipt()`. Give a receipt with `ok` set to `false` if the request fails.
6. Bind the actor of the envelope or of your session with `createKit`. Treat the authorship of a fill as a claim.
7. Load `src/tokens/tokens.css` first. Theme the page only with the `--mu-` properties. Do not override the state text, the focus ring, the provenance or forced colors.
8. Add no runtime dependency and no build step. Use only synthetic data in examples and tests.

## The file to read for each task

| Task | Read |
|---|---|
| Build a page | [assemble.md](assemble.md), then [examples/guides/assemble.js](../../examples/guides/assemble.js) |
| Fill a component | The contract in [catalog/](../../catalog/README.md), then [contracts.md](contracts.md) |
| Build a tool schema or check a fill | [Kit helpers](../../src/kit.md) |
| Know the contract format | [catalog/schema/README.md](../../catalog/schema/README.md) |
| Bind an action, a confirm step or a form | [catalog/README.md#actions](../../catalog/README.md#actions) |
| Add a domain component | [catalog/README.md#application-contracts](../../catalog/README.md#application-contracts), then [examples/cards/register.js](../../examples/cards/register.js) |
| Show a thread or read agent events | [src/thread/README.md](../../src/thread/README.md), then [docs/contracts/envelope.md](../contracts/envelope.md) |
| Theme the page | [theme.md](theme.md) |
| Change the kit itself | [AGENTS.md](../../AGENTS.md) and [.agents/skills/component-workflow/SKILL.md](../../.agents/skills/component-workflow/SKILL.md) |

## A binding

<!-- source: examples/guides/assemble.js -->
```js
const renewAction = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
```

<!-- source: examples/guides/assemble.js -->
```js
onAction(renew, (tool, args, id, request) => api(request));
```

## Action labels

The label in the fill must equal the label in the binding. If the binding says `Send reply`, the kit refuses a fill that says `Send Reply`. The exact match keeps the visible label under the control of the application. [Catalog action rules](../../catalog/README.md#the-binding)

The application gives the label to the model in the tool schema. If the model returns a full fill, use `const` to set the allowed value of `data.label` or, for a form, `data.submit_label`. Use the value from the binding. [Tool schema helper](../../src/kit.md#toolschemaname)

You can also ask the model for field values only. Put the action label in the schema description and ask for a single `reply` value. The application uses this value to build the form fill. It copies the title, field label and submit label from the binding. This example uses the actor and stack from the assemble page. [Assemble example setup](assemble.md#step-3-put-cards-in-a-stack-and-a-grid)

<!-- source: examples/guides/assemble.js -->
```js
const replyAction = {
  tool: 'library.send_reply', label: 'Send reply', title: 'Reply about loan L-0001',
  arguments: { loan_id: 'L-0001' }, editable: { reply: 'Reply' },
};
const modelData = { reply: 'Your loan is due on 2026-12-01.' };
const replyForm = kit.mount('editable-form', {
  title: replyAction.title,
  submit_label: replyAction.label,
  fields: [fill('field', { name: 'reply', label: replyAction.editable.reply, value: modelData.reply })],
}, { parent: stack, action: replyAction });
```

The form shows the draft and the `Send reply` button. A person can edit the draft, and then send it.

## Narration claims

The narration check compares only explicit `[Field: value]` claims with the card fill. Give the model the fact labels and values and the date label and value from the card. Ask it to copy the labels and values exactly. For the tray example, use this prompt. [Decision 0005](../decisions/0005-narration-check.md)

> Write one sentence about the tray. Use each card field in the form `[Field: value]`. Copy each label and value exactly. Use one colon and one space between them. Use square brackets only for claims. The card fields are `Count` with value `12`, `Status` with value `ready`, and `Date` with value `2026-11-15`.

The example response is `The tray has [Count: 12] items, with [Status: ready] on [Date: 2026-11-15].` Pass the response and the card fill to the narration check. This response gives three matching claims. [Tray example](../../examples/evidence/narration.json)

## Checklist

Verify each item before you report the page as done.

- [ ] The page loads `src/tokens/tokens.css` before the kit code, and it is served over HTTP.
- [ ] The page calls `define` of `src/components/index.js`, and `define` of `src/thread/index.js` if it uses `mu-thread`.
- [ ] Only the elements with fills that you planned to refuse have `data-state="refused"` and a `Technical details` control.
- [ ] No fill has an `actions` key, a key that its contract does not declare, or markup that you expect to render.
- [ ] Each action element has a binding. After send it shows `Pending`, and a missing or invalid receipt keeps it pending. A valid receipt can show `Done` or `Not done`. A local failure before send gives its own reason.
- [ ] Each message of the thread shows the correct actor name and type: `Person`, `Agent` or `System`.
- [ ] Each component with `ai_content` set to `true` shows `Author:` with the bound actor.
- [ ] The page has no `innerHTML`, no inline script and no inline style. It works with the content security policy of [examples/guides/assemble.html](../../examples/guides/assemble.html).
- [ ] The page works with the keyboard only: Tab reaches each control, and Enter and Space press it.
- [ ] The page works in the light theme, the dark theme, forced colors and reduced motion. Each theme color keeps the contrast pairs of [theme.md](theme.md#the-contrast-of-a-theme).
- [ ] `make check` passes.
