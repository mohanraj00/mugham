import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-notices', name: 'Notice helper' } });
const editable = { reminders: 'Send due date reminders', pickup: 'Send pickup notices' };
const action = { tool: 'library.update_notices', label: 'Save', title: 'Member M-001',
  arguments: { member_id: 'M-001' }, editable };
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [
  fill('toggle-field', { name: 'reminders', label: editable.reminders, display: 'switch', value: true,
    hint: 'Send a notice before a loan is due.' }),
  fill('toggle-field', { name: 'pickup', label: editable.pickup, display: 'switch', value: false,
    hint: 'Send a notice when a loan is ready for pickup.' }),
] }, { action });

const request = document.createElement('section');
request.setAttribute('aria-label', 'Last request');
request.hidden = true;
const log = document.createElement('pre');
request.append(log);
onAction(form, async (tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  await new Promise((done) => setTimeout(done, 300));
  return { ok: true, message: 'The service saved the notice settings.' };
});
document.getElementById('main').append(form, request);
