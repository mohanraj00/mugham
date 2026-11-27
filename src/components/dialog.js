// The browser owns focus, Escape and the top layer of each modal.
import { MuElement } from '../primitives/base.js';
import { COMPACT_CONTROL_CSS, CONTROL_DISPLAY, FLOATING_TOOLTIP_CSS, compactControls, el, icon, sheet } from '../render/dom.js';

export class MuDialog extends MuElement {
  static component = 'dialog';
  static observedAttributes = [CONTROL_DISPLAY];
  static styles = [COMPACT_CONTROL_CSS, FLOATING_TOOLTIP_CSS, sheet(`
    dialog {
      inline-size: min(32rem, calc(100% - 2 * var(--mu-space-4)));
      max-inline-size: 100%;
      max-block-size: calc(100% - 2 * var(--mu-space-4));
      padding: var(--mu-space-4);
      color: var(--mu-color-text); background: var(--mu-color-surface);
      border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-3);
      font: var(--mu-type-body); overflow-wrap: anywhere; overscroll-behavior: contain;
    }
    dialog::backdrop { background: rgb(0 0 0 / 48%); }
    .header { display: flex; align-items: center; justify-content: space-between; gap: var(--mu-space-3); }
    /* The close control is a quiet x. Its name and its tooltip are the close label of the application. */
    button[part="close"][data-control-display="icon"] { border-color: transparent; background: transparent; margin-inline-end: calc(-1 * var(--mu-space-2)); }
    h2 { min-inline-size: 0; margin: 0; font: var(--mu-type-heading-3); }
    button {
      min-inline-size: var(--mu-target); min-block-size: var(--mu-target); max-inline-size: 40%;
      padding: var(--mu-space-2); font: inherit; cursor: pointer;
      color: inherit; background: var(--mu-color-surface);
      border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2);
    }
    .body { margin-block-start: var(--mu-space-3); }
    @media (forced-colors: active) {
      dialog { color: CanvasText; background: Canvas; border-color: CanvasText; }
      dialog::backdrop { background: CanvasText; opacity: 0.48; }
      button { color: ButtonText; background: ButtonFace; border-color: ButtonText; }
    }
  `)];

  #dialog = null;
  #controls = null;

  attributeChangedCallback() {
    this.#controls?.render();
  }

  open() {
    const dialog = this.#dialog;
    if (!this.isConnected || !dialog || dialog.open) return;
    dialog.showModal();
    if (dialog === this.#dialog && dialog.open) this.dataset.state = 'open';
    this.dispatchEvent(new CustomEvent('mu-dialog-open', { bubbles: true, composed: true }));
  }

  close() {
    const dialog = this.#dialog;
    if (!dialog?.open) return;
    this.#controls?.dismiss();
    dialog.close();
    if (dialog === this.#dialog && !dialog.open && this.dataset.state === 'open') this.dataset.state = 'default';
  }

  disconnectedCallback() {
    this.close();
  }

  check(data) {
    return ['title', 'close_label'].filter((field) => !data[field].trim()).map((field) => 'data.' + field + ': give text');
  }

  refuse(errors) {
    this.close();
    this.#dialog = null;
    super.refuse(errors);
  }

  render(data) {
    this.close();
    const close = el('button', { type: 'button', part: 'close', 'aria-label': data.close_label });
    const title = el('h2', { id: 'title', part: 'title' }, data.title);
    const header = el('div', { class: 'header' }, title, close);
    const tooltip = el('span', { part: 'tooltip', 'aria-hidden': 'true' });
    this.#controls = compactControls(this, header, tooltip, [{ button: close, label: data.close_label, graphic: icon('cross') }]);
    const dialog = el('dialog', { part: 'dialog', 'aria-labelledby': 'title', 'aria-modal': 'true' },
      header,
      el('div', { class: 'body', part: 'body' }, el('slot')));
    close.addEventListener('click', () => this.close());
    // The native close event covers Escape, the close button and page calls to close().
    dialog.addEventListener('close', () => {
      if (dialog === this.#dialog && !dialog.open && this.dataset.state === 'open') this.dataset.state = 'default';
      this.dispatchEvent(new CustomEvent('mu-dialog-close', { bubbles: true, composed: true }));
    });
    this.#dialog = dialog;
    return [dialog];
  }
}

export class MuDrawer extends MuDialog {
  static component = 'drawer';
  static styles = [...MuDialog.styles, sheet(`
    dialog {
      inset: 0; margin: 0; margin-inline-start: auto;
      inline-size: min(26rem, 100%); block-size: 100%; max-block-size: 100%;
      border-radius: var(--mu-radius-3) 0 0 var(--mu-radius-3);
    }
    dialog:dir(rtl) { border-radius: 0 var(--mu-radius-3) var(--mu-radius-3) 0; }
    @media (max-width: 30rem) {
      dialog, dialog:dir(rtl) {
        margin-inline: 0; margin-block-start: auto;
        inline-size: 100%; block-size: fit-content; max-block-size: 80dvb;
        border-radius: var(--mu-radius-3) var(--mu-radius-3) 0 0;
      }
    }
  `)];
}
