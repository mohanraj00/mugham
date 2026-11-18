# Data grid

`mu-data-grid` shows an editable grid, like a small spreadsheet. Its contract is [catalog/data-grid.json](../../catalog/data-grid.json). The grid has column headers, row headers and typed cells. A person moves between the cells with the keyboard and edits one cell in place. The kit computes no formula. The application computes each total and sends it as a value.

```js
import { define } from './src/components/index.js';
define();
const grid = document.createElement('mu-data-grid');
grid.actor = { type: 'agent', id: 'agent-budget' };
grid.action = { tool: 'budget.set_amount', arguments: { budget_id: 'B-2027' }, title: 'Synthetic budget 2027',
  rows: { rent: 'Rent', food: 'Food' }, columns: { jan: { label: 'January', type: 'number' } } };
grid.fill = fill;
grid.addEventListener('mu-action', async (event) => grid.receipt(await postToTheApi(event.detail)));
```

## Data

| Contract | Fields |
|---|---|
| `data-grid` | `label`, 1 to 120 code points. `columns`: 1 to 30 columns. `rows`: 0 to 200 rows. |
| `data-grid-column` | `key` and `label`. `type`: `text`, `number`, `date` or `choice`. `read_only`: optional. `choices`: 1 to 20 texts, only for a choice column. |
| `data-grid-row` | `key` and `label`. `cells`: one cell for each column. |
| `text-cell`, `number-cell`, `date-cell`, `choice-cell` | `value`: optional, with the type of the cell. `read_only`: optional. A cell with no value is empty. |

The element refuses a fill in these conditions, because the contract format cannot check them:

- The grid has no column, or two columns or two rows have the same key.
- A row does not have one cell for each column.
- A cell does not have the type of its column, for example a `text-cell` in a number column.
- A choice column has no choices, or two of its choices are the same. A different column has choices.
- The value of a choice cell is not one of the choices of its column.

Each header, each value and each marker shows as text. A fill has no tool, no formula and no style.

## Keyboard

The grid follows the ARIA grid pattern. The table has the role `grid`. Each column header and each row header is a header cell, so a screen reader reads the two headers of a cell. One cell has the Tab stop.

| Key | Result |
|---|---|
| Tab, Shift+Tab | Moves the focus into the grid, to the cell that had the focus last, and out of the grid. |
| Arrow keys | Move the focus one cell. The focus stops at the edge of the grid. |
| Home, End | Move to the first or the last cell of the row. With Control, move to the first or the last cell of the grid. |
| Enter | Opens the editor of the cell with its value. In the editor, Enter saves. |
| A typed character | Opens the editor with that character in place of the value. |
| Escape | In the editor, cancels. The cell shows its value from before the edit. |
| ArrowDown, ArrowUp | In the editor of a choice cell, give the next or the previous choice. |

With a pointer, the first click moves the focus to a cell. A click on the cell that has the focus opens its editor. If the focus leaves the editor, the grid saves a valid value and does not save a value that is not valid.

The editor is a text input for each cell type. Its name is the row label and the column label, for example `Rent, January`. A choice editor tells the choices in the status text.

## Values and reasons

The grid refuses a typed value of the wrong type. The editor stays open, and the status text below the grid gives the reason:

| Column type | A valid value | Reason |
|---|---|---|
| `text` | 500 code points maximum | `Give a text of 500 characters at most.` |
| `number` | A number, for example `12` or `12.5` | `Give a number, for example 12 or 12.5.` |
| `date` | A date that exists, as `YYYY-MM-DD` | `Give a date that exists, as YYYY-MM-DD, for example 2026-12-01.` |
| `choice` | One of the choices of the column | `Give one of these choices: Fixed, Variable.` |

An empty text makes the cell empty. The request then has the value `''`.

A choice is exact text. If a choice has a space at its start or its end, the request has that exact choice. The grid also accepts a typed text that differs from one choice only by the spaces at its start and its end.

A cell is read-only if its column or the cell has `read_only`, if the binding does not have its row key and its column key, or if the grid has no binding. A read-only cell has `aria-readonly`. Enter on it opens no editor, and the status text is `This cell is read-only.`

