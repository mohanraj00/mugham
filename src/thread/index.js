// mu-thread: one thread for people and agents. src/thread/README.md is the contract of the element.
// The thread reads AG-UI 1.0 events only through the reader of src/envelope/. It shows each text as text,
// and each component part only through the element of its catalog contract.
import { createReader } from '../envelope/envelope.js';
import { define as defineComponents } from '../components/index.js';
import { BASE, el, sheet } from '../render/dom.js';

// The element of each catalog contract that a part can show. A contract with no element shows a refusal.
const TAGS = Object.freeze(Object.assign(Object.create(null), {
  text: 'mu-text', button: 'mu-button', field: 'mu-field', stack: 'mu-stack', grid: 'mu-grid', card: 'mu-card',
  'action-button': 'mu-action-button', 'editable-form': 'mu-editable-form', 'card-grid': 'mu-card-grid',
}));
// The components with an action. The application gives the binding of each one.
const ACTIONS = new Set(['action-button', 'editable-form']);
const TYPES = Object.freeze({ human: 'Person', agent: 'Agent', system: 'System' });
const REFUSED_PART = 'Refused: the thread did not show this part. ';
const FAILED = 'The request failed.';
const REFUSED_RECEIPT = 'The thread refused the receipt.';
const MAX_ANNOUNCE = 300;

const CSS = sheet(`
  :host { display: block; font: var(--mu-type-body); color: var(--mu-color-text); }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--mu-space-3); }
  article {
    background: var(--mu-color-surface); border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2);
    padding: var(--mu-space-3); display: flex; flex-direction: column; gap: var(--mu-space-2);
    transition: border-color var(--mu-motion-fast);
  }
  .agent article { border-inline-start: 4px solid var(--mu-color-accent); }
  .system article, .notice article { border-style: dashed; }
  p { margin: 0; }
  .actor, .state { font: var(--mu-type-caption); }
  .name { font-weight: var(--mu-type-weight-strong); }
  .type, .state { color: var(--mu-color-text-muted); }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .error, .refusal, .refused-title, .source, .stream { color: var(--mu-color-danger); overflow-wrap: anywhere; }
  .source, .stream { font: var(--mu-type-caption); margin-block-start: var(--mu-space-2); }
  .live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (forced-colors: active) {
    article { border-color: CanvasText; }
    .type, .state, .error, .refusal, .refused-title, .source, .stream { color: CanvasText; }
  }
`);

const nameOf = (actor) => actor.name ?? actor.id;
const who = (actor) => `${nameOf(actor)}, ${TYPES[actor.type]}`;

// A short text of a message for the live region.
function summary(message) {
  const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join(' ').trim();
  if (text) return text;
  const component = message.parts.find((part) => part.type === 'component');
  if (component) return `a ${component.fill.component}`;
  return message.parts.some((part) => part.type === 'refusal') ? 'a part that the thread refused' : 'a message';
}

function header(name, type) {
  return el('p', { class: 'actor' }, el('span', { class: 'name' }, name), ' ', el('span', { class: 'type' }, type));
}

export class MuThread extends HTMLElement {
  // The application gives the binding of each action part, and the function that sends a request to its API.
  bind = null;
  perform = null;

