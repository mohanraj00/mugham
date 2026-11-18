// A page that browses versioned records, built with the kit. The page acts as the application. A fixture API
// (snapshots-api.js) gives the collections, the snapshots, the compare result of two snapshots and the impact of the
// change. The page only reads: it has no action and sends no request that changes a record. All data are synthetic.
import { define } from '../src/components/index.js';
import { SnapshotApi } from './snapshots-api.js';

define();

const api = new SnapshotApi();
const fill = (component, data) => ({ component, version: '0.1.0', data });
// The page and the fixture API own the content, so the actor of each fill is the system.
const SYSTEM = { type: 'system', id: 'snapshot-store', name: 'Snapshot store' };

function make(tag, value) {
  const node = document.createElement(tag);
  node.actor = SYSTEM;
  node.fill = { ...value, slots: { authorship: SYSTEM } };
  return node;
}

function text(tag, words, attributes = {}) {
  const node = document.createElement(tag);
  node.textContent = words;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

const table = (label, columns, rows) => make('mu-table', fill('table', { label, columns, rows: rows.map((cells) => fill('table-row', { cells })) }));

const main = document.getElementById('main');
const collections = document.createElement('section');
const snapshots = document.createElement('section');
const comparison = document.createElement('section');
for (const [node, name] of [[collections, 'collections'], [snapshots, 'snapshots'], [comparison, 'comparison']]) {
  node.id = name;
  node.setAttribute('aria-live', 'polite');
}
// Only the newest answer of the fixture API shows.
const latest = { collection: 0, compare: 0 };

async function showCollections() {
  const items = await api.collections();
  const picks = document.createElement('ul');
  picks.className = 'queue-picks';
  picks.setAttribute('aria-label', 'Collections to open');
  for (const item of items) {
    const entry = document.createElement('li');
    const button = text('button', `Open ${item.name}`, { type: 'button', 'aria-pressed': 'false' });
    button.addEventListener('click', () => {
      for (const other of picks.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
      showSnapshots(item);
    });
    entry.append(button);
    picks.append(entry);
  }
  collections.replaceChildren(text('h2', 'Collections'),
    table('Collections', ['Collection', 'Snapshots', 'Latest'], items.map((item) => [item.name, String(item.snapshots), item.latest])), picks);
}

async function showSnapshots(collection) {
  latest.collection += 1;
  const mine = latest.collection;
  const items = await api.snapshots(collection.id);
  if (mine !== latest.collection) return;
  comparison.replaceChildren();
  const select = (name, words, value) => {
    const label = document.createElement('label');
    const control = document.createElement('select');
    control.name = name;
    for (const item of items) control.append(Object.assign(document.createElement('option'), { value: item.id, textContent: `${item.id}, ${item.taken}` }));
    control.value = value;
    label.append(words, control);
    return label;
  };
  const controls = document.createElement('div');
  controls.className = 'snap-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', `Compare snapshots of ${collection.name}`);
  const compare = text('button', 'Compare snapshots', { type: 'button' });
  const from = select('from', 'From snapshot', items[0].id);
  const to = select('to', 'To snapshot', items.at(-1).id);
  compare.addEventListener('click', () => showComparison(collection, from.querySelector('select').value, to.querySelector('select').value));
  controls.append(from, to, compare);
  snapshots.replaceChildren(text('h2', `Snapshots of ${collection.name}`),
    table(`Snapshots of ${collection.name}`, ['Snapshot', 'Taken', 'Records', 'Note'], items.map((item) => [item.id, item.taken, String(item.records), item.note])), controls);
}

async function showComparison(collection, fromId, toId) {
  latest.compare += 1;
  const mine = latest.compare;
  const [result, affected] = await Promise.all([api.compare(collection.id, fromId, toId), api.impact(collection.id, fromId, toId)]);
  if (mine !== latest.compare) return;
  const change = ({ label, change: kind, before, after }) => fill('diff-change', { label, change: kind,
    ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) });
  const diff = make('mu-diff', fill('diff', { title: `${collection.name}: ${fromId} to ${toId}`, before_label: `${fromId}, ${result.from.taken}`,
    after_label: `${toId}, ${result.to.taken}`, parts: [fill('diff-part', { title: 'Records', changes: result.changes.map(change) })] }));
  const impact = document.createElement('ul');
  impact.className = 'snap-impact';
  impact.setAttribute('aria-label', 'Records that the change affects');
  for (const item of affected) impact.append(text('li', `${item.record} (${item.collection}): ${item.reason}`));
  comparison.replaceChildren(text('h2', 'Compare result'), diff, text('h2', 'Impact of the change'),
    affected.length ? impact : text('p', 'No record depends on the changed records.', { id: 'no-impact' }));
}

main.append(text('h1', 'Mugham snapshots'),
  text('p', 'The page acts as the application. A fixture API gives the snapshots of versioned records. The page only reads. Open a collection, pick two snapshots and compare them.'),
  collections, snapshots, comparison);
showCollections();
