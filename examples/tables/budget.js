// An example page with an editable grid: a synthetic budget with 6 rows, 4 month columns and a total row.
// The page acts as the application. It binds the tool, decides each change and computes the totals.
// The kit computes no formula. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const AGENT = { type: 'agent', id: 'agent-budget', name: 'Budget helper' };
const kit = createKit({ actor: AGENT });
// The title of the budget that the bound arguments select. The application gives it.
const TITLE = 'Synthetic budget 2027';
const MONTHS = [['jan', 'January'], ['feb', 'February'], ['mar', 'March'], ['apr', 'April']];
// The data of the application. A row has one amount for each month.
const budget = [
  ['rent', 'Rent', [900, 900, 900, 900]],
  ['food', 'Food', [410, 380, 420, 400]],
  ['travel', 'Travel', [60, 45, 80, 60]],
  ['phone', 'Phone', [25, 25, 25, 25]],
  ['power', 'Power', [130, 120, 95, 70]],
  ['other', 'Other', [50, 0, 75, 40]],
];

// The application computes each total and sends it as a read-only cell.
function gridData() {
  const totals = MONTHS.map((_, month) => budget.reduce((sum, [, , amounts]) => sum + amounts[month], 0));
  return {
    label: TITLE,
    columns: MONTHS.map(([key, label]) => fill('data-grid-column', { key, label, type: 'number' })),
    rows: [
      ...budget.map(([key, label, amounts]) => fill('data-grid-row', { key, label, cells: amounts.map((value) => fill('number-cell', { value })) })),
      fill('data-grid-row', { key: 'total', label: 'Total', cells: totals.map((value) => fill('number-cell', { value, read_only: true })) }),
    ],
  };
}

function text(tag, words) {
  const element = document.createElement(tag);
  element.textContent = words;
  return element;
}

// The application binds the tool, and the key, the label and the type of each row and column that a person
// can edit. A fill cannot select a tool or give a different meaning to a key. The Total row is not bound.
const action = { tool: 'budget.set_amount', arguments: { budget_id: 'B-2027' }, title: TITLE,
  rows: Object.fromEntries(budget.map(([key, label]) => [key, label])),
  columns: Object.fromEntries(MONTHS.map(([key, label]) => [key, { label, type: 'number' }])) };
const grid = kit.mount('data-grid', gridData(), { action });

// The application decides. An amount is a number from 0 to 100000. The receipt comes back after the decision.
onAction(grid, async (tool, { row, column, value }) => {
  const line = budget.find(([key]) => key === row);
  const month = MONTHS.findIndex(([key]) => key === column);
  await new Promise((done) => setTimeout(done, 150));
  if (!line || month < 0 || typeof value !== 'number' || value < 0 || value > 100000) {
    return { ok: false, message: 'Give an amount from 0 to 100000.' };
  }
  line[2][month] = value;
  setTimeout(() => { grid.fill = kit.outer('data-grid', gridData()); }, 0);
  return { ok: true };
});

document.getElementById('main').append(text('h1', 'Budget'),
  text('p', 'Move with the arrow keys. Press Enter or type a number to edit an amount. The application computes the Total row.'), grid);
