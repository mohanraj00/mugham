// The first primitives: text, button, field, stack and grid. Each one has a contract in catalog/.
import { MuElement } from './base.js';
import { el, sheet } from '../render/dom.js';
import { CATALOG } from '../render/catalog.js';

const GAPS = { small: 'var(--mu-space-1)', medium: 'var(--mu-space-2)', large: 'var(--mu-space-4)' };
const COLUMNS = { narrow: 'var(--mu-size-column-narrow)', medium: 'var(--mu-size-column-medium)', wide: 'var(--mu-size-column-wide)' };

export class MuText extends MuElement {
  static component = 'text';
  static styles = [sheet(`
    :host { display: inline; color: var(--mu-color-text); font: var(--mu-type-body); }
    .strong { font-weight: var(--mu-type-weight-strong); }
    .caption { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
    @media (forced-colors: active) { :host, .caption { color: CanvasText; } }
  `)];

  state(data) {
    return data.text === '' ? 'empty' : 'default';
  }

  render(data) {
    return [el('span', { part: 'text', class: data.variant ?? 'body' }, data.text)];
  }
}

export class MuButton extends MuElement {
  static component = 'button';
  static focus = true;
  static styles = [sheet(`
    :host { display: inline-block; }
    button {
      font: var(--mu-type-body); min-height: 2.75rem; min-width: 2.75rem;
      padding: var(--mu-space-2) var(--mu-space-3); border-radius: var(--mu-radius-2);
      border: 1px solid var(--mu-color-accent); background: var(--mu-color-accent); color: var(--mu-color-on-accent);
      cursor: pointer; transition: background-color var(--mu-motion-fast), color var(--mu-motion-fast);
    }
    button.secondary { background: var(--mu-color-surface); color: var(--mu-color-accent); border-color: var(--mu-color-border); }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    @media (forced-colors: active) {
      button, button.secondary { background: ButtonFace; color: ButtonText; border-color: ButtonText; forced-color-adjust: none; }
      button:disabled { color: GrayText; border-color: GrayText; opacity: 1; }
    }
  `)];

  state(data) {
    return data.disabled ? 'disabled' : 'default';
  }

  render(data) {
    const button = el('button', { type: 'button', part: 'button', class: data.emphasis ?? 'primary' }, data.label);
    button.disabled = Boolean(data.disabled);
    // The button only tells the code that contains it. It never sends an action.
    button.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('mu-press', { bubbles: true, composed: true }));
    });
    return [button];
  }
}

let fieldCount = 0;
// The edit types of a typed field, with their meaning (catalog/README.md, "Typed edits").
const TYPES = [
  ['judgment', 'Judgment', 'The old value was not wrong. I chose a different value.'],
  ['correction', 'Correction', 'The old value was wrong.'],
  ['override', 'Override', 'I replace a value from a rule, a service or an agent.'],
];

export class MuField extends MuElement {
  static component = 'field';
  static focus = true;
  static styles = [sheet(`
    :host { display: block; color: var(--mu-color-text); font: var(--mu-type-body); }
    .box { display: flex; flex-direction: column; gap: var(--mu-space-1); }
    input {
      font: var(--mu-type-body); color: var(--mu-color-text); background: var(--mu-color-surface);
      border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-1); padding: var(--mu-space-2);
      min-height: 2.75rem; transition: border-color var(--mu-motion-fast);
    }
    input[aria-invalid="true"] { border-color: var(--mu-color-danger); border-width: 2px; }
    .hint { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
    .error { font: var(--mu-type-caption); color: var(--mu-color-danger); }
    fieldset {
      margin: 0; padding: var(--mu-space-2); border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-1);
      display: flex; flex-direction: column; gap: var(--mu-space-1);
    }
    fieldset[hidden] { display: none; }
    fieldset[aria-invalid="true"] { border-color: var(--mu-color-danger); border-width: 2px; }
    legend { font: var(--mu-type-caption); padding: 0 var(--mu-space-1); }
    .type { display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--mu-space-2); min-height: 2.75rem; }
    .type input { min-height: auto; margin: 0; }
    @media (forced-colors: active) {
      input, fieldset { border-color: FieldText; }
      .hint, .error { color: CanvasText; }
    }
  `)];

  #input = null;
  #initial = '';
  #group = null;
  #reason = null;
  #editedAt = null;

  // The value of the fill. A typed edit compares the value with it.
  get initial() {
    return this.fill ? this.#initial : null;
  }

  // True if the value is not the value of the fill.
  get changed() {
    return this.value !== null && this.value !== this.#initial;
  }

