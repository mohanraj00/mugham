import { MuElement } from '../primitives/base.js';
import { BADGE_LABEL_CSS, badgeLabel } from '../primitives/badge.js';
import { el, FLOATING_TOOLTIP_CSS, floatingTooltip, sheet } from '../render/dom.js';

const STATES = Object.freeze({
  up: { text: 'Up', tone: 'success' },
  refused: { text: 'Refused', tone: 'danger' },
  unreachable: { text: 'Unreachable', tone: 'warning' },
});

function metadata({ reason, checked, group, version }) {
  return [
    group && 'Group: ' + group,
    version && 'Version: ' + version,
    checked && 'Checked: ' + checked,
    reason && 'Reason: ' + reason,
  ].filter(Boolean).join('\n');
}

export class MuServiceStatus extends MuElement {
  static component = 'service-status';
  static styles = [BADGE_LABEL_CSS, FLOATING_TOOLTIP_CSS, sheet(`
    :host { display: block; position: relative; min-inline-size: 0; color: var(--mu-color-text); font: var(--mu-type-body); }
    ul { display: flex; flex-wrap: wrap; gap: var(--mu-space-2); margin: 0; padding: 0; list-style: none; }
    ul[hidden] { display: none; }
    li { display: flex; min-inline-size: min(100%, 7.5rem); max-inline-size: 100%; }
    p { margin: 0; }
    .summary {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: var(--mu-space-1) var(--mu-space-2); inline-size: 100%; min-block-size: 44px;
      padding: var(--mu-space-1) var(--mu-space-2); border: 1px solid var(--mu-color-border);
      border-radius: var(--mu-radius-2); background: var(--mu-color-surface); color: inherit;
      font: var(--mu-type-caption); text-align: start; overflow-wrap: anywhere;
    }
    [part="label"] { min-inline-size: 0; }
    button.summary { cursor: pointer; }
    [part="metadata"] { max-inline-size: min(22rem, calc(100% - 16px)); white-space: pre-wrap; }
    .announcement {
      position: absolute; inset-block-start: 0; inset-inline-start: 0;
      inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
    }
    @media (forced-colors: active) {
      .summary { color: CanvasText; background: Canvas; border-color: CanvasText; }
      button.summary { color: ButtonText; background: ButtonFace; border-color: ButtonText; }
    }
  `)];

  #view = null;
  #rows = new Map();
  #panelCount = 0;
  #close = null;

  disconnectedCallback() {
    this.#close?.();
  }

  refuse(errors) {
    this.#close?.();
    this.#view = null;
    this.#rows.clear();
    super.refuse(errors);
  }

  state({ services }) {
    return services.length ? 'default' : 'empty';
  }

  #makeRow(labelText, details) {
    const row = el('li', { part: 'service' });
    const label = el('span', { part: 'label' }, labelText);
    if (!details) {
      const summary = el('div', { class: 'summary' }, label, ' ');
      row.append(summary);
      return { row, summary };
    }

    const id = 'service-details-' + ++this.#panelCount;
    const panel = el('div', { id, part: 'metadata', role: 'tooltip' }, details);
    const trigger = el('button', { type: 'button', class: 'summary', part: 'trigger',
      'aria-describedby': id, 'aria-expanded': 'false' }, label, ' ');
    row.append(trigger);
    const tooltip = floatingTooltip(row, panel);

    let listeners;
    const close = () => {
      if (this.#close !== close) return;
      this.#close = null;
      listeners.abort();
      tooltip.hide();
      trigger.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      if (this.#close === close || !trigger.isConnected) return;
      this.#close?.();
      this.#close = close;
      listeners = new AbortController();
      tooltip.show(trigger);
      trigger.setAttribute('aria-expanded', 'true');
      this.ownerDocument.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.isComposing) return;
        close();
        if (event.composedPath().includes(row)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, { capture: true, signal: listeners.signal });
    };
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') open();
    });
    row.addEventListener('pointerleave', () => {
      if (this.shadowRoot.activeElement !== trigger) close();
    });
    trigger.addEventListener('focus', open);
    trigger.addEventListener('blur', () => {
      if (!row.matches(':hover')) close();
    });
    trigger.addEventListener('click', open);
    return { row, summary: trigger, panel, close };
  }

  render({ services }) {
    const firstFill = this.#view === null;
    if (firstFill) {
      const list = el('ul', { role: 'list' });
      const empty = el('p', { part: 'empty' }, 'No services. Check again later.');
      this.#view = {
        strip: el('div', { role: 'group', part: 'strip', 'aria-label': 'Service status' }, list, empty),
        list, empty, announcement: el('div', { class: 'announcement', role: 'status', 'aria-live': 'polite' }),
      };
    }
    const { strip, list, empty, announcement } = this.#view;
    list.hidden = services.length === 0;
    empty.hidden = !list.hidden;

    const next = new Map();
    const counts = new Map();
    const changes = [];
    for (const service of services) {
      const { label, state, group } = service;
      const name = JSON.stringify([label, group]);
      const count = counts.get(name) ?? 0;
      counts.set(name, count + 1);
      const key = name + count;
      const details = metadata(service);
      const old = this.#rows.get(key);
      const entry = old && Boolean(old.panel) === Boolean(details) ? old : this.#makeRow(label, details);
      const { text, tone } = STATES[state];
      if (old && old.state !== state) changes.push(`${label}${group ? ' (' + group + ')' : ''}: ${text}.`);
      if (entry.state !== state) {
        const badge = badgeLabel(text, tone, { part: 'state' });
        if (entry.badge) entry.badge.replaceWith(badge);
        else entry.summary.append(badge);
        entry.badge = badge;
        entry.state = state;
      }
      if (entry.panel && entry.panel.textContent !== details) entry.panel.textContent = details;
      next.set(key, entry);
    }
    for (const [key, entry] of this.#rows) {
      if (next.get(key) === entry) continue;
      entry.close?.();
      entry.row.remove();
    }
    const active = this.shadowRoot.activeElement;
    let before = null;
    for (const { row, summary } of [...next.values()].reverse()) {
      // Move the other items around the focused control.
      if (active !== summary && (row.parentNode !== list || row.nextElementSibling !== before)) {
        list.insertBefore(row, before);
      }
      before = row;
    }
    this.#rows = next;
    // Keep one live region in the DOM and write all changes from the fill at once.
    if (changes.length) announcement.textContent = changes.join(' ');
    return firstFill ? [strip, announcement] : null;
  }
}
