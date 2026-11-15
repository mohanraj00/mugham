// An example of an offline data source (docs/contracts/data-source.md). The page acts as the application. Its
// in-memory source holds synthetic records of a tool library. The buttons change the network and the source, so
// the page shows each state: ready, stale, empty and error, offline and online. The kit only checks and shows.
import { define } from '../src/components/index.js';
import { read, statusFill } from '../src/offline/source.js';

define();

const SYSTEM = { type: 'system', id: 'tool-library', name: 'Tool library' };
const TOOLS = [
  { key: 'T-01', name: 'Ladder', shelf: 'A', loans: 3 },
  { key: 'T-02', name: 'Drill', shelf: 'B', loans: 0 },
  { key: 'T-03', name: 'Garden fork', shelf: 'A', loans: 5 },
];

// The source of the application. Online, it reads the service and keeps a copy. Offline, it gives the copy as
// stale. The service is in memory too: a real application reads its own API.
class MemorySource {
  service = TOOLS.map((item) => ({ ...item }));
  online = true;
  broken = false;
  copy = null;
  checked = null;

  async list(filter) {
    if (this.broken) throw new Error('The bundle is damaged.');
    if (this.online) {
      this.copy = this.service.map((item) => ({ ...item }));
      this.checked = new Date().toISOString();
    }
    if (!this.copy) return { state: 'error', records: [], reason: 'The device is offline, and the source has no copy.' };
    const records = this.copy.slice(0, filter.limit ?? 100);
    const state = records.length ? (this.online ? 'ready' : 'stale') : 'empty';
    return { state, records, checked: this.checked, ...(state === 'stale' ? { reason: 'The device is offline.' } : {}) };
  }
}

const source = new MemorySource();
const main = document.getElementById('main');
const status = document.createElement('mu-source-status');
const records = document.createElement('div');
const controls = document.createElement('div');
controls.className = 'controls';

function button(id, words, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.id = id;
  node.textContent = words;
  node.addEventListener('click', () => { action(); refresh(); });
  controls.append(node);
}

button('network', 'Go offline', () => {
  source.online = !source.online;
  document.getElementById('network').textContent = source.online ? 'Go offline' : 'Go online';
});
button('damage', 'Damage the source', () => {
  source.broken = !source.broken;
  document.getElementById('damage').textContent = source.broken ? 'Repair the source' : 'Damage the source';
});
button('records', 'Remove the records from the service', () => {
  source.service = source.service.length ? [] : TOOLS.map((item) => ({ ...item }));
  document.getElementById('records').textContent = source.service.length ? 'Remove the records from the service' : 'Restore the records on the service';
});

// Only the result of the newest read shows. The page shows records only for ready or stale.
let latest = 0;
async function refresh() {
  latest += 1;
  const mine = latest;
  const result = await read(source, { list: { limit: 50 } }, { timeout: 2000 });
  if (mine !== latest) return;
  status.fill = statusFill('Tool library', result);
  records.replaceChildren();
  if (result.state !== 'ready' && result.state !== 'stale') return;
  const grid = document.createElement('mu-card-grid');
  grid.actor = SYSTEM;
  grid.fill = { component: 'card-grid', version: '0.1.0', slots: { authorship: SYSTEM }, data: { label: 'Tools', cards: result.records.map((item) => ({
    component: 'card', version: '0.1.0', data: { title: item.name, facts: [
      { component: 'fact', version: '0.1.0', data: { label: 'Shelf', value: item.shelf } },
      { component: 'fact', version: '0.1.0', data: { label: 'Loans', value: String(item.loans) } }] } })) } };
  records.append(grid);
}

const title = document.createElement('h1');
title.textContent = 'Mugham offline source';
const note = document.createElement('p');
note.textContent = 'The page acts as the application. Its source holds synthetic records. Use the buttons to change the network and the source.';
main.append(title, note, controls, status, records);
refresh();
