// An example page with an application contract and element. The page acts as the application. It registers
// the seed-tray contract (seed-tray.json) and its element, then shows fills of an agent, directly and in a
// thread. The kit validates each fill against the registered contract. All data is synthetic and neutral.
import { MuElement, define, provenance, register } from '../src/components/index.js';
import { define as defineThread } from '../src/thread/index.js';
import { el, sheet } from '../src/render/dom.js';
import SEED_TRAY from './seed-tray.json' with { type: 'json' };

const CSS = sheet(`
  :host { display: block; }
  article {
    background: var(--mu-color-surface); color: var(--mu-color-text); font: var(--mu-type-body);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); padding: var(--mu-space-4);
    display: flex; flex-direction: column; gap: var(--mu-space-2);
  }
  p { margin: 0; overflow-wrap: anywhere; }
  .title { font-weight: var(--mu-type-weight-strong); }
  .muted { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
  @media (forced-colors: active) { article { border-color: CanvasText; } .muted { color: CanvasText; } }
`);
const STAGES = { sown: 'Sown', sprouted: 'Sprouted', ready: 'Ready to plant out' };

// The element builds its nodes only with el, so each text value stays text.
class SeedTray extends MuElement {
  static component = 'seed-tray';
  static styles = [CSS];

  render(data) {
    return [el('article', { 'aria-label': data.label, part: 'tray' },
      el('p', { class: 'title' }, data.label),
      el('p', {}, `${data.seedlings} seedlings, sown ${data.sown}`),
      el('p', { class: 'muted' }, `Stage: ${STAGES[data.stage]}`),
      data.note ? el('p', {}, data.note) : null,
      provenance(this.fill.slots))];
  }
}

define();
defineThread();
register(SEED_TRAY, SeedTray);

const AGENT = { type: 'agent', id: 'agent-garden', name: 'Garden helper' };
const tray = (data) => ({ component: 'seed-tray', version: '0.1.0', data, slots: { authorship: AGENT } });

function caption(words) {
  const node = document.createElement('p');
  node.textContent = words;
  return node;
}

function make(fill) {
  const node = document.createElement('mu-app-seed-tray');
  node.actor = AGENT;
  node.fill = fill;
  return node;
}

// A valid fill. The element shows it.
const valid = make(tray({ label: 'Tray A1', sown: '2026-03-02', seedlings: 24, stage: 'sprouted' }));
// The contract permits 200 seedlings at most, so the element refuses this fill.
const invalid = make(tray({ label: 'Tray A2', sown: '2026-03-02', seedlings: 500, stage: 'sown' }));

// A thread with a message of the agent. The note has a markup string, and the element shows it as text.
// The second snapshot names an undeclared component, so the thread shows a refusal.
const thread = document.createElement('mu-thread');
const metadata = { mugham: { actor: AGENT } };
const note = 'Water from below. <b>Do not</b> water the leaves.';

document.getElementById('main').append(caption('A registered seed tray:'), valid,
  caption('A seed tray with too many seedlings (the kit refuses it):'), invalid,
  caption('A thread with a seed tray and an undeclared component:'), thread);

thread.read([
  { type: 'RUN_STARTED', threadId: 'garden', runId: 'r1' },
  { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant', metadata },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Tray B2 is ready to plant out.' },
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
  { type: 'ACTIVITY_SNAPSHOT', messageId: 'p1', activityType: 'mugham.fill', metadata,
    content: { format: 2, fill: tray({ label: 'Tray B2', sown: '2026-02-20', seedlings: 18, stage: 'ready', note }) } },
  { type: 'ACTIVITY_SNAPSHOT', messageId: 'p2', activityType: 'mugham.fill', metadata,
    content: { format: 2, fill: { component: 'banner', version: '0.1.0', data: { text: 'Sale' } } } },
  { type: 'RUN_FINISHED', threadId: 'garden', runId: 'r1' },
]);