  #reader = createReader();
  #items = new Map();
  // The notice of each run error, by runId. A message id cannot be a key here, so it cannot hide a notice.
  #notices = new Map();
  #owners = new WeakMap();
  #scheduled = false;
  #state = 'idle';
  #list = el('ol', { 'aria-label': 'Thread', part: 'list' });
  #stream = el('p', { class: 'stream', part: 'stream' });
  #source = el('p', { class: 'source', part: 'source' }, 'The source of events failed.');
  #live = el('div', { class: 'live', role: 'status', 'aria-live': 'polite' });

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [BASE, CSS];
    this.#stream.hidden = true;
    this.#source.hidden = true;
    root.append(this.#list, this.#stream, this.#source, this.#live);
    root.addEventListener('mu-action', (event) => this.#act(event));
  }

  // A custom element cannot set an attribute in its constructor, so the state attribute starts here.
  connectedCallback() {
    this.dataset.state = this.#state;
  }

  get state() {
    return this.#state;
  }

  // A copy of the envelopes, in the order of the thread.
  get messages() {
    return this.#reader.result().messages;
  }

  push(event) {
    this.#reader.push(event);
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#render();
    });
  }

  // Reads each event of an async source in order. The transport is the application's.
  async read(source) {
    this.#set('reading');
    try {
      for await (const event of source) this.push(event);
      this.#set('ended');
    } catch {
      this.#source.hidden = false;
      this.#set('failed');
    }
  }

  #set(state) {
    this.#state = state;
    this.dataset.state = state;
  }

  #render() {
    const { runs, messages, errors } = this.#reader.result();
    const said = [];
    for (const message of messages) this.#show(message, said);
    // A run error that no message shows becomes a system notice.
    for (const run of runs) {
      if (run.state !== 'error' || this.#notices.has(run.runId)) continue;
      if (messages.some((message) => message.runId === run.runId && message.parts?.some((part) => part.type === 'status'))) continue;
      const words = 'Error: ' + run.error.message + (run.error.code ? ` (${run.error.code})` : '');
      const node = el('li', { class: 'notice system', 'data-state': 'error' },
        el('article', { 'aria-label': 'Notice from Thread, System' }, header('Thread', TYPES.system), el('p', { class: 'error' }, words)));
      this.#notices.set(run.runId, node);
      this.#list.append(node);
      said.push('Thread, System: ' + words);
    }
    this.#stream.hidden = errors.length === 0;
    if (errors.length) {
      const count = errors.length === 1 ? '1 event that is' : `${errors.length} events that are`;
      this.#stream.replaceChildren(`The thread ignored ${count} not valid. The first error: ${errors[0]}`);
    }
    // The live region tells what is new. The focus does not move.
    if (said.length) {
      const words = said.join(' ');
      this.#live.replaceChildren(words.length > MAX_ANNOUNCE ? words.slice(0, MAX_ANNOUNCE - 3) + '...' : words);
    }
  }

  // Adds or changes the item of one message. A part that did not change keeps its node, so a pending
  // action stays pending and the focus stays where it is.
  #show(message, said) {
    const json = JSON.stringify(message);
    const old = this.#items.get(message.messageId);
    if (old && old.json === json) return;
    const refused = message.state === 'refused';
    if (!old || old.refused !== refused) {
      const entry = refused ? this.#refusedItem(message) : this.#messageItem(message);
      entry.json = json;
      if (old) old.node.replaceWith(entry.node);
      else this.#list.append(entry.node);
      this.#items.set(message.messageId, entry);
      if (refused) said.push('Refused message.');
      else if (message.state === 'final') said.push(`${who(message.actor)}: ${summary(message)}`);
      else said.push(`${who(message.actor)} started a message.`);
      if (!refused) this.#parts(entry, message, [], said);
      return;
    }
    if (refused) return;
    const before = JSON.parse(old.json);
    old.json = json;
    old.node.dataset.state = message.state;
    if (message.state === 'partial' && !old.partial) {
      old.partial = el('p', { class: 'state', part: 'state' }, 'Partial');
      old.header.after(old.partial);
    }
    if (message.state !== 'partial' && old.partial) {
      old.partial.remove();
      old.partial = null;
    }
    if (before.state === 'partial' && message.state === 'final') said.push(`${who(message.actor)}: ${summary(message)}`);
    this.#parts(old, message, before.parts, said);
  }

  #messageItem(message) {
    const head = header(nameOf(message.actor), TYPES[message.actor.type]);
    const partial = message.state === 'partial' ? el('p', { class: 'state', part: 'state' }, 'Partial') : null;
    const parts = el('div', { class: 'parts' });
    const node = el('li', { class: 'message ' + message.actor.type, 'data-state': message.state },
      el('article', { 'aria-label': 'Message from ' + who(message.actor) }, head, partial, parts));
    return { node, header: head, partial, parts, nodes: [], refused: false };
  }

  #refusedItem(message) {
    const node = el('li', { class: 'message refused', 'data-state': 'refused' },
      el('article', { 'aria-label': 'Refused message' }, el('p', { class: 'refused-title' }, 'Refused message'),
        el('p', { class: 'refusal' }, message.errors[0])));
    return { node, refused: true };
  }

  // Changes only the parts that changed.
  #parts(entry, message, before, said) {
    message.parts.forEach((part, index) => {
      const json = JSON.stringify(part);
      if (index < before.length && JSON.stringify(before[index]) === json && entry.nodes[index]) return;
      const node = this.#part(part, message);
      // A refusal that replaces a part is new for the person, so the live region tells it.
      if (entry.nodes[index] && part.type === 'refusal') said.push(`The thread refused a part of the message from ${who(message.actor)}.`);
      if (entry.nodes[index]) entry.nodes[index].replaceWith(node);
      else entry.parts.append(node);
      entry.nodes[index] = node;
      if (part.type === 'status' && index >= before.length) said.push(`Error in the message from ${who(message.actor)}: ${part.text}`);
    });
    for (const node of entry.nodes.splice(message.parts.length)) node.remove();
  }

  #part(part, message) {
    if (part.type === 'text') return el('p', { class: 'text' }, part.text);
    if (part.type === 'status') return el('p', { class: 'status error' }, 'Error: ' + part.text + (part.code ? ` (${part.code})` : ''));
    if (part.type === 'refusal') {
      const more = part.errors.length > 1 ? ` (${part.errors.length - 1} more)` : '';
      return el('p', { class: 'refusal' }, REFUSED_PART + part.errors[0] + more);
    }
    if (part.type === 'component') return this.#component(part.fill, message);
    return el('p', { class: 'fallback' }, part.text);
  }

  // The element of the component validates the fill again. The application gives the binding of an action.
  #component(fill, message) {
    const tag = TAGS[fill.component];
    if (!tag) return el('p', { class: 'refusal' }, REFUSED_PART + `${fill.component}: the kit has no element for this component`);
    const node = document.createElement(tag);
    if (ACTIONS.has(fill.component) && typeof this.bind === 'function') {
      const binding = this.bind(structuredClone(fill), structuredClone(message));
      if (binding !== undefined && binding !== null) {
        try {
          node.action = binding;
        } catch (error) {
          return el('p', { class: 'refusal' }, REFUSED_PART + String(error.message));
        }
      }
    }
    node.fill = fill;
    this.#owners.set(node, message.messageId);
    return node;
  }

  // An action goes to perform. The element shows pending until the receipt comes back.
  async #act(event) {
    const element = event.target;
    const request = event.detail;
    if (typeof this.perform !== 'function' || !this.#owners.has(element)) return;
    event.stopPropagation();
    const messageId = this.#owners.get(element);
    const message = this.messages.find((item) => item.messageId === messageId);
    let receipt;
    try {
      receipt = await this.perform(request, message);
    } catch {
      element.receipt({ id: request.id, ok: false, message: FAILED });
      return;
    }
    const value = receipt !== null && typeof receipt === 'object' && !Array.isArray(receipt) ? { ...receipt, id: request.id } : null;
    if (!element.receipt(value) && element.action.state === 'pending') {
      element.receipt({ id: request.id, ok: false, message: REFUSED_RECEIPT });
    }
  }
}

export function define(registry = customElements) {
  defineComponents(registry);
  if (!registry.get('mu-thread')) registry.define('mu-thread', MuThread);
}
