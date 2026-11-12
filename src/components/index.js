// The catalog components: card, action button, editable form, card grid and citation.
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
  .provenance p { margin: 0; overflow-wrap: anywhere; }
  .provenance button {
    font: var(--mu-type-caption); min-height: 2.75rem; padding: 0 var(--mu-space-2); cursor: pointer;
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); background: transparent; color: var(--mu-color-text);
  }
  @media (forced-colors: active) {
    article, form { border-color: CanvasText; } .muted, dt { color: CanvasText; }
    .provenance button { color: ButtonText; border-color: ButtonText; }
  }
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
  .reference { display: block; }
  .step { display: flex; flex-wrap: wrap; align-items: center; gap: var(--mu-space-2); }
  .step p { flex-basis: 100%; margin: 0; }
  .step button[part="cancel"] { background: transparent; color: var(--mu-color-accent); }
  @media (forced-colors: active) {
    button { background: ButtonFace; color: ButtonText; border-color: ButtonText; forced-color-adjust: none; }
    button[aria-disabled="true"] { color: GrayText; border-color: GrayText; opacity: 1; }
    .status, .status.error { color: CanvasText; }
  }
`);

// The filled slots of a fill, as text (catalog/schema/README.md). The locator opens only after a person clicks
// the button. The element first sends a cancelable mu-open event, so that the application can open the locator.
function provenance(slots) {
  const { authorship, citation } = slots ?? {};
  if (!authorship && !citation) return null;
  const parts = [];
  if (authorship) {
    const name = authorship.name ? ` (${authorship.name})` : '';
    parts.push(el('p', { class: 'muted', part: 'authorship' }, `Author: ${authorship.type} ${authorship.id}${name}`));
  }
  if (citation) {
    const open = el('button', { type: 'button', part: 'open', 'aria-label': `Open source: ${citation.source}` }, 'Open source');
    open.addEventListener('click', () => openLocator(open, citation.locator));
    parts.push(el('p', { class: 'muted', part: 'citation' }, `Source: ${citation.source}`),
      el('p', { class: 'muted', part: 'locator' }, citation.locator), el('div', {}, open));
  }
  return el('div', { class: 'provenance', part: 'provenance' }, ...parts);
}

// The validator accepts only an https: locator with no user name. Check it again before the browser opens it.
function openLocator(source, locator) {
  let url;
  try {
    url = new URL(locator);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return;
  const event = new CustomEvent('mu-open', { bubbles: true, composed: true, cancelable: true, detail: { locator: url.href } });
  if (source.dispatchEvent(event)) window.open(url.href, '_blank', 'noopener,noreferrer');
}

const STALE = 'Saved the values from before your last edit. Save again to send the edit.';

// The text of each state. A pending action never shows as done.
const STATUS = { default: '', disabled: '', confirm: '', pending: 'Pending', done: 'Done', error: 'Not done' };

// Shared code for a component with one action. The application binds the tool with the action property
// and gives the receipt with receipt(). The element sends a mu-action event with the request.
class ActionElement extends MuElement {
  #action = new ActionState();
  #status = null;
  #control = null;
  // The area of the confirm step, and the step while it shows.
  #area = null;
  #asking = null;

  // The state of the action can only be read. Only bind(), start() and receipt() change it.
  get action() {
    return this.#action;
  }

  set action(binding) {
    const errors = this.#action.bind(binding);
    if (errors.length) throw new TypeError('action: ' + errors.join('; '));
    this.#close();
    this.rebound();
    this.#update();
  }

  receipt(value) {
    const accepted = this.#action.receipt(value);
    // A receipt confirms only the values of its request. If the data changed after the request, the
    // element does not show done. It asks for a new request.
    if (accepted && this.#action.state === 'done' && this.stale()) this.#action.reopen(STALE);
    if (accepted) this.#update();
    return accepted;
  }

  // The name of the data field that shows the label of the action.
  static labelField = 'label';

  // The application gives the label of the action. A fill cannot show a different meaning for the bound tool.
  check(data) {
    const label = this.#action.label;
    const field = this.constructor.labelField;
    if (label !== null && data[field] !== label) return [`data.${field}: the label is not the label of the application`];
    return [];
  }

  // A new binding can refuse a fill that the element shows now.
  rebound() {
    if (this.fill && this.check(this.fill.data).length) this.fill = this.fill;
  }

  // A subclass returns true if its data changed after the last request.
  stale() {
    return false;
  }

  // An edit after a receipt makes the data new. Then the action can start again. An edit also closes
  // the confirm step, because the person did not confirm the new data.
  reopen() {
    this.#close();
    if (this.#action.reopen()) this.#update();
  }

  state(data) {
    return data.disabled ? 'disabled' : this.#action.state;
  }

  // Returns the area of the confirm step. The subclass puts it in the shadow root.
  attach(control, status) {
    this.#control = control;
    this.#status = status;
    this.#asking = null;
    this.#area = el('div', { class: 'confirm-area' });
    this.#update();
    return this.#area;
  }

  // The started function runs only for an accepted request, before the element sends the event.
  // If the binding has a confirm step, the element shows it first and sends the action only after a person confirms.
  send(extra, started) {
    if (this.dataset.state === 'refused' || !this.fill || this.#asking) return;
    const confirm = this.#action.confirm;
    if (!confirm) {
      this.#start(extra, started, false);
      return;
    }
    const state = this.#action.state;
    if (state !== 'default' && state !== 'error') return;
    const cancel = el('button', { type: 'button', part: 'cancel' }, 'Cancel');
    const accept = el('button', { type: 'button', part: 'accept' }, confirm.label);
    const step = el('div', { class: 'step', role: 'group', 'aria-label': confirm.message, part: 'confirm' },
      el('p', {}, confirm.message), cancel, accept);
    cancel.addEventListener('click', () => this.#close());
    accept.addEventListener('click', () => {
      this.#close();
      this.#start(extra, started, true);
    });
    step.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.#close();
    });
    this.#asking = step;
    this.#area.replaceChildren(step);
    this.#update();
    cancel.focus();
  }

  // Closes the confirm step. If the focus was in the step, it goes back to the action control.
  #close() {
    if (!this.#asking) return;
    const focused = this.#asking.contains(this.shadowRoot?.activeElement);
    this.#asking = null;
    this.#area.replaceChildren();
    this.#update();
    if (focused) this.#control.focus();
  }

  #start(extra, started, confirmed) {
    const request = this.#action.start(extra, confirmed);
    if (!request) return;
    started?.(request);
    this.#update();
    this.dispatchEvent(new CustomEvent('mu-action', { bubbles: true, composed: true, detail: request }));
  }

  #update() {
    if (!this.fill || !this.#control) return;
    const state = this.#asking ? 'confirm' : this.#action.state;
    this.dataset.state = state;
    this.#control.setAttribute('aria-disabled', state === 'default' || state === 'error' ? 'false' : 'true');
    const words = [STATUS[state], state === 'confirm' ? '' : this.#action.message].filter(Boolean).join(': ');
    this.#status.className = 'status' + (state === 'error' ? ' error' : '');
    // The reference comes from the API of the application. It shows only as text.
    const reference = state === 'confirm' ? '' : this.#action.reference;
    this.#status.replaceChildren(words, reference ? el('span', { class: 'reference', part: 'reference' }, 'Reference: ' + reference) : '');
  }
}

export class MuActionButton extends ActionElement {
  static component = 'action-button';
  static focus = true;
  static styles = [ACTION_CSS];

  // The description can name the target of the bound arguments. Thus the application gives it, and a fill
  // with a different description is refused. A binding with no description accepts no fill with a description.
  check(data) {
    const errors = super.check(data);
    if (errors.length) return errors;
    const description = this.action.description;
    if (description !== null && (data.description ?? '') !== description) {
      return ['data.description: the description is not the description of the application'];
    }
    return [];
  }

  render(data) {
    const status = el('span', { class: 'status', role: 'status', 'aria-live': 'polite', part: 'status' });
    const button = el('button', { type: 'button', part: 'button' }, data.label);
    button.addEventListener('click', () => this.send());
    const area = this.attach(button, status);
    return [button, data.description ? el('span', { class: 'muted' }, data.description) : null, area, status];
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
      data.summary ? el('p', {}, data.summary) : null, date, facts, provenance(this.fill.slots), actions)];
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
    // A nested card takes the slots and the actor of the grid, so each card shows them.
    for (const item of data.cards) {
      const card = document.createElement('mu-card');
      card.actor = this.actor;
      card.fill = this.fill.slots ? { ...item, slots: this.fill.slots } : item;
      list.append(el('li', {}, card));
    }
    return [list];
  }
}

export class MuEditableForm extends ActionElement {
  static component = 'editable-form';
  static labelField = 'submit_label';
  static styles = [CARD_CSS, ACTION_CSS, sheet(`
    :host { display: block; }
    form { display: flex; flex-direction: column; gap: var(--mu-space-3); }
  `)];

  #fields = [];
  #sent = null;

  stale() {
    return JSON.stringify(this.values()) !== this.#sent;
  }

  // A form also needs a unique name for each field, so that the values have keys.
  check(data) {
    const errors = super.check(data);
    if (errors.length) return errors;
    // The application gives the title. The title names the target of the bound arguments, so a fill cannot
    // show one target while the request changes a different target.
    const title = this.action.title;
    if (title !== null && data.title !== title) return ['data.title: the title is not the title of the application'];
    // The application labels of the fields tell what the request does. A form with no field that a person can
    // edit sends no such value, because the form does not send a disabled field.
    if (!data.fields.some((item) => !item.data.disabled)) return ['data.fields: the form needs at least one field that a person can edit'];
    const names = data.fields.map((item) => item.data.name);
    if (!names.every((name) => typeof name === 'string' && FIELD_NAME.test(name))) return ['data.fields: each field needs a name'];
    if (new Set(names).size !== names.length) return ['data.fields: the field names must be unique'];
    // The application gives the names that a request can carry, and the label of each name.
    // A fill cannot add a different argument or show a different meaning for an argument.
    const editable = this.action.editable;
    if (!editable) return [];
    const other = names.find((name) => !Object.hasOwn(editable, name));
    if (other) return [`data.fields: the application does not accept the field ${other}`];
    const relabeled = data.fields.find((item) => item.data.label !== editable[item.data.name]);
    if (relabeled) return [`data.fields: the label of the field ${relabeled.data.name} is not the label of the application`];
    return [];
  }

  // A person cannot edit a disabled field, so its value does not go in the request.
  values() {
    return Object.fromEntries(this.#fields.filter((node) => !node.fill.data.disabled)
      .map((node) => [node.fill.data.name, node.value ?? '']));
  }

  render(data) {
    this.#sent = null;
    this.#fields = data.fields.map((item) => {
      const node = document.createElement('mu-field');
      node.fill = item;
      return node;
    });
    const status = el('span', { class: 'status', role: 'status', 'aria-live': 'polite', part: 'status' });
    const submit = el('button', { type: 'submit', part: 'button' }, data.submit_label);
    const area = this.attach(submit, status);
    const form = el('form', { 'aria-label': data.title, part: 'form' },
      el('p', { class: 'title' }, data.title), provenance(this.fill.slots), ...this.#fields, el('div', {}, submit), area, status);
    // An edit after done makes the values new, so the form can save again.
    form.addEventListener('mu-edit', () => this.reopen());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = this.values();
      // Keep the values only for an accepted request. A refused submit does not change them.
      this.send(values, () => { this.#sent = JSON.stringify(values); });
    });
    // Each input is in the shadow root of its mu-field, so the browser does not connect it to this form.
    // Thus Enter in a field submits the form here, as Enter does in a plain form.
    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target.localName !== 'mu-field') return;
      event.preventDefault();
      form.requestSubmit(submit);
    });
    // A new fill has new values. A receipt from before the fill does not confirm them, so the form can save again.
    this.reopen();
    return [form];
  }
}

// The citation of a claim (catalog/citation.json). The source and the locator come from the citation slot, so the
// locator rule of the slot applies. The validator refuses a missing or bad locator, and the refusal tells why.
export class MuCitation extends MuElement {
  static component = 'citation';
  static styles = [sheet(`
    :host { display: block; }
    figure {
      margin: 0; color: var(--mu-color-text); font: var(--mu-type-body); padding: var(--mu-space-2) var(--mu-space-3);
      border-inline-start: 3px solid var(--mu-color-border); border-radius: var(--mu-radius-2);
      display: flex; flex-direction: column; gap: var(--mu-space-1);
    }
    blockquote { margin: 0; overflow-wrap: anywhere; }
    .muted { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
    .provenance { display: flex; flex-direction: column; gap: var(--mu-space-1); }
    .provenance p { margin: 0; overflow-wrap: anywhere; }
    .provenance button {
      align-self: start; font: var(--mu-type-caption); min-height: 2.75rem; padding: 0 var(--mu-space-2); cursor: pointer;
      border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); background: transparent; color: var(--mu-color-text);
    }
    @media (forced-colors: active) {
      figure { border-color: CanvasText; } .muted { color: CanvasText; }
      .provenance button { color: ButtonText; border-color: ButtonText; }
    }
  `)];

  state() {
    return this.fill.slots?.citation ? 'default' : 'empty';
  }

  refusal(errors) {
    if (errors[0] === 'slots.citation: missing key locator') return 'the locator is missing.';
    if (errors[0].startsWith('slots.citation.locator:')) return 'the locator is not a safe https: address.';
    return errors[0];
  }

  render(data) {
    const quote = data.quote ? el('blockquote', { part: 'quote' }, data.quote) : null;
    // The authorship slot is required, so the author always shows. With no citation slot, the text tells it.
    const empty = this.fill.slots.citation ? null : el('p', { class: 'muted', part: 'empty' }, 'No source given.');
    return [el('figure', { role: 'group', 'aria-label': 'Citation', part: 'citation' }, quote, empty, provenance(this.fill.slots))];
  }
}

export function define(registry = customElements) {
  definePrimitives(registry);
  for (const [name, element] of [['mu-action-button', MuActionButton], ['mu-card', MuCard],
    ['mu-card-grid', MuCardGrid], ['mu-editable-form', MuEditableForm], ['mu-citation', MuCitation]]) {
    if (!registry.get(name)) registry.define(name, element);
  }
}
