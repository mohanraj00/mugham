// An example page with a source excerpt in a message. The page acts as the application. It knows the actor of the
// message and gives it to each component. The document and all other data are synthetic and neutral.
import { define } from '../src/components/index.js';

define();

const AGENT = { type: 'agent', id: 'agent-reader' };
const SOURCE = { source: 'Synthetic harbor guide, section 2', locator: 'https://example.org/guides/harbor#section-2' };
const PASSAGE = 'Small boats can moor at the east pier from April to October. The pier closes at dusk.';

function text(tag, words) {
  const node = document.createElement(tag);
  node.textContent = words;
  return node;
}

function excerpt(data, slots = { citation: SOURCE }) {
  const node = document.createElement('mu-excerpt');
  node.actor = AGENT;
  node.fill = { component: 'excerpt', version: '0.1.0', data, slots: { authorship: AGENT, ...slots } };
  return node;
}

// A message of the agent. The value of the agent shows next to the excerpt, so that a person can compare them.
function message(words, ...parts) {
  const node = document.createElement('article');
  node.setAttribute('aria-label', `Message from ${AGENT.id}`);
  node.append(text('p', `Agent: ${AGENT.id}`), text('p', words), ...parts);
  return node;
}

document.getElementById('main').append(
  message('Mooring season: April to October.', excerpt({ passage: PASSAGE, span_start: 43, span_end: 59 })),
  text('p', 'An excerpt with a span that goes past the end of the passage (the kit refuses it):'),
  excerpt({ passage: PASSAGE, span_start: 61, span_end: 120 }),
);
