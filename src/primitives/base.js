// The base class of each primitive. It validates a fill against the contract before it renders.
import { actorErrors, authorErrors, fillErrors } from '../render/validate.js';
import { BRAND, CONTRACTS } from '../render/registry.js';
import { BASE, el } from '../render/dom.js';

export class MuElement extends HTMLElement {
  // register (src/render/registry.js) reads this key to accept only a subclass of MuElement.
  static [BRAND] = true;
  static component = '';
  static styles = [];
  static focus = false;

  #fill = null;
  #actor = null;
  // The values that a script gave before the upgrade, until the element replays them.
  #early = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: this.constructor.focus });
    root.adoptedStyleSheets = [BASE, ...this.constructor.styles];
    // Each instance gets fill and actor as own accessors that it cannot change. Thus a class field of a
    // subclass, for example fill = null, cannot replace the validation: its definition throws a TypeError.
    const early = {};
    for (const key of ['actor', 'fill']) {
      if (Object.hasOwn(this, key)) early[key] = this[key];
      const { get, set } = Object.getOwnPropertyDescriptor(MuElement.prototype, key);
      Object.defineProperty(this, key, { get, set, enumerable: false, configurable: false });
    }
    // A value that a script gave before the upgrade goes through the setter after the constructor of the
    // subclass completes, because check and render can read its fields. A newer value replaces it.
    if (Object.keys(early).length === 0) return;
    this.#early = early;
    queueMicrotask(() => {
      const values = this.#early;
      this.#early = null;
      for (const key of ['actor', 'fill']) if (values && Object.hasOwn(values, key)) this[key] = values[key];
    });
  }

  get fill() {
    return this.#fill;
  }

  // The application or the thread gives the actor of the content, for example the actor of the envelope.
  // A fill cannot set it. The element refuses a fill whose authorship slot names a different actor.
  get actor() {
    return this.#actor;
  }

  set actor(value) {
    if (this.#early) delete this.#early.actor;
    const errors = actorErrors(value);
    if (errors.length) throw new TypeError('actor: ' + errors.join('; '));
    this.#actor = value === null ? null
      : Object.freeze({ type: value.type, id: value.id, ...(Object.hasOwn(value, 'name') ? { name: value.name } : {}) });
    if (this.#fill) this.fill = this.#fill;
  }

  // A fill is data only. If it has an error, the element shows a refusal as text and keeps no data.
  set fill(value) {
    if (this.#early) delete this.#early.fill;
    const name = this.constructor.component;
    // A fill of a different component is refused for that reason first.
    const other = value !== null && typeof value === 'object' && !Array.isArray(value) && value.component !== name;
    const errors = other ? [`component: must be ${name}`] : fillErrors(value, CONTRACTS);
    if (errors.length === 0) errors.push(...authorErrors(value, this.#actor), ...this.check(value.data));
    const root = this.shadowRoot;
    if (errors.length) {
      this.#fill = null;
      this.dataset.state = 'refused';
      root.replaceChildren(el('span', { class: 'refused', role: 'status' }, `Refused ${name}: ${this.refusal(errors)}`));
      this.dispatchEvent(new CustomEvent('mu-refused', { bubbles: true, composed: true, detail: { errors } }));
      return;
    }
    this.#fill = structuredClone(value);
    this.dataset.state = this.state(this.#fill.data);
    // A render can give null for an optional part. Such a part shows nothing.
    root.replaceChildren(...this.render(this.#fill.data).filter((part) => part !== null && part !== undefined));
  }

  // The reason of a refusal, as text for a person. The mu-refused event always gives all errors of the validator.
  refusal(errors) {
    return errors[0];
  }

  // A subclass can refuse a fill for a rule that the contract format cannot give.
  check() {
    return [];
  }

  state() {
    return 'default';
  }

  render() {
    return [];
  }
}
