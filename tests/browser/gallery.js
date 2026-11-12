// The fixture page of the README screenshots. Each section shows one component in one state.
// All data is synthetic and neutral. tools/screenshots.mjs takes one image of each section.
import { define } from '../../src/components/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });
const fact = (label, value) => fill('fact', { label, value });
const field = (name, label, value, extra = {}) => fill('field', { name, label, value, ...extra });
const main = document.getElementById('main');

function make(tag, value, ...children) {
  const node = document.createElement(tag);
  node.fill = value;
  node.append(...children);
  return node;
}

function section(id, ...children) {
  const node = document.createElement('section');
  node.id = id;
  node.append(...children);
  main.append(node);
  return node;
}

const text = (value, variant) => make('mu-text', fill('text', variant ? { text: value, variant } : { text: value }));
const LOAN = { title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01',
  date_label: 'Due', facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')] };

section('text', make('mu-stack', fill('stack', { label: 'Text variants', gap: 'small' }),
  text('Field guide to moss', 'strong'), text('Due on 1 December 2026.'),
  text('Renewals: 1 of 3', 'caption'), text('<b>This markup shows as text.</b>')));

section('button', make('mu-stack', fill('stack', { label: 'Buttons', direction: 'row', gap: 'small' }),
  make('mu-button', fill('button', { label: 'Renew' })),
  make('mu-button', fill('button', { label: 'Later', emphasis: 'secondary' })),
  make('mu-button', fill('button', { label: 'Return', disabled: true }))));

section('field', make('mu-stack', fill('stack', { label: 'Fields', gap: 'medium' }),
  make('mu-field', field('shelf', 'Shelf code', 'B-14', { hint: 'A letter and a number.' })),
  make('mu-field', field('branch', 'Branch', '', { error: 'Give a branch name.' })),
  make('mu-field', field('reader', 'Reader', 'R-2001', { disabled: true }))));

section('stack', make('mu-stack', fill('stack', { label: 'Loan details', gap: 'small' }),
  text('Field guide to moss', 'strong'), text('Due on 1 December 2026.'), text('Shelf B-14', 'caption')));

section('grid', make('mu-grid', fill('grid', { label: 'Reading list', min_column: 'narrow' }),
  text('Rivers and deltas'), text('A short history of maps'), text('Weather at sea'),
  text('Birds of the coast'), text('Stone walls'), text('Night sky')));

section('card', make('mu-card', fill('card', LOAN)));

// Each action button shows one state. The page gives the receipts directly, as an application does.
const STATES = ['default', 'pending', 'done', 'error'];
const buttons = STATES.map(() => {
  const node = document.createElement('mu-action-button');
  node.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
  node.fill = fill('action-button', { label: 'Renew' });
  return node;
});
for (const [index, state] of STATES.entries()) section('action-button-' + state, buttons[index]);

const forms = ['default', 'pending', 'done'].map((state) => {
  const node = document.createElement('mu-editable-form');
  node.action = { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' },
    editable: { shelf: 'Shelf code', note: 'Note' } };
  node.fill = fill('editable-form', { title: 'Change a loan', submit_label: 'Save', fields: [
    field('shelf', 'Shelf code', 'B-14', { hint: 'A letter and a number.' }), field('note', 'Note', 'Keep at the desk.')] });
  section('editable-form-' + state, node);
  return node;
});

section('card-grid', make('mu-card-grid', fill('card-grid', { label: 'Current loans', cards: [
  fill('card', { title: 'Rivers and deltas', date: '2026-12-03', date_label: 'Due', facts: [fact('Shelf', 'C-02')] }),
  fill('card', { title: 'A short history of maps', date: '2026-12-09', date_label: 'Due', facts: [fact('Shelf', 'A-31')] }),
  fill('card', { title: 'Weather at sea', date: '2026-12-15', date_label: 'Due', facts: [fact('Shelf', 'D-07')] }),
] })));

// Start the actions after the elements render, then give the receipts.
const requests = [];
document.addEventListener('mu-action', (event) => requests.push([event.target, event.detail.id]));
await new Promise(requestAnimationFrame);
buttons[1].send();
buttons[2].send();
buttons[3].send();
forms[1].shadowRoot.querySelector('form').requestSubmit();
forms[2].shadowRoot.querySelector('form').requestSubmit();
const id = (node) => requests.find(([target]) => target === node)[1];
buttons[2].receipt({ id: id(buttons[2]), ok: true, message: 'The service accepted the request.' });
buttons[3].receipt({ id: id(buttons[3]), ok: false, message: 'The loan has no renewals left.' });
forms[2].receipt({ id: id(forms[2]), ok: true, message: 'The service saved the loan.' });

window.muGallery = [...main.querySelectorAll('section')].map((node) => ({ id: node.id, state: node.firstElementChild?.dataset.state || '' }));
