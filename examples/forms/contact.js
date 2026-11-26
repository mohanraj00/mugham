import { MuElement, define, register } from '../../src/components/index.js';
import { mount, onAction } from '../../src/kit.js';
import { EDGE, el, sheet } from '../../src/render/dom.js';
import CONTACT_CARD from './contact-card.json' with { type: 'json' };

const CSS = sheet(`
  :host { display: block; }
  article {
    display: grid; gap: var(--mu-space-3); padding: var(--mu-space-4);
    background: var(--mu-color-surface); color: var(--mu-color-text); font: var(--mu-type-body);
    border: 1px solid ${EDGE}; border-radius: var(--mu-radius-2);
  }
  h2 { margin: 0; font: var(--mu-type-heading-2); overflow-wrap: anywhere; }
  @media (forced-colors: active) { article { border-color: CanvasText; } }
`);

class ContactCard extends MuElement {
  static component = 'contact-card';
  static styles = [CSS];

  render(data) {
    const name = mount('field', { label: 'Contact name', value: data.contact_name ?? '' });
    const method = mount('choice-field', { label: 'Contact method', value: data.method, choices: CONTACT_CARD.data.method.values });
    const save = mount('action-button', { label: 'Save contact' });
    const refreshAction = () => {
      if (save.action.state === 'pending') return;
      const args = { contact_name: name.value, method: method.value };
      save.action = { tool: 'contacts.save', label: 'Save contact', arguments: args };
    };
    refreshAction();
    const card = el('article', { 'aria-label': data.title }, el('h2', {}, data.title), name, method, save);
    card.addEventListener('mu-edit', refreshAction);
    return [card];
  }
}

define();
register(CONTACT_CARD, ContactCard);

const main = document.getElementById('main');
mount('contact-card', { title: 'Sample contact', contact_name: 'Contact A1', method: 'Email' }, { parent: main });
const log = el('pre');
const request = el('section', { 'aria-label': 'Last request' }, log);
request.hidden = true;

onAction(main, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the contact.' };
});
main.append(request);
