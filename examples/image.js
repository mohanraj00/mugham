// The page sets the policy in code. Each image and each text here is synthetic and neutral.
import { define, MuImage } from '../src/components/index.js';

define();
MuImage.allowedOrigins = [location.origin];

const AUTHOR = { type: 'agent', id: 'agent-plan' };
const PLAN = { url: '/examples/floor-plan.svg', alt: 'Two rooms with a door in the shared wall.',
  caption: 'Synthetic floor plan. Room A and Room B.', width: 480, height: 320 };

function text(tag, words) {
  const node = document.createElement(tag);
  node.textContent = words;
  return node;
}

function image(data) {
  const node = document.createElement('mu-image');
  node.actor = AUTHOR;
  node.fill = { component: 'image', version: '0.1.0', data, slots: { authorship: AUTHOR } };
  return node;
}

const message = text('article', '');
message.setAttribute('aria-label', 'Message from agent-plan');
message.append(text('p', 'Agent: agent-plan'), text('p', 'This plan has two rooms.'), image(PLAN));
const card = document.createElement('mu-card');
card.actor = AUTHOR;
card.fill = { component: 'card', version: '0.1.0', data: { title: 'Synthetic floor plan' }, slots: { authorship: AUTHOR } };
// The card has one page-owned slot, named actions. Page code can place an image there.
const cardImage = image(PLAN);
cardImage.slot = 'actions';
card.append(cardImage);

document.getElementById('main').append(text('h1', 'Images'), message, card,
  text('p', 'This origin is not permitted. The kit refuses the image before a request starts.'),
  image({ ...PLAN, url: 'https://example.org/plan.svg' }));
