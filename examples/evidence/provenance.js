// An example page with the authorship and citation slots. The page acts as the application. It gives the
// authorship and the citation of each fill. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit, fill, mount } from '../../src/kit.js';

define();

const fact = (label, value) => fill('fact', { label, value });
const RULE = { title: 'Renewal rule for short loans', summary: 'A short loan can get one renewal of seven days.',
  facts: [fact('Loan type', 'Short loan'), fact('Renewals', '1 of 1')] };
// The page knows the agent that sent the content, so it gives that actor to each component.
const AGENT = { type: 'agent', id: 'agent-rules', name: 'Rules helper' };
const CITATION = { source: 'Synthetic library rules, section 4', locator: 'https://example.org/library/rules#section-4' };

const kit = createKit({ actor: AGENT });

function caption(words) {
  const node = document.createElement('p');
  node.textContent = words;
  return node;
}

// Both slots are filled. The card shows the actor and the source as text. The locator opens after a click.
const filled = kit.mount('card', RULE, { slots: { citation: CITATION } });

// The contract of the card requires the authorship slot. This fill has only a citation, so the card refuses it.
const missing = mount('card', RULE, { slots: { citation: CITATION } });

document.getElementById('main').append(caption('A card with both slots filled:'), filled,
  caption('A card with no authorship slot:'), missing);
