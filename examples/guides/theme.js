// The code of docs/guides/theme.md. The same elements show in the kit theme and in the forest theme.
// theme.css sets the tokens of the forest theme. The elements read the tokens through the shadow root.
import { define } from '../../src/components/index.js';
import { createKit, mount } from '../../src/kit.js';

define();
const AGENT = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };
const kit = createKit({ actor: AGENT });

function parts(prefix) {
  const card = kit.mount('card', { title: `${prefix}: field guide to moss`, date: '2026-12-01', date_label: 'Due' });
  mount('action-button', { label: 'Renew' }, { parent: card, slot: 'actions',
    action: { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } } });
  const field = mount('field', { label: `${prefix} shelf code`, value: 'B-14', error: 'Give a code.' });
  return [card, field];
}

document.getElementById('kit').append(...parts('Kit'));
document.getElementById('forest').append(...parts('Forest'));
