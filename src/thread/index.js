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
const SOURCE_FAILED = 'The source of events failed.';
// The live region gives a short text of each message, so one long message cannot remove a later notice.
const MAX_SUMMARY = 120;
const MAX_UPDATES = 4;
const MAX_NOTICES = 8;

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

const cut = (text, max) => (text.length > max ? text.slice(0, max - 3) + '...' : text);

// The JSON text of a value with its keys in order. Two fills with the same data give the same text.
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}

// A short text of a message for the live region. A refusal has its own announcement.
function summary(message) {
  const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join(' ').trim();
  if (text) return cut(text, MAX_SUMMARY);
  const component = message.parts.find((part) => part.type === 'component');
  return component ? `the component ${component.fill.component}` : 'a message';
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
  // The elements with a pending action or an open confirm step that a new snapshot waits for.
  #waiting = new Set();
  // The texts for the live region at the next update, and the count of stream errors that it told.
  #said = { updates: [], notices: [] };
  #errors = 0;
  #owners = new WeakMap();
  // The stable text of the binding of each action element.
  #bindings = new WeakMap();
  #scheduled = false;
  #state = 'idle';
  #list = el('ol', { 'aria-label': 'Thread', part: 'list' });
  #stream = el('p', { class: 'stream', part: 'stream' });
  #source = el('p', { class: 'source', part: 'source' }, SOURCE_FAILED);
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
    this.#schedule();
  }

  // The thread updates the page one time for each task, not one time for each event.
  #schedule() {
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
      this.#said.notices.push(SOURCE_FAILED);
      this.#schedule();
    }
  }

  #set(state) {
    this.#state = state;
    this.dataset.state = state;
  }

  #render() {
    const { runs, messages, errors } = this.#reader.result();
    const said = this.#said;
    this.#said = { updates: [], notices: [] };
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
      said.notices.push('Thread, System: ' + cut(words, MAX_SUMMARY));
    }
    this.#stream.hidden = errors.length === 0;
    if (errors.length) {
      const count = errors.length === 1 ? '1 event that is' : `${errors.length} events that are`;
      const words = `The thread ignored ${count} not valid.`;
      this.#stream.replaceChildren(`${words} The first error: ${errors[0]}`);
      // The live region tells the count only when it changes.
      if (errors.length !== this.#errors) said.notices.push(words);
      this.#errors = errors.length;
    }
    // The live region tells what is new. The focus does not move.
    // Refusals and errors come first, and the count of each list has a limit. Thus many messages in one
    // update cannot remove a refusal or an error.
    const { updates, notices } = said;
    const words = notices.slice(0, MAX_NOTICES);
    if (notices.length > MAX_NOTICES) words.push(`${notices.length - MAX_NOTICES} more refusals or errors.`);
    if (updates.length > MAX_UPDATES) words.push(`${updates.length - MAX_UPDATES} earlier messages.`);
    words.push(...updates.slice(-MAX_UPDATES));
    if (words.length) this.#live.replaceChildren(words.join(' '));
  }

  // Adds or changes the item of one message. A part that did not change keeps its node, so a pending
  // action stays pending and the focus stays where it is.
  #show(message, said) {
    const json = stable(message);
    const old = this.#items.get(message.messageId);
    if (old && old.json === json) return;
    const refused = message.state === 'refused';
    if (!old || old.refused !== refused) {
      const entry = refused ? this.#refusedItem(message) : this.#messageItem(message);
      entry.json = json;
      if (old) old.node.replaceWith(entry.node);
      else this.#list.append(entry.node);
      this.#items.set(message.messageId, entry);
      if (refused) said.notices.push('Refused message.');
      else if (message.state === 'final') said.updates.push(`${who(message.actor)}: ${summary(message)}`);
      else said.updates.push(`${who(message.actor)} started a message.`);
      if (!refused) this.#parts(entry, message, said);
      return;
    }
    if (refused) return;
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
    if (old.state === 'partial' && message.state === 'final') said.updates.push(`${who(message.actor)}: ${summary(message)}`);
    old.state = message.state;
    this.#parts(old, message, said);
  }

  #messageItem(message) {
    const head = header(nameOf(message.actor), TYPES[message.actor.type]);
    const partial = message.state === 'partial' ? el('p', { class: 'state', part: 'state' }, 'Partial') : null;
    const parts = el('div', { class: 'parts' });
    const node = el('li', { class: 'message ' + message.actor.type, 'data-state': message.state },
      el('article', { 'aria-label': 'Message from ' + who(message.actor) }, head, partial, parts));
    // nodes holds the node of each part. keys holds the stable text of the part that the node shows.
    return { node, header: head, partial, parts, nodes: [], keys: [], state: message.state, refused: false };
  }

  #refusedItem(message) {
    const node = el('li', { class: 'message refused', 'data-state': 'refused' },
      el('article', { 'aria-label': 'Refused message' }, el('p', { class: 'refused-title' }, 'Refused message'),
        el('p', { class: 'refusal' }, message.errors[0])));
    return { node, refused: true };
  }

  // Changes only the parts that changed. The key order of a fill is not a change.
  #parts(entry, message, said) {
    message.parts.forEach((part, index) => {
      const key = stable(part);
      const old = entry.nodes[index];
      if (old && entry.keys[index] === key) return;
      // A pending action stays until its receipt comes back. If not, a new snapshot could give a new
      // element in the default state, and a person could send the request a second time. An open
      // confirm step also stays, because a person decides in it.
      if (old && this.#busy(old)) return this.#wait(entry, old);
      const node = this.#refill(old, part, message) ?? this.#part(part, message);
      if (node === old) {
        // The same element shows the new fill.
      } else if (old) old.replaceWith(node);
      else entry.parts.append(node);
      // A refusal is new for the person, so the live region tells it. An element can also refuse its fill.
      if (part.type === 'refusal' || node.dataset.state === 'refused' || node.classList.contains('refusal')) {
        said.notices.push(`The thread refused a part of the message from ${who(message.actor)}.`);
      }
      if (part.type === 'status' && index >= entry.keys.length) {
        said.notices.push(`Error in the message from ${who(message.actor)}: ${cut(part.text, MAX_SUMMARY)}`);
      }
      entry.nodes[index] = node;
      entry.keys[index] = key;
    });
    for (let index = entry.nodes.length - 1; index >= message.parts.length; index -= 1) {
      if (this.#busy(entry.nodes[index])) {
        this.#wait(entry, entry.nodes[index]);
        break;
      }
      entry.nodes.pop().remove();
      entry.keys.pop();
    }
  }

  #busy(node) {
    return this.#owners.has(node) && (node.dataset.state === 'pending' || node.dataset.state === 'confirm');
  }

  // A new fill of the same action with the same binding goes to the same element. Then the rules of the
  // element apply: a done action button stays done, and a form with new values can save again.
  #refill(old, part, message) {
    if (!old || part.type !== 'component' || !ACTIONS.has(part.fill.component) || old.localName !== TAGS[part.fill.component]) return null;
    if (!this.#bindings.has(old) || this.#bindings.get(old) !== stable(this.#binding(part.fill, message))) return null;
    old.fill = part.fill;
    return old;
  }

  // The binding that the application gives for a fill, or null.
  #binding(fill, message) {
    if (!ACTIONS.has(fill.component) || typeof this.bind !== 'function') return null;
    return this.bind(structuredClone(fill), structuredClone(message)) ?? null;
  }

  // Shows the new part after the receipt. The element changes its state attribute when the receipt comes back.
  #wait(entry, node) {
    // The next update must read this message again.
    entry.json = '';
    if (this.#waiting.has(node)) return;
    const observer = new MutationObserver(() => {
      if (this.#busy(node)) return;
      observer.disconnect();
      this.#waiting.delete(node);
      this.#schedule();
    });
    this.#waiting.add(node);
    observer.observe(node, { attributes: true, attributeFilter: ['data-state'] });
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
    const binding = this.#binding(fill, message);
    if (binding !== null) {
      try {
        node.action = binding;
      } catch (error) {
        return el('p', { class: 'refusal' }, REFUSED_PART + String(error.message));
      }
    }
    this.#bindings.set(node, stable(binding));
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
