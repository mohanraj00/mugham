// The docs panel of an example page. It shows the docs of each component that the page uses, next to the live
// example. The keys, the types and the states come from the contract of the registry, so the panel agrees
// with the contract. examples/docs.json gives the events, the actions, a sample fill and the links.
// Each text goes into the page as text.
import DOCS from './docs.json' with { type: 'json' };
import { CONTRACTS, registeredTag } from '../src/render/registry.js';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const code = (text) => el('code', {}, text);
// A doc link goes to the page of the repository that shows the Markdown file. The local servers do not show Markdown.
const link = (target) => el('a', { href: new URL(target.path, DOCS.repository).href }, target.text);
const targets = (field) => (own(field, 'names') ? field.names : [field.name]);

// The type of a field as text, with its limits.
export function typeText(field) {
  switch (field.type) {
    case 'text': return own(field, 'min_length') ? `Text of ${field.min_length} to ${field.max_length} characters`
      : `Text of ${field.max_length} characters maximum`;
    case 'number': case 'integer': {
      const name = field.type === 'integer' ? 'An integer' : 'A number';
      if (own(field, 'minimum') && own(field, 'maximum')) return `${name} from ${field.minimum} to ${field.maximum}`;
      if (own(field, 'minimum')) return `${name}, ${field.minimum} or more`;
      return own(field, 'maximum') ? `${name}, ${field.maximum} or less` : name;
    }
    case 'boolean': return 'true or false';
    case 'date': return 'A date as YYYY-MM-DD';
    case 'enum': return `One of: ${field.values.join(', ')}`;
    case 'number-or-pair': return 'A number or a pair of numbers.';
    case 'list': return `A list of ${field.max_items} items maximum. Each item: ${typeText(field.items)}`;
    case 'component': return `A fill of ${targets(field).join(' or ')}`;
    default: return field.type;
  }
}

// The keys of a contract as a list: the key, its label, necessary or optional, and its type.
function keys(contract) {
  const list = el('dl', { className: 'docs-keys' });
  for (const [key, field] of Object.entries(contract.data)) {
    const term = el('dt', {}, code(key), ` ${field.label}, ${field.required ? 'necessary' : 'optional'}`);
    term.dataset.key = key;
    list.append(term, el('dd', {}, typeText(field) + (field.editable ? '. A person can edit it.' : '.')));
  }
  return Object.keys(contract.data).length ? list : el('p', {}, 'The contract has no data key.');
}

// The contracts that the fields of a contract name, and the contracts that those name. shown has each name that
// has its own part in the panel.
function nested(contract, shown, seen = new Set()) {
  const parts = [];
  for (const field of Object.values(contract.data)) {
    const item = field.type === 'list' ? field.items : field;
    if (item.type !== 'component') continue;
    for (const name of targets(item)) {
      if (shown.has(name) || seen.has(name) || !CONTRACTS[name]) continue;
      seen.add(name);
      parts.push(el('details', { className: 'docs-nested' }, el('summary', {}, 'Keys of ', code(name)), keys(CONTRACTS[name])),
        ...nested(CONTRACTS[name], shown, seen));
    }
  }
  return parts;
}

function events(docs) {
  const list = el('dl', { className: 'docs-events' });
  for (const [name, text] of docs.events) list.append(el('dt', {}, code(name)), el('dd', {}, text));
  return list;
}

// The content of the part of one component. The panel makes it when a person opens the part.
function content(name, shown) {
  const thread = name === 'thread';
  const contract = thread ? undefined : CONTRACTS[name];
  const docs = thread ? DOCS.thread : (own(DOCS.components, name) ? DOCS.components[name] : DOCS.application);
  if (!thread && !contract) {
    const missing = el('p', {}, `No contract has the name ${name}.`);
    missing.dataset.missing = name;
    return [missing];
  }
  const parts = [];
  if (contract) {
    parts.push(el('p', {}, contract.description), el('h4', {}, 'Fill keys'), keys(contract), ...nested(contract, shown));
    parts.push(el('p', {}, `States: ${contract.states.join(', ')}. `,
      own(contract, 'slots') ? `Slots: ${Object.entries(contract.slots).map(([slot, rule]) => `${slot} (${rule.required ? 'necessary' : 'optional'})`).join(', ')}.` : 'The contract has no slot.'));
  } else {
    parts.push(el('p', {}, 'The thread has no catalog contract, because a model does not fill it. A model sends events, and the thread validates each component part.'));
  }
  parts.push(el('h4', {}, 'Events'), events(docs), el('h4', {}, 'Actions'), el('p', {}, docs.actions));
  if (docs.sample) parts.push(el('h4', {}, 'Sample fill'), el('pre', {}, code(JSON.stringify(docs.sample, null, 2))));
  if (docs.howto) {
    parts.push(el('h4', {}, 'How to'), el('ol', { className: 'docs-howto' },
      ...docs.howto.map(([title, text]) => el('li', {}, el('strong', {}, title + '. '), text))));
  }
  parts.push(el('p', { className: 'docs-links' }, 'Full doc: ', link(docs.doc), '. Guide: ', link(DOCS.guides[docs.guide]), '.'));
  return parts;
}

// The docs panel of one example of examples.json.
export function panel(example) {
  const shown = new Set(example.components);
  const aside = el('aside', { className: 'example-docs' }, el('h2', { id: 'example-docs-title' }, 'Docs of this example'),
    el('p', {}, 'Open a part to see how to use the component. The keys come from the contract of the component.'));
  aside.setAttribute('aria-labelledby', 'example-docs-title');
  for (const name of example.components) {
    const tag = name === 'thread' ? DOCS.thread.element : (own(DOCS.components, name) ? DOCS.components[name].element : `mu-app-${name}`);
    const part = el('details', {}, el('summary', {}, code(tag), name === 'thread' ? '' : ` ${name}`));
    part.dataset.component = name;
    part.addEventListener('toggle', () => {
      if (!part.open || part.dataset.ready) return;
      // An application component is in the registry only after the page registers it.
      if (!own(DOCS.components, name) && name !== 'thread' && registeredTag(name)) part.querySelector('summary code').textContent = registeredTag(name);
      part.append(...content(name, shown));
      part.dataset.ready = 'true';
    });
    aside.append(part);
  }
  return aside;
}
