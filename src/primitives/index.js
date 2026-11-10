// The first primitives: text, button, field, stack and grid. Each one has a contract in catalog/.
import { MuElement } from './base.js';
import { el, sheet } from '../render/dom.js';

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
    @media (forced-colors: active) {
      input { border-color: FieldText; }
      .hint, .error { color: CanvasText; }
    }
  `)];

  #input = null;

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
    input.disabled = Boolean(data.disabled);
    input.addEventListener('input', () => {
      this.dispatchEvent(new CustomEvent('mu-edit', { bubbles: true, composed: true,
        detail: { field: 'value', value: input.value } }));
    });
    this.#input = input;
    return [el('div', { class: 'box' },
      el('label', { for: id, part: 'label' }, data.label),
      input,
      data.hint ? el('span', { id: id + '-hint', class: 'hint' }, data.hint) : null,
      data.error ? el('span', { id: id + '-error', class: 'error' }, data.error) : null)];
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
