import { el, sheet } from '../render/dom.js';

export const BADGE_LABEL_CSS = sheet(`
  [data-badge] {
    font: var(--mu-type-caption); color: var(--mu-color-text); background: var(--mu-color-surface);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2);
    padding: var(--mu-space-1) var(--mu-space-2); min-inline-size: 0; overflow-wrap: anywhere;
  }
  :where([data-badge]).info { background: var(--mu-color-info); color: var(--mu-color-on-info); border-color: currentColor; }
  :where([data-badge]).success { background: var(--mu-color-success); color: var(--mu-color-on-success); border-color: currentColor; }
  :where([data-badge]).warning { background: var(--mu-color-warning); color: var(--mu-color-on-warning); border-color: currentColor; }
  :where([data-badge]).danger { border-color: var(--mu-color-danger); }
  @media (forced-colors: active) {
    [data-badge] { color: CanvasText; background: Canvas; border-color: CanvasText; }
  }
`);

export function badgeLabel(words, tone, attributes) {
  const label = el('span', { ...attributes, class: tone }, words);
  label.dataset.badge = '';
  return label;
}

const APPROVAL_STATES = Object.freeze({
  approved: { words: 'Approved', tone: 'success' },
  pending: { words: 'Pending approval', tone: 'warning' },
  rejected: { words: 'Rejected', tone: 'danger' },
  error: { tone: 'danger' },
});

export const APPROVAL_MARK_CSS = sheet(`
  [part="approval-mark"] {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--mu-space-1);
    font: var(--mu-type-caption); overflow-wrap: anywhere;
  }
`);

// A named group keeps the state and its details together without a live announcement.
export function approvalMark({ state, by, at }, words = APPROVAL_STATES[state]?.words) {
  const details = (by ? ' by ' + by : '') + (at ? ' at ' + at : '');
  return el('span', { part: 'approval-mark', role: 'group', 'aria-label': 'Approval: ' + words },
    badgeLabel(words, APPROVAL_STATES[state]?.tone ?? 'neutral'),
    details ? el('span', {}, details) : null);
}
