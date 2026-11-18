// The frame of each example page: a header with a link back to the index, the group, the name, and the
// previous and next example. The list in examples.json is the one source of the order and the names.
import LIST from './examples.json' with { type: 'json' };

const ROOT = new URL('.', import.meta.url);

// Each example with the title of its group, in the order of the index.
export const EXAMPLES = LIST.groups.flatMap((group) => group.examples.map((example) => ({ ...example, group: group.title })));

// The path of a page below examples/, as examples.json gives it. A folder path has no index.html.
export function pathOf(url) {
  const { pathname } = new URL(url);
  return pathname.startsWith(ROOT.pathname) ? pathname.slice(ROOT.pathname.length).replace(/(^|\/)index\.html$/, '$1') : '';
}

function link(text, path, rel) {
  const node = document.createElement('a');
  node.href = new URL(path, ROOT).href;
  node.textContent = text;
  if (rel) node.rel = rel;
  return node;
}

// An example with a fixture API shows its data only on the server of that API. A link to such an example from
// a page with a different server tells this, and the page of the example tells how to start the API.
export const NEEDS = ' (needs its fixture API)';
const label = (word, example, here) => `${word}: ${example.name}${example.needs && example.needs !== here.needs ? NEEDS : ''}`;

function need(example) {
  const note = document.createElement('p');
  note.className = 'examples-need';
  const command = document.createElement('code');
  command.textContent = example.needs;
  note.append('This example reads a fixture API. If the page shows no data, run ', command, '. Then open the address that the command gives.');
  return note;
}

export function frame(url = location.href) {
  const index = EXAMPLES.findIndex((example) => example.path === pathOf(url));
  const header = document.createElement('header');
  header.className = 'examples-frame';
  const where = document.createElement('p');
  where.append(link('All examples', 'index.html'));
  if (index >= 0) where.append(` / ${EXAMPLES[index].group} / ${EXAMPLES[index].name}`);
  header.append(where);
  if (index >= 0) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Previous and next example');
    if (index > 0) nav.append(link(label('Previous', EXAMPLES[index - 1], EXAMPLES[index]), EXAMPLES[index - 1].path, 'prev'));
    if (index < EXAMPLES.length - 1) nav.append(link(label('Next', EXAMPLES[index + 1], EXAMPLES[index]), EXAMPLES[index + 1].path, 'next'));
    header.append(nav);
    if (EXAMPLES[index].needs) header.append(need(EXAMPLES[index]));
  }
  return header;
}

if (typeof document !== 'undefined') document.body.prepend(frame());
