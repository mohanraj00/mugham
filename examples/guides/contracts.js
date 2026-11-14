// The code of docs/guides/contracts.md. All data is synthetic and neutral.
import { MuElement, define, provenance, register } from '../../src/components/index.js';
import { el, sheet } from '../../src/render/dom.js';
import { CONTRACTS } from '../../src/render/registry.js';
import { fillErrors } from '../../src/render/validate.js';
import BIRD_COUNT from './bird-count.json' with { type: 'json' };

define();
const main = document.getElementById('main');

// 1. A fill of the card contract. The application binds the actor before the fill.
const AGENT = { type: 'agent', id: 'agent-notes', name: 'Note helper' };
const card = document.createElement('mu-card');
card.actor = AGENT;
card.fill = {
  component: 'card',
  version: '0.1.0',
  data: {
    title: 'Tide table for the north pier',
    summary: 'High water at 06:10 and at 18:40.',
    facts: [{ component: 'fact', version: '0.1.0', data: { label: 'Pier', value: 'North' } }],
  },
  slots: {
    authorship: AGENT,
    citation: { source: 'Synthetic tide notes, page 2', locator: 'https://example.org/tides#page-2' },
  },
};
main.append(card);

// 2. The validator gives each error with a path. It does not change the fill.
const tide = (data, slots = { authorship: AGENT }) => ({ component: 'card', version: '0.1.0', data, slots });
const bad = {
  'an undeclared component': { component: 'banner', version: '0.1.0', data: {} },
  'an undeclared field': tide({ title: 'Tide table', style: 'color: red' }),
  'an actions key of format 1': { ...tide({ title: 'Tide table' }), actions: [] },
  'no authorship slot': tide({ title: 'Tide table' }, {}),
  'a title that is too long': tide({ title: 'x'.repeat(121) }),
};
const list = document.getElementById('errors');
for (const [name, fill] of Object.entries(bad)) {
  list.append(el('li', {}, `${name}: ${fillErrors(fill, CONTRACTS)[0]}`));
}

// 3. Markup in a text field shows as text. The element makes no node from it.
const markup = document.createElement('mu-card');
markup.actor = AGENT;
markup.fill = tide({ title: '<b>Bold tide</b>' });
main.append(markup);

// 4. An agent cannot name a person as the author. The element refuses the fill.
const claim = document.createElement('mu-card');
claim.actor = AGENT;
claim.fill = tide({ title: 'Tide table' }, { authorship: { type: 'human', id: 'u-robin', name: 'Robin' } });
main.append(claim);

// 5. An application contract and its element.
class BirdCount extends MuElement {
  static component = 'bird-count';
  static styles = [sheet(`
    article { background: var(--mu-color-surface); color: var(--mu-color-text); font: var(--mu-type-body);
      border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); padding: var(--mu-space-4); }
    p { margin: 0 0 var(--mu-space-2); }
    .muted { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
    @media (forced-colors: active) { article { border-color: CanvasText; } .muted { color: CanvasText; } }
  `)];

  render(data) {
    return [el('article', { 'aria-label': data.site },
      el('p', {}, data.site),
      el('p', {}, `${data.count} birds on ${data.date}`),
      el('div', { class: 'muted' }, provenance(this.fill.slots)))];
  }
}
register(BIRD_COUNT, BirdCount); // Defines mu-app-bird-count.

const count = (value) => {
  const node = document.createElement('mu-app-bird-count');
  node.actor = AGENT;
  node.fill = { component: 'bird-count', version: '0.1.0', data: { site: 'East marsh', date: '2026-11-02', count: value },
    slots: { authorship: AGENT } };
  return node;
};
main.append(count(42), count(500));
