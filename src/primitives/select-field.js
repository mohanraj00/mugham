import { el, sheet } from '../render/dom.js';
import { FieldElement } from './fields.js';

const SELECT_CSS = sheet(`
  :host { min-inline-size: 0; overflow-wrap: anywhere; }
  .select, [part="popup"] { display: grid; gap: var(--mu-space-1); min-inline-size: 0; }
  [part="popup"] { padding: var(--mu-space-1); }
  [part="popup"][hidden] { display: none; }
  [part="control"], [part="search"], [part="option"] {
    box-sizing: border-box; min-inline-size: 44px; min-block-size: 44px;
    font: var(--mu-type-body); padding: var(--mu-space-2);
  }
  [part="control"] {
    display: flex; align-items: center; justify-content: space-between; gap: var(--mu-space-2);
    text-align: start; color: var(--mu-color-text); background: var(--mu-color-surface);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-1); cursor: pointer;
  }
  [part="control"]::after {
    content: ""; flex: none; inline-size: 0.45em; block-size: 0.45em;
    border-inline-end: 2px solid; border-block-end: 2px solid; transform: rotate(45deg);
  }
  [part="control"][aria-expanded="true"]::after { transform: rotate(225deg); }
  [part="control"][aria-invalid="true"] { border-color: var(--mu-color-danger); border-width: 2px; }
  [part="value"], [part="option"] { overflow-wrap: anywhere; white-space: pre-wrap; }
  [part="search"] { inline-size: 100%; }
  [part="listbox"] {
    max-block-size: 16rem; overflow: auto; background: var(--mu-color-surface);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-1);
  }
  [part="listbox"]:empty { display: none; }
  [part="option"] {
    display: flex; align-items: center; cursor: pointer; border-radius: var(--mu-radius-1);
    transition: background-color var(--mu-motion-fast);
  }
  [part="option"][aria-selected="true"] { font-weight: var(--mu-type-weight-strong); }
  [part="option"]:hover { background-color: color-mix(in srgb, currentColor 8%, transparent); }
  [part="option"][data-state="active"] { outline: 2px solid var(--mu-color-focus); outline-offset: -2px; }
  @media (forced-colors: active) {
    [part="control"] { color: ButtonText; background: ButtonFace; border-color: ButtonText; }
    [part="control"]:disabled { color: GrayText; border-color: GrayText; }
    [part="listbox"] { border-color: FieldText; }
    [part="option"]:hover { outline: 1px solid Highlight; outline-offset: -2px; }
    [part="option"][data-state="active"] { outline-color: Highlight; }
  }
`);

export class MuSelectField extends FieldElement {
  static component = 'select-field';
  static styles = [...FieldElement.styles, SELECT_CSS];
  static submitOnEnter = false;

  #value = '';
  #button;
  #valueText;
  #popup;
  #search;
  #list;
  #status;
  #options = [];
  #matches = [];
  #active = -1;
  #outside;

  read() {
    return this.#value;
  }

  disconnectedCallback() {
    this.#close();
  }

  refuse(errors) {
    this.#close();
    super.refuse(errors);
  }

