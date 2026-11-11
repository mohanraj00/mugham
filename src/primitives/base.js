// The base class of each primitive. It validates a fill against the contract before it renders.
import { fillErrors } from '../render/validate.js';
import { CATALOG } from '../render/catalog.js';
import { BASE, el } from '../render/dom.js';

export class MuElement extends HTMLElement {
  static component = '';
  static styles = [];
  static focus = false;

  #fill = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: this.constructor.focus });
    root.adoptedStyleSheets = [BASE, ...this.constructor.styles];
  }

  get fill() {
    return this.#fill;
  }

  // A fill is data only. If it has an error, the element shows a refusal as text and keeps no data.
  set fill(value) {
    const name = this.constructor.component;
    // A fill of a different component is refused for that reason first.
    const other = value !== null && typeof value === 'object' && !Array.isArray(value) && value.component !== name;
    const errors = other ? [`component: must be ${name}`] : fillErrors(value, CATALOG);
    const root = this.shadowRoot;
    if (errors.length) {
      this.#fill = null;
      this.dataset.state = 'refused';
      root.replaceChildren(el('span', { class: 'refused', role: 'status' }, `Refused ${name}: ${errors[0]}`));
      this.dispatchEvent(new CustomEvent('mu-refused', { bubbles: true, composed: true, detail: { errors } }));
      return;
    }
    this.#fill = structuredClone(value);
    this.dataset.state = this.state(this.#fill.data);
    root.replaceChildren(...this.render(this.#fill.data));
  }

  state() {
    return 'default';
  }

  render() {
    return [];
  }
}
