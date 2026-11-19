// An example page with a citation in a message. The page acts as the application. It knows the actor of the
// message and gives it to each component. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();

const AGENT = { type: 'agent', id: 'agent-weather' };
const SOURCE = { source: 'Synthetic weather notes, page 3', locator: 'https://example.org/notes/weather#page-3' };

function text(tag, words) {
  const node = document.createElement(tag);
  node.textContent = words;
  return node;
}

const { mount } = createKit({ actor: AGENT });
const citation = (slots, data = {}) => mount('citation', data, { slots });

// A message of the agent. The page shows the actor of the message, and the citation shows the source of the claim.
function message(words, ...parts) {
  const node = document.createElement('article');
  node.setAttribute('aria-label', `Message from ${AGENT.id}`);
  node.append(text('p', `Agent: ${AGENT.id}`), text('p', words), ...parts);
  return node;
}

document.getElementById('main').append(
  message('Fog is common on the north coast in the early morning.',
    citation({ citation: SOURCE }, { quote: 'Morning fog forms on most days of the cold season.' })),
  text('p', 'A citation with no source:'),
  citation({}),
  text('p', 'A citation with a locator that is not https (the kit refuses it):'),
  citation({ citation: { ...SOURCE, locator: 'http://example.org/notes/weather' } }),
);
