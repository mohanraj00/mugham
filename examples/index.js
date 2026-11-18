// The index of the examples. It shows each example of examples.json in its group, and it filters the list by
// the words that a person types. Each name and each sentence goes into the page as text.
import LIST from './examples.json' with { type: 'json' };

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const groups = document.getElementById('groups');
const filter = document.getElementById('filter');
const count = document.getElementById('count');
const entries = [];

for (const group of LIST.groups) {
  const list = el('ul', { className: 'example-list' });
  const section = el('section', {}, el('h2', { id: `group-${group.id}` }, group.title), list);
  section.setAttribute('aria-labelledby', `group-${group.id}`);
  for (const example of group.examples) {
    const item = el('li', {}, el('h3', {}, el('a', { href: example.path }, example.name)), el('p', {}, example.text));
    if (example.needs) item.append(el('p', {}, el('small', {}, 'Needs its fixture API: ', el('code', {}, example.needs))));
    list.append(item);
    entries.push({ item, section, words: `${example.name} ${example.text} ${group.title}`.toLowerCase() });
  }
  groups.append(section);
}

function apply() {
  const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const entry of entries) {
    entry.item.hidden = !words.every((word) => entry.words.includes(word));
    if (!entry.item.hidden) shown += 1;
  }
  for (const section of groups.children) section.hidden = !entries.some((entry) => entry.section === section && !entry.item.hidden);
  if (shown === 0) count.textContent = 'No example has this word. Remove a word from the filter.';
  else if (shown === entries.length) count.textContent = `${entries.length} examples`;
  else count.textContent = `${shown} of ${entries.length} examples`;
}

filter.addEventListener('input', apply);
apply();