  // The edit type of a changed typed field: judgment, correction or override. Else null.
  get editType() {
    if (!this.#group || !this.changed) return null;
    return this.#group.querySelector('input:checked')?.value ?? null;
  }

  // The time of the last change of the value or the type, as an ISO 8601 text in UTC. Else null.
  get editedAt() {
    return this.fill && this.changed ? this.#editedAt : null;
  }

  // Shows the reason of a refused submit in the group, and moves the focus to the group.
  // Returns false if the field needs no edit type now.
  needType() {
    if (!this.#group || !this.changed || this.editType) return false;
    this.#mark(true);
    const radio = this.#group.querySelector('input');
    radio.focus();
    return true;
  }

  // A description names a hidden element too, so the reason text and the description exist only while they apply.
  #mark(invalid) {
    this.#group.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    this.#reason.replaceChildren(invalid ? 'Choose an edit type.' : '');
    if (invalid) this.#group.setAttribute('aria-describedby', this.#reason.id);
    else this.#group.removeAttribute('aria-describedby');
  }

  // The group shows only while the value is not the value of the fill. The old value again clears the type.
  #sync() {
    if (!this.#group) return;
    const open = this.changed;
    this.#group.hidden = !open;
    if (!open) {
      for (const radio of this.#group.querySelectorAll('input')) radio.checked = false;
      this.#mark(false);
    }
  }

  #typeGroup(id) {
    const reason = el('span', { id: id + '-reason', class: 'error', part: 'reason' });
    const radios = TYPES.map(([value, label, meaning]) => {
      const radio = el('input', { type: 'radio', id: `${id}-${value}`, name: id + '-type', 'aria-describedby': `${id}-${value}-meaning` });
      radio.value = value;
      radio.addEventListener('change', () => {
        this.#editedAt = new Date().toISOString();
        this.#mark(false);
        this.dispatchEvent(new CustomEvent('mu-edit', { bubbles: true, composed: true, detail: { field: 'type', value } }));
      });
      return el('div', { class: 'type' }, radio, el('label', { for: radio.id }, label),
        el('span', { id: `${id}-${value}-meaning`, class: 'hint' }, meaning));
    });
    const group = el('fieldset', { part: 'edit-type' }, el('legend', {}, 'Edit type'), ...radios, reason);
    group.hidden = true;
    this.#reason = reason;
    return group;
  }

  get value() {
    // A refused field keeps no data.
    return this.fill && this.#input ? this.#input.value : null;
  }

  state(data) {
    if (data.disabled) return 'disabled';
    return data.error ? 'error' : 'default';
  }

  render(data) {
    fieldCount += 1;
    const id = 'mu-field-' + fieldCount;
    const described = [data.hint ? id + '-hint' : '', data.error ? id + '-error' : ''].filter(Boolean).join(' ');
    const input = el('input', { id, type: 'text', part: 'input', 'aria-invalid': data.error ? 'true' : false,
      'aria-describedby': described || false });
    input.value = data.value ?? '';
    this.#initial = input.value;
    this.#editedAt = null;
    input.disabled = Boolean(data.disabled);
    // The contract limits the value. maxLength counts UTF-16 units, so it never permits more code points
    // than the limit. A value from a script or a paste can still be longer, so the handler cuts it.
    const limit = CATALOG.field.data.value.max_length;
    input.maxLength = limit;
    input.addEventListener('input', () => {
      const points = [...input.value];
      if (points.length > limit) input.value = points.slice(0, limit).join('');
      this.#editedAt = new Date().toISOString();
      this.#sync();
      this.dispatchEvent(new CustomEvent('mu-edit', { bubbles: true, composed: true,
        detail: { field: 'value', value: input.value } }));
    });
    this.#input = input;
    // A typed field asks for the edit type after a change. A disabled field has no edit.
    this.#group = data.typed && !data.disabled ? this.#typeGroup(id) : null;
    return [el('div', { class: 'box' },
      el('label', { for: id, part: 'label' }, data.label),
      input,
      data.hint ? el('span', { id: id + '-hint', class: 'hint' }, data.hint) : null,
      data.error ? el('span', { id: id + '-error', class: 'error' }, data.error) : null,
      this.#group)];
  }
}

export class MuStack extends MuElement {
  static component = 'stack';
  static styles = [sheet(`
    :host { display: block; }
    .layout { display: flex; flex-direction: column; }
    .layout.row { flex-direction: row; flex-wrap: wrap; }
  `)];

  render(data) {
    const layout = el('div', { role: 'group', 'aria-label': data.label, part: 'layout', class: 'layout ' + (data.direction ?? 'column') },
      document.createElement('slot'));
    layout.style.gap = GAPS[data.gap ?? 'medium'];
    return [layout];
  }
}

export class MuGrid extends MuElement {
  static component = 'grid';
  static styles = [sheet(`
    :host { display: block; }
    .layout { display: grid; }
  `)];

  render(data) {
    const layout = el('div', { role: 'group', 'aria-label': data.label, part: 'layout', class: 'layout' },
      document.createElement('slot'));
    layout.style.gap = GAPS[data.gap ?? 'medium'];
    layout.style.gridTemplateColumns = `repeat(auto-fill, minmax(min(100%, ${COLUMNS[data.min_column ?? 'medium']}), 1fr))`;
    return [layout];
  }
}

export function define(registry = customElements) {
  for (const [name, element] of [['mu-text', MuText], ['mu-button', MuButton], ['mu-field', MuField],
    ['mu-stack', MuStack], ['mu-grid', MuGrid]]) {
    if (!registry.get(name)) registry.define(name, element);
  }
}
