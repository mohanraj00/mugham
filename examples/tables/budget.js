// An example page with an editable grid: a synthetic budget with 6 rows, 4 month columns and a total row.
// The page acts as the application. It binds the tool, decides each change and computes the totals.
// The kit computes no formula. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';

define();

const AGENT = { type: 'agent', id: 'agent-budget', name: 'Budget helper' };
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

const node = (component, data) => ({ component, version: '0.1.0', data });

// The application computes each total and sends it as a read-only cell.
function fill() {
  const totals = MONTHS.map((_, month) => budget.reduce((sum, [, , amounts]) => sum + amounts[month], 0));
  return { component: 'data-grid', version: '0.1.0', slots: { authorship: AGENT }, data: {
    label: TITLE,
    columns: MONTHS.map(([key, label]) => node('data-grid-column', { key, label, type: 'number' })),
    rows: [
      ...budget.map(([key, label, amounts]) => node('data-grid-row', { key, label, cells: amounts.map((value) => node('number-cell', { value })) })),
      node('data-grid-row', { key: 'total', label: 'Total', cells: totals.map((value) => node('number-cell', { value, read_only: true })) }),
    ],
  } };
}

function text(tag, words) {
  const element = document.createElement(tag);
  element.textContent = words;
  return element;
}

const grid = document.createElement('mu-data-grid');
grid.actor = AGENT;
// The application binds the tool, and the key, the label and the type of each row and column that a person
// can edit. A fill cannot select a tool or give a different meaning to a key. The Total row is not bound.
grid.action = { tool: 'budget.set_amount', arguments: { budget_id: 'B-2027' }, title: TITLE,
  rows: Object.fromEntries(budget.map(([key, label]) => [key, label])),
  columns: Object.fromEntries(MONTHS.map(([key, label]) => [key, { label, type: 'number' }])) };
grid.fill = fill();

// The application decides. An amount is a number from 0 to 100000. The receipt comes back after the decision.
grid.addEventListener('mu-action', (event) => {
  const { id, arguments: { row, column, value } } = event.detail;
  const line = budget.find(([key]) => key === row);
  const month = MONTHS.findIndex(([key]) => key === column);
  setTimeout(() => {
    if (!line || month < 0 || typeof value !== 'number' || value < 0 || value > 100000) {
      grid.receipt({ id, ok: false, message: 'Give an amount from 0 to 100000.' });
      return;
    }
    line[2][month] = value;
    grid.receipt({ id, ok: true });
    grid.fill = fill();
  }, 150);
});

document.getElementById('main').append(text('h1', 'Budget'),
  text('p', 'Move with the arrow keys. Press Enter or type a number to edit an amount. The application computes the Total row.'), grid);
