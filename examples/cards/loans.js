// An example page with the catalog components: a synthetic library loan with a Renew action.
// The page acts as the application. A synthetic service gives each receipt after a short delay.
import { define } from '../../src/components/index.js';
import { createKit, fill, mount, onAction } from '../../src/kit.js';

define();

const kit = createKit({ actor: { type: 'agent', id: 'agent-loans', name: 'Loan helper' } });
const fact = (label, value) => fill('fact', { label, value });
const loan = (title, date, shelf) => fill('card', { title, date, date_label: 'Due', collapsible: true, collapsed: true,
  collapsed_summary: `Due: ${date}`, facts: [fact('Shelf', shelf), fact('Renewals', '0 of 3')] });

// The synthetic service. It decides, and the page shows its receipt.
async function service(tool, args) {
  await new Promise((done) => setTimeout(done, 600));
  const ok = tool === 'library.renew' || Boolean(args.shelf);
  return { ok, message: ok ? 'The service accepted the request.' : 'Give a shelf code.' };
}

const card = kit.mount('card', {
  title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01', date_label: 'Due',
  collapsible: true, status: 'On loan', collapsed_summary: 'Due on 2026-12-01. One renewal used.',
  facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')],
});
mount('action-button', { label: 'Renew' }, { parent: card, slot: 'actions',
  action: { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } } });

const grid = kit.mount('card-grid', { label: 'Current loans', collapse_controls: true, cards: [
  loan('Rivers and deltas', '2026-12-03', 'C-02'),
  loan('A short history of maps', '2026-12-09', 'A-31'),
  loan('Weather at sea', '2026-12-15', 'D-07'),
] });

const form = kit.mount('editable-form', { title: 'Change a loan', submit_label: 'Save', fields: [
  fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.' }),
  fill('field', { name: 'note', label: 'Note', value: '' }),
] }, { action: { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' },
  editable: { shelf: 'Shelf code', note: 'Note' } } });

const main = document.getElementById('main');
onAction(main, service);
main.append(card, grid, form);
