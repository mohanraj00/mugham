// The first catalog components: card, action button, editable form and card grid.
import { MuElement } from '../primitives/base.js';
import { define as definePrimitives } from '../primitives/index.js';
import { ActionState } from '../actions/action.js';
import { el, sheet } from '../render/dom.js';

const FIELD_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const CARD_CSS = sheet(`
  :host { display: block; }
  article, form {
    background: var(--mu-color-surface); color: var(--mu-color-text); font: var(--mu-type-body);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); padding: var(--mu-space-4);
    display: flex; flex-direction: column; gap: var(--mu-space-2); height: 100%;
  }
  .title { font-weight: var(--mu-type-weight-strong); margin: 0; }
  .muted, dt { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
  dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: var(--mu-space-2) var(--mu-space-3); }
  dd { margin: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--mu-space-2); }
  @media (forced-colors: active) { article, form { border-color: CanvasText; } .muted, dt { color: CanvasText; } }
`);
const ACTION_CSS = sheet(`
  :host { display: inline-flex; flex-direction: column; gap: var(--mu-space-1); }
  button {
    font: var(--mu-type-body); min-height: 2.75rem; min-width: 2.75rem; padding: var(--mu-space-2) var(--mu-space-3);
    border-radius: var(--mu-radius-2); border: 1px solid var(--mu-color-accent);
    background: var(--mu-color-accent); color: var(--mu-color-on-accent); cursor: pointer;
    transition: background-color var(--mu-motion-fast);
  }
  button[aria-disabled="true"] { cursor: not-allowed; opacity: 0.6; }
  .status { font: var(--mu-type-caption); color: var(--mu-color-text-muted); min-height: 1lh; }
  .status.error { color: var(--mu-color-danger); }
  @media (forced-colors: active) {
    button { background: ButtonFace; color: ButtonText; border-color: ButtonText; forced-color-adjust: none; }
    button[aria-disabled="true"] { color: GrayText; border-color: GrayText; opacity: 1; }
    .status, .status.error { color: CanvasText; }
  }
`);

// The text of each state. A pending action never shows as done.
const STATUS = { default: '', disabled: '', pending: 'Pending', done: 'Done', error: 'Not done' };

// Shared code for a component with one action. The application binds the tool with the action property
// and gives the receipt with receipt(). The element sends a mu-action event with the request.
class ActionElement extends MuElement {
  #action = new ActionState();
  #status = null;
  #control = null;

  // The state of the action can only be read. Only bind(), start() and receipt() change it.
  get action() {
    return this.#action;
  }

  set action(binding) {
    const errors = this.#action.bind(binding);
    if (errors.length) throw new TypeError('action: ' + errors.join('; '));
    this.#update();
  }

  receipt(value) {
    const accepted = this.#action.receipt(value);
    if (accepted) this.#update();
    return accepted;
  }

  state(data) {
    return data.disabled ? 'disabled' : this.#action.state;
  }

  attach(control, status) {
    this.#control = control;
    this.#status = status;
    this.#update();
  }

  send(extra) {
    if (this.dataset.state === 'refused' || !this.fill) return;
    const request = this.#action.start(extra);
    if (!request) return;
    this.#update();
    this.dispatchEvent(new CustomEvent('mu-action', { bubbles: true, composed: true, detail: request }));
  }

  #update() {
    if (!this.fill || !this.#control) return;
    const state = this.#action.state;
    this.dataset.state = state;
    this.#control.setAttribute('aria-disabled', state === 'default' || state === 'error' ? 'false' : 'true');
    const words = [STATUS[state], this.#action.message].filter(Boolean).join(': ');
    this.#status.className = 'status' + (state === 'error' ? ' error' : '');
    this.#status.replaceChildren(words);
  }
}

export class MuActionButton extends ActionElement {
  static component = 'action-button';
  static focus = true;
  static styles = [ACTION_CSS];

