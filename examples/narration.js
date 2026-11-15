// The page is the application. It owns the source fill and the agent identity.
import { define } from '../src/components/index.js';
import { checkNarration } from '../src/narration/check.js';
import example from './narration.json' with { type: 'json' };

define();
const main = document.getElementById('main');
const text = (tag, value) => {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
};

for (const item of example.cases) {
  const section = document.createElement('section');
  const card = document.createElement('mu-card');
  card.actor = example.fill.slots.authorship;
  card.fill = example.fill;
  const result = checkNarration(example.fill, item.narration);
  const detail = result.errors.map((error) => `${error.field}: ${error.message}`).join('; ');
  section.append(text('h2', item.title), card,
    text('p', 'Agent: Narration helper'), text('p', item.narration),
    text('p', `${result.ok ? 'Pass' : 'Fail'}: ${result.checked} claims checked.${detail ? ' ' + detail : ''}`));
  main.append(section);
}
