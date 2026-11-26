import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-loans', name: 'Loan helper' } });
const editable = { days: 'Loan period in days', price: 'Price range' };
const action = { tool: 'library.update_limits', label: 'Save', title: 'Loan limits', editable };
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [
  fill('range-field', { name: 'days', label: editable.days, minimum: 7, maximum: 28, step: 1, value: 14,
    hint: 'Set the loan period from 7 to 28 days.' }),
  fill('range-field', { name: 'price', label: editable.price, minimum: 0, maximum: 100, step: 5, value: [20, 60],
    hint: 'Set the minimum and maximum price in credits.' }),
] }, { action });

const request = document.createElement('section');
request.setAttribute('aria-label', 'Last request');
request.hidden = true;
const log = document.createElement('pre');
request.append(log);
onAction(form, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the loan limits.' };
});
document.getElementById('main').append(form, request);
