import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-library', name: 'Library helper' } });
const choices = Array.from({ length: 40 }, (_, index) => 'Branch ' + String(index + 1).padStart(2, '0'));
const editable = { branch: 'Pickup branch' };
const action = { tool: 'library.set_pickup_branch', label: 'Save', title: 'Pickup details', editable, icon: 'check', display: 'icon' };
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [
  fill('select-field', { name: 'branch', label: editable.branch, choices, value: choices[0], hint: 'Choose a branch for pickup.' }),
] }, { action });

const request = document.createElement('section');
request.setAttribute('aria-label', 'Last request');
request.hidden = true;
const log = document.createElement('pre');
request.append(log);
onAction(form, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the pickup branch.' };
});
document.getElementById('main').append(form, request);
