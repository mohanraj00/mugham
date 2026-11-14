// The code of docs/guides/theme.md. The same elements show in the kit theme and in the forest theme.
// theme.css sets the tokens of the forest theme. The elements read the tokens through the shadow root.
import { define } from '../../src/components/index.js';

define();
const AGENT = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };

function parts(prefix) {
  const card = document.createElement('mu-card');
  card.actor = AGENT;
  card.fill = { component: 'card', version: '0.1.0', data: { title: `${prefix}: field guide to moss`, date: '2026-12-01', date_label: 'Due' },
    slots: { authorship: AGENT } };
  const renew = document.createElement('mu-action-button');
  renew.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
  renew.fill = { component: 'action-button', version: '0.1.0', data: { label: 'Renew' } };
  renew.slot = 'actions';
  card.append(renew);
  const field = document.createElement('mu-field');
  field.fill = { component: 'field', version: '0.1.0', data: { label: `${prefix} shelf code`, value: 'B-14', error: 'Give a code.' } };
  return [card, field];
}

document.getElementById('kit').append(...parts('Kit'));
document.getElementById('forest').append(...parts('Forest'));
