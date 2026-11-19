// The application gives each state. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();

const ACTOR = { type: 'system', id: 'synthetic-checks' };
const { mount } = createKit({ actor: ACTOR });
const main = document.getElementById('main');
function text(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

main.append(text('h1', 'Status'), text('p', 'The application or its service gives each state. The kit shows the state and the text.'));
for (const [state, words] of [
  ['pending', 'Synthetic check A.'],
  ['passed', 'Synthetic check B.'],
  ['failed', 'Synthetic check C.'],
  ['unknown', 'Synthetic check D.'],
  ['complete', 'Synthetic check E.'],
]) {
  if (state === 'complete') main.append(text('p', 'The next value is not a declared state. The kit shows a refusal.'));
  mount('status', { state, text: words }, { parent: main });
}