  control(data, id) {
    this.#close();
    this.#value = data.value ?? '';
    this.#valueText = el('span', { part: 'value' }, this.#value || 'Choose an option');
    const listId = id + '-list';
    this.#button = el('button', { id, type: 'button', part: 'control', role: 'combobox',
      'aria-expanded': 'false', 'aria-controls': listId }, this.#valueText);
    this.#button.setAttribute('aria-activedescendant', '');
    this.#search = data.choices.length > 7 ? el('input', { type: 'text', part: 'search', autocomplete: 'off', role: 'combobox',
      'aria-label': 'Search ' + data.label, 'aria-autocomplete': 'list', 'aria-controls': listId, 'aria-expanded': 'false' }) : null;
    this.#list = el('div', { id: listId, role: 'listbox', part: 'listbox', 'aria-label': data.label, tabindex: '-1' });
    this.#status = el('div', { role: 'status', 'aria-live': 'polite', part: 'status', class: 'hint' });
    this.#popup = el('div', { part: 'popup' }, this.#search, this.#list, this.#status);
    this.#popup.hidden = true;

    this.#options = data.choices.map((value, index) => {
      const node = el('div', { id: listId + '-' + index, role: 'option', part: 'option',
        'aria-selected': String(value === this.#value) }, value);
      node.addEventListener('click', () => this.#select(value));
      return { value, folded: value.toLowerCase(), node };
    });
    const node = el('div', { class: 'select' }, this.#button, this.#popup);
    this.#button.addEventListener('click', () => {
      if (this.#popup.hidden) this.#open();
      else this.#close(true);
    });
    for (const target of [this.#button, this.#search].filter(Boolean)) {
      target.addEventListener('keydown', (event) => this.#key(event));
    }
    this.#search?.addEventListener('input', () => this.#filter());
    // Keep focus on the combobox when a person clicks an option.
    this.#list.addEventListener('mousedown', (event) => {
      if (event.target !== this.#list) event.preventDefault();
    });
    // Native Tab and Shift+Tab move focus out of the popup before it closes.
    node.addEventListener('focusout', ({ relatedTarget }) => {
      if (!node.contains(relatedTarget)) this.#close();
    });
    return { node, targets: this.#search ? [this.#button, this.#search] : [this.#button] };
  }

  #open(last = false) {
    if (this.#button.disabled) return;
    this.#popup.hidden = false;
    this.#button.setAttribute('aria-expanded', 'true');
    if (this.#search) {
      this.#button.tabIndex = -1;
      this.#search.setAttribute('aria-expanded', 'true');
      this.#search.value = '';
    }
    const selected = this.#options.findIndex(({ value }) => value === this.#value);
    (this.#search ?? this.#button).focus();
    const edge = last ? this.#options.length - 1 : 0;
    this.#filter(selected >= 0 ? selected : edge);
    if (!this.#popup.hidden) {
      this.#outside = new AbortController();
      this.ownerDocument.addEventListener('click', (event) => {
        if (!event.composedPath().includes(this)) this.#close();
      }, { capture: true, signal: this.#outside.signal });
    }
  }

  #close(focus = false) {
    if (!this.#popup || this.#popup.hidden) return;
    this.#outside?.abort();
    this.#outside = null;
    this.#popup.hidden = true;
    this.#button.tabIndex = 0;
    this.#button.setAttribute('aria-expanded', 'false');
    this.#search?.setAttribute('aria-expanded', 'false');
    this.#setActive(-1);
    if (focus) this.#button.focus();
  }

  #filter(index = 0) {
    if (this.#popup.hidden) return;
    this.#setActive(-1);
    const query = this.#search?.value.toLowerCase() ?? '';
    this.#matches = this.#options.filter(({ folded }) => folded.includes(query));
    this.#list.replaceChildren(...this.#matches.map(({ node }) => node));
    this.#list.scrollTop = 0;
    this.#status.textContent = this.#matches.length ? '' : 'No match';
    this.#setActive(this.#matches.length ? index : -1);
  }

  #setActive(index) {
    this.#matches[this.#active]?.node.removeAttribute('data-state');
    this.#active = index;
    const option = this.#matches[index]?.node;
    const control = this.#search ?? this.#button;
    if (option) {
      option.setAttribute('data-state', 'active');
      control.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    } else if (this.#search) control.removeAttribute('aria-activedescendant');
    else control.setAttribute('aria-activedescendant', '');
  }

  #select(value) {
    if (this.#popup.hidden || this.#button.disabled) return;
    if (value === this.#value) {
      this.#close(true);
      return;
    }
    this.#value = value;
    this.#valueText.textContent = value;
    for (const option of this.#options) option.node.setAttribute('aria-selected', String(option.value === value));
    this.#close(true);
    this.changedValue();
  }

  #key(event) {
    if (this.#button.disabled || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const { key } = event;
    if (this.#popup.hidden) {
      if (![' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(key)) return;
      event.preventDefault();
      this.#open(key === 'ArrowUp');
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.#close(true);
      return;
    }
    if (key === 'Enter' || (key === ' ' && event.currentTarget === this.#button)) {
      event.preventDefault();
      const active = this.#matches[this.#active];
      if (active) this.#select(active.value);
      return;
    }
    const last = this.#matches.length - 1;
    let index;
    switch (key) {
      case 'ArrowDown': index = Math.min(last, this.#active + 1); break;
      case 'ArrowUp': index = Math.max(0, this.#active - 1); break;
      case 'Home': index = 0; break;
      case 'End': index = last; break;
      default: return;
    }
    event.preventDefault();
    if (last >= 0) this.#setActive(index);
  }
}
