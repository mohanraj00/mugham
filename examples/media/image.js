// The page sets the policy in code. Each image and each text here is synthetic and neutral.
import { define, MuImage } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();
MuImage.allowedOrigins = [location.origin];

const AUTHOR = { type: 'agent', id: 'agent-plan' };
const PLAN = { url: '/examples/media/floor-plan.svg', alt: 'Two rooms with a door in the shared wall.',
  caption: 'Synthetic floor plan. Room A and Room B.', width: 480, height: 320 };

function text(tag, words) {
  const node = document.createElement(tag);
  node.textContent = words;
  return node;
}

const { mount } = createKit({ actor: AUTHOR });

const message = text('article', '');
message.setAttribute('aria-label', 'Message from agent-plan');
message.append(text('p', 'Agent: agent-plan'), text('p', 'This plan has two rooms.'), mount('image', PLAN));
const card = mount('card', { title: 'Synthetic floor plan' });
// The card has one page-owned slot, named actions. Page code can place an image there.
mount('image', PLAN, { parent: card, slot: 'actions' });

document.getElementById('main').append(text('h1', 'Images'), message, card,
  text('p', 'This origin is not permitted. The kit refuses the image before a request starts.'),
  mount('image', { ...PLAN, url: 'https://example.org/plan.svg' }));
