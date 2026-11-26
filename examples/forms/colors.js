import { define, register } from '../../src/components/index.js';
import { FieldElement } from '../../src/primitives/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';
import { el, sheet } from '../../src/render/dom.js';
import COLOR_FIELD from './color-field.json' with { type: 'json' };

const CSS = sheet(`
  select {
    min-block-size: 44px; min-inline-size: 44px; max-inline-size: 100%;
    font: var(--mu-type-body); color: var(--mu-color-text); background: var(--mu-color-surface);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-1); padding: var(--mu-space-2);
  }
  select[aria-invalid="true"] { border-color: var(--mu-color-danger); }
  @media (forced-colors: active) {
    select, select[aria-invalid="true"] { background: Field; color: FieldText; border-color: FieldText; }
  }
`);

class ColorField extends FieldElement {
  static component = 'color-field';
  static styles = [...FieldElement.styles, CSS];
  static submitOnEnter = false;
  #select;

  read() {
    return this.#select.value;
  }

  reason(value) {
    return COLOR_FIELD.data.value.values.includes(value) ? null : 'Choose a label color.';
  }

  control(data, id) {
    const placeholder = el('option', {}, 'Choose a color');
    placeholder.value = '';
    const choices = COLOR_FIELD.data.value.values.map((color) => el('option', {}, color));
    const select = el('select', { id }, placeholder, ...choices);
    select.required = true;
    select.value = data.value ?? '';
    select.addEventListener('change', () => this.changedValue());
    this.#select = select;
    return { node: select, targets: [select] };
  }
}

define();
register(COLOR_FIELD, ColorField);

const { mount } = createKit({ actor: { type: 'human', id: 'example-editor' } });
const action = { tool: 'labels.save', title: 'Sample label', label: 'Save label', editable: { color: 'Label color' } };
const color = fill('color-field', { name: 'color', label: action.editable.color });
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [color] }, { action });
const log = el('pre');
const request = el('section', { 'aria-label': 'Last request' }, log);
request.hidden = true;

onAction(form, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the label color.' };
});
document.getElementById('main').append(form, request);
