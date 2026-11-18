// An example page with each input type of a form: text, long text, a number, a date and a choice.
// The number and the date are typed fields, so a person gives an edit type for each change.
// The page acts as the application. A synthetic service gives each receipt after a short delay.
import { define } from '../../src/components/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });
// The page acts as the application, so it gives the authorship of the outer fill.
const AUTHOR = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };

const form = document.createElement('mu-editable-form');
form.actor = AUTHOR;
form.fill = { ...fill('editable-form', { title: 'Loan details', submit_label: 'Save', fields: [
  fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.' }),
  fill('long-text-field', { name: 'note', label: 'Note', value: 'Keep dry.', hint: 'Two lines at most.' }),
  fill('number-field', { name: 'copies', label: 'Copies', value: 3, minimum: 1, maximum: 12, hint: 'From 1 to 12.', typed: true }),
  fill('date-field', { name: 'due', label: 'Due date', value: '2026-12-01', earliest: '2026-11-01', latest: '2027-02-28', typed: true }),
  fill('choice-field', { name: 'branch', label: 'Branch', value: 'North', choices: ['North', 'South', 'Harbor'] }),
] }), slots: { authorship: AUTHOR } };
// The application gives the tool, the labels, the typed names and the person who edits.
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', arguments: { loan_id: 'L-0001' },
  editable: { shelf: 'Shelf code', note: 'Note', copies: 'Copies', due: 'Due date', branch: 'Branch' },
  typed: ['copies', 'due'], editor: { type: 'human', id: 'person-ana' } };

// The synthetic service. It decides, and the page shows its receipt and the edits of the request.
const log = document.createElement('pre');
log.setAttribute('aria-label', 'Last request');
form.addEventListener('mu-action', (event) => {
  const { id, arguments: args, edits } = event.detail;
  log.textContent = JSON.stringify({ arguments: args, edits }, null, 2);
  setTimeout(() => form.receipt({ id, ok: true, message: 'The service accepted the request.' }), 600);
});
document.getElementById('main').append(form, log);