  render(data) {
    const status = el('span', { class: 'status', role: 'status', 'aria-live': 'polite', part: 'status' });
    const button = el('button', { type: 'button', part: 'button' }, data.label);
    button.addEventListener('click', () => this.send());
    this.attach(button, status);
    return [button, data.description ? el('span', { class: 'muted' }, data.description) : null, status];
  }
}

export class MuCard extends MuElement {
  static component = 'card';
  static styles = [CARD_CSS];

  render(data) {
    const date = data.date ? el('p', { class: 'muted' }, `${data.date_label ?? 'Date'}: ${data.date}`) : null;
    const facts = (data.facts ?? []).length ? el('dl', { part: 'facts' }, ...data.facts.flatMap((item) => [
      el('dt', {}, item.data.label), el('dd', {}, item.data.value)])) : null;
    // The application puts action buttons in the actions slot. A fill cannot add one.
    const actions = el('div', { class: 'actions', part: 'actions' });
    const slot = document.createElement('slot');
    slot.name = 'actions';
    actions.append(slot);
    return [el('article', { 'aria-label': data.title, part: 'card' },
      el('p', { class: 'title' }, data.title),
      data.summary ? el('p', {}, data.summary) : null, date, facts, actions)];
  }
}

export class MuCardGrid extends MuElement {
  static component = 'card-grid';
  static styles = [sheet(`
    :host { display: block; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--mu-space-4);
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--mu-size-column-medium)), 1fr)); }
    .empty { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
    @media (forced-colors: active) { .empty { color: CanvasText; } }
  `)];

  state(data) {
    return data.cards.length ? 'default' : 'empty';
  }

  // An empty grid shows only the empty text, and no empty list.
  render(data) {
    if (data.cards.length === 0) return [el('p', { class: 'empty', part: 'empty' }, 'No cards.')];
    const list = el('ul', { 'aria-label': data.label, part: 'list' });
    for (const item of data.cards) {
      const card = document.createElement('mu-card');
      card.fill = item;
      list.append(el('li', {}, card));
    }
    return [list];
  }
}

export class MuEditableForm extends ActionElement {
  static component = 'editable-form';
  static styles = [CARD_CSS, ACTION_CSS, sheet(`
    :host { display: block; }
    form { display: flex; flex-direction: column; gap: var(--mu-space-3); }
  `)];

  #fields = [];

  // A form also needs a unique name for each field, so that the values have keys.
  check(data) {
    const names = data.fields.map((item) => item.data.name);
    if (!names.every((name) => typeof name === 'string' && FIELD_NAME.test(name))) return ['data.fields: each field needs a name'];
    if (new Set(names).size !== names.length) return ['data.fields: the field names must be unique'];
    return [];
  }

  values() {
    return Object.fromEntries(this.#fields.map((node) => [node.fill.data.name, node.value ?? '']));
  }

  render(data) {
    this.#fields = data.fields.map((item) => {
      const node = document.createElement('mu-field');
      node.fill = item;
      return node;
    });
    const status = el('span', { class: 'status', role: 'status', 'aria-live': 'polite', part: 'status' });
    const submit = el('button', { type: 'submit', part: 'button' }, data.submit_label);
    const form = el('form', { 'aria-label': data.title, part: 'form' },
      el('p', { class: 'title' }, data.title), ...this.#fields, el('div', {}, submit), status);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.send(this.values());
    });
    // Each input is in the shadow root of its mu-field, so the browser does not connect it to this form.
    // Thus Enter in a field submits the form here, as Enter does in a plain form.
    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target.localName !== 'mu-field') return;
      event.preventDefault();
      form.requestSubmit(submit);
    });
    this.attach(submit, status);
    return [form];
  }
}

export function define(registry = customElements) {
  definePrimitives(registry);
  for (const [name, element] of [['mu-action-button', MuActionButton], ['mu-card', MuCard],
    ['mu-card-grid', MuCardGrid], ['mu-editable-form', MuEditableForm]]) {
    if (!registry.get(name)) registry.define(name, element);
  }
}
