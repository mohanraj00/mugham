import { define, MuImage } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();
MuImage.allowedOrigins = [location.origin];

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-plan' } });
mount('image', {
  url: '/examples/media/floor-plan.svg',
  alt: 'Two rooms with a door in the shared wall.',
  width: 480,
  height: 320,
}, { parent: document.getElementById('main') });
