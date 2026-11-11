// An example page with the catalog components: a synthetic library loan with a Renew action.
// The page acts as the application. A synthetic service gives each receipt after a short delay.
import { define } from '../src/components/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });
const fact = (label, value) => fill('fact', { label, value });
const loan = (title, date, shelf) => fill('card', { title, date, date_label: 'Due', facts: [fact('Shelf', shelf), fact('Renewals', '0 of 3')] });

function make(tag, value) {
  const node = document.createElement(tag);
  node.fill = value;
  return node;
}

// The synthetic service. It decides, and the page shows its receipt.
function service(event) {
  const { id, tool, arguments: args } = event.detail;
  setTimeout(() => {
    const ok = tool === 'library.renew' || Boolean(args.shelf);
    event.target.receipt({ id, ok, message: ok ? 'The service accepted the request.' : 'Give a shelf code.' });
  }, 600);
}

const card = make('mu-card', fill('card', {
  title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01', date_label: 'Due',
  facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')],
}));
const renew = make('mu-action-button', fill('action-button', { label: 'Renew' }));
renew.slot = 'actions';
renew.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
card.append(renew);

const grid = make('mu-card-grid', fill('card-grid', { label: 'Current loans', cards: [
  loan('Rivers and deltas', '2026-12-03', 'C-02'),
  loan('A short history of maps', '2026-12-09', 'A-31'),
  loan('Weather at sea', '2026-12-15', 'D-07'),
] }));

const form = make('mu-editable-form', fill('editable-form', { title: 'Change a loan', submit_label: 'Save', fields: [
  fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.' }),
  fill('field', { name: 'note', label: 'Note', value: '' }),
] }));
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' }, editable: { shelf: 'Shelf code', note: 'Note' } };

document.addEventListener('mu-action', service);
document.getElementById('main').append(card, grid, form);
