// The fixture page of the README screenshots. Each section shows one highlight of the kit in one state.
// CONSTITUTION.md allows 16 images maximum: each section gives one light image and one dark image.
// All data is synthetic and neutral. tools/screenshots.mjs takes one image of each section.
import { define } from '../../src/components/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });
// Only the outer fill has slots. The card, the form and the grid require the authorship slot.
const SLOTS = { authorship: { type: 'agent', id: 'agent-check', name: 'Checker' } };
const outer = (component, data) => ({ ...fill(component, data), slots: SLOTS });
const fact = (label, value) => fill('fact', { label, value });
const field = (name, label, value, extra = {}) => fill('field', { name, label, value, ...extra });
const main = document.getElementById('main');

function make(tag, value, ...children) {
  const node = document.createElement(tag);
  node.actor = SLOTS.authorship;
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

const LOAN = { title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01',
  date_label: 'Due', facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')] };

section('card', make('mu-card', outer('card', LOAN)));

// Each action button shows one state. The page gives the receipts directly, as an application does.
const STATES = ['pending', 'done', 'error'];
const buttons = STATES.map(() => {
  const node = document.createElement('mu-action-button');
  node.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
  node.fill = fill('action-button', { label: 'Renew' });
  return node;
});
for (const [index, state] of STATES.entries()) section('action-button-' + state, buttons[index]);

const form = document.createElement('mu-editable-form');
form.actor = SLOTS.authorship;
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Change a loan', arguments: { loan_id: 'L-0001' },
  editable: { shelf: 'Shelf code', note: 'Note' } };
form.fill = outer('editable-form', { title: 'Change a loan', submit_label: 'Save', fields: [
  field('shelf', 'Shelf code', 'B-14', { hint: 'A letter and a number.' }), field('note', 'Note', 'Keep at the desk.')] });
section('editable-form-done', form);

section('card-grid', make('mu-card-grid', outer('card-grid', { label: 'Current loans', cards: [
  fill('card', { title: 'Rivers and deltas', date: '2026-12-03', date_label: 'Due', facts: [fact('Shelf', 'C-02')] }),
  fill('card', { title: 'A short history of maps', date: '2026-12-09', date_label: 'Due', facts: [fact('Shelf', 'A-31')] }),
  fill('card', { title: 'Weather at sea', date: '2026-12-15', date_label: 'Due', facts: [fact('Shelf', 'D-07')] }),
] })));

// Start the actions after the elements render, then give the receipts.
const requests = [];
document.addEventListener('mu-action', (event) => requests.push([event.target, event.detail.id]));
await new Promise(requestAnimationFrame);
for (const button of buttons) button.send();
form.shadowRoot.querySelector('form').requestSubmit();
const id = (node) => requests.find(([target]) => target === node)[1];
buttons[1].receipt({ id: id(buttons[1]), ok: true, message: 'The service accepted the request.' });
buttons[2].receipt({ id: id(buttons[2]), ok: false, message: 'The loan has no renewals left.' });
form.receipt({ id: id(form), ok: true, message: 'The service saved the loan.' });

window.muGallery = [...main.querySelectorAll('section')].map((node) => ({ id: node.id, state: node.firstElementChild?.dataset.state || '' }));
