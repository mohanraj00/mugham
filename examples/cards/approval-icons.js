import { define } from '../../src/components/index.js';
import { createKit, mount, onAction } from '../../src/kit.js';

define();

const main = document.getElementById('main');
const kit = createKit({ actor: { type: 'system', id: 'example-service', name: 'Request service' } });
const card = kit.mount('card', {
  title: 'Request 42',
  summary: 'Reserve the meeting room for two hours.',
}, { parent: main });

for (const [icon, label, tool] of [
  ['check', 'Approve request 42', 'request.approve'],
  ['cross', 'Reject request 42', 'request.reject'],
]) {
  mount('action-button', { label, icon, display: 'icon' }, {
    parent: card, slot: 'actions', action: { tool, label, icon, display: 'icon', arguments: { request_id: 42 } },
  });
}

let decided = false;
onAction(main, async (tool) => {
  await new Promise((done) => setTimeout(done, 600));
  if (decided) return { ok: false, message: 'The request already has a decision.' };
  decided = true;
  return { ok: true, reference: 'R-42', message: tool === 'request.approve' ? 'Request 42 is approved.' : 'Request 42 is rejected.' };
});