## Action and receipt

The application binds the action with the `action` property. The binding has these keys:

| Key | Content |
|---|---|
| `tool` | The tool name. |
| `arguments` | Optional. The fixed arguments. A bound argument cannot have the name `row`, `column` or `value`. |
| `title` | The title of the grid, 1 to 120 code points. It names the target of the fixed arguments. |
| `rows` | Maps the key of each row that a person can edit to its label. 200 rows maximum. |
| `columns` | Maps the key of each column that a person can edit to `{ label, type }`. A choice column also has `choices`. 30 columns maximum. |

The grid has no action label, no confirm step and no typed edit, so it refuses a binding with a different key.

A request sends the fixed arguments, a row key and a column key, and the person reads only the title and the labels. Thus the application gives the title of the grid, and the label and the type of each key that a request can send:

- The title shows above the grid. The grid refuses a fill with a `label` that is not the title of the binding. Thus a fill cannot show the name of a different budget on a grid that sends the changes to `B-2027`.
- A person can edit a cell only if the binding has its row key and its column key. Each other row and column is read-only.
- The grid refuses a fill that gives a bound row a different label, or a bound column a different label, type or list of choices. Thus a fill cannot show `Food` on the row that sends the key `rent`.
- A fill can make a bound cell read-only. A fill cannot make a cell editable.

Each saved change is one action. The grid sends a `mu-action` event with the request:

```json
{ "id": "…", "tool": "budget.set_amount", "arguments": { "row": "rent", "column": "jan", "value": 1250, "budget_id": "B-2027" } }
```

- A save of the value that the cell shows sends no action.
- The changed cell shows the marker `Pending` until the receipt comes back. The state of the grid is `pending`.
- One request is pending at a time. A change that a person saves during that time shows `Changed`. It goes in the next request, after the receipt.
- The application calls `grid.receipt({ id, ok, message })`. With `ok` set to `true`, the marker goes away and the cell keeps the new value. With `ok` set to `false`, the cell shows `Not done`, and the status text gives the row, the column and the message. The state of the grid is `error`.
- A person can save the same value again to send the change again. A save of the value from before the change removes the marker and sends no action. While a request of the same cell is pending, such a change waits for the receipt, because the receipt can confirm a different value. The last saved value is the value that stays.
- A new binding removes each change of the old binding.

## New values

The application sends each new value in a new fill, for example a new total after a change. The grid shows the new data and keeps the focus on the same cell. An open editor keeps its text. A cell with a change that has no receipt keeps its value and its marker. The data of the application replaces a value that a receipt confirmed.

A new fill can make a cell read-only while its request is pending. The cell keeps its value and `Pending` until the receipt comes back. If the receipt has `ok` set to `false`, the cell shows `Not done` until the application sends new data, because a person cannot edit the cell. A change with no request does not stay on a cell that is now read-only, and no request has it.

In a thread, the application gives the binding with `bind` and the receipt with `perform`. While a request is pending, the thread keeps the grid. After the receipt, the same element shows the new snapshot.

## Size

A grid of 50 rows and 12 columns has 600 cells. The grid scrolls inside its own area, which has a maximum height of 30rem. The column headers stay at the top of the area and the row headers stay at its start. After a key moves the focus, the grid scrolls so that a fixed header does not cover the focused cell.

## States

| State | Result |
|---|---|
| `default` | A person can edit each cell that is not read-only. |
| `empty` | The grid has no rows. It shows the column headers and `No rows.` |
| `disabled` | The grid has no binding. Each cell is read-only, and the keys still move the focus. |
| `pending` | A request waits for its receipt. Its cell shows `Pending`. |
| `error` | The last receipt of a cell has `ok` set to `false`. The cell shows `Not done`. |
| `refused` | A status notice gives the reason as text. The element keeps no data. |

[examples/tables/budget.html](../../examples/tables/budget.html) shows a synthetic budget with 6 rows, 4 month columns and a total row that the page computes. [tests/browser/data-grid.js](../../tests/browser/data-grid.js) checks each state, each key and each refusal in the four media modes.
