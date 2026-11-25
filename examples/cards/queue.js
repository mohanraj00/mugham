// An example of the offline mode (docs/contracts/offline-queue.md). The page acts as the application, and
// tools/queue_server.py is its fixture API with a synthetic tool library. A person reserves a tool. Each action
// goes through the offline queue: offline, the action waits as pending, and after the device reconnects the queue
// sends it. The page reads the tools through the offline data source interface (docs/contracts/data-source.md),
// so an offline reload shows the last copy as stale. The service worker in queue-worker.js keeps the page files.
import { define } from '../../src/components/index.js';
import { createKit, fill, queueActions } from '../../src/kit.js';
import { memoryStore, openQueue, queueFill } from '../../src/offline/queue.js';
import { read, statusFill } from '../../src/offline/source.js';

define();

const API = '/api';
const COPY = 'mugham-example-tool-library';
const SYSTEM = { type: 'system', id: 'tool-library', name: 'Tool library' };
const kit = createKit({ actor: SYSTEM });
const main = document.getElementById('main');

// The network of the page. The button of the page sets simulated, so a person can try the offline mode with
// no change of the device. The queue reads online() and gets the online event from events.
const network = { simulated: false, events: new EventTarget() };
const online = () => navigator.onLine && !network.simulated;
for (const type of ['online', 'offline']) window.addEventListener(type, () => network.events.dispatchEvent(new Event(online() ? 'online' : 'offline')));

async function call(path, options) {
  const response = await fetch(API + path, options);
  if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
  return response.json();
}

// The send function of the queue. A real application adds its credential here, for example a header. The queue
// never gets it. A thrown error means that no receipt came back.
function send(request, { signal }) {
  return call('/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal });
}

// The data source of the application. Online, it reads the API and keeps a copy on the device. Offline, or if
// the API gives no answer, it gives the copy as stale.
const source = {
  async list(filter) {
    let fresh = false;
    if (online()) {
      try {
        const { tools } = await call('/tools');
        const records = tools.map((tool) => ({ key: tool.id, name: tool.name, shelf: tool.shelf, reserved: tool.reserved }));
        localStorage.setItem(COPY, JSON.stringify({ checked: new Date().toISOString(), records }));
        fresh = true;
      } catch {
        // The API gave no answer. The copy is stale.
      }
    }
    let copy = null;
    try {
      copy = JSON.parse(localStorage.getItem(COPY));
    } catch {
      copy = null;
    }
    if (!copy) return { state: 'error', records: [], reason: 'The device is offline, and the source has no copy.' };
    const records = copy.records.slice(0, filter.limit ?? 100);
    if (!records.length) return { state: 'empty', records, checked: copy.checked };
    return { state: fresh ? 'ready' : 'stale', records, checked: copy.checked, ...(fresh ? {} : { reason: 'The device has no answer from the service.' }) };
  },
};

const status = document.createElement('mu-source-status');
const pending = document.createElement('mu-action-queue');
const list = document.createElement('ul');
list.className = 'decisions';
list.setAttribute('aria-label', 'Tools');
// The card and the button of each tool stay the same nodes, so a button keeps its state after a new read.
const cards = new Map();

function toolData(tool) {
  return { title: tool.name, facts: [fill('fact', { label: 'Shelf', value: tool.shelf }),
    fill('fact', { label: 'Status', value: tool.reserved ? 'Reserved' : 'Free' })] };
}

// Only the result of the newest read shows. The page shows the tools only for ready or stale.
let latest = 0;
async function refresh() {
  latest += 1;
  const mine = latest;
  const result = await read(source, { list: { limit: 50 } }, { timeout: 4000 });
  if (mine !== latest) return;
  status.fill = statusFill('Tool library', result);
  list.hidden = result.state !== 'ready' && result.state !== 'stale';
  if (list.hidden) return;
  for (const tool of result.records) {
    if (cards.has(tool.key)) {
      cards.get(tool.key).fill = kit.outer('card', toolData(tool));
      continue;
    }
    const card = kit.mount('card', toolData(tool));
    const label = `Reserve ${tool.name}`;
    kit.mount('action-button', { label }, { parent: card, slot: 'actions', action: { tool: 'tool.reserve', label, arguments: { tool_id: tool.key } } });
    const item = document.createElement('li');
    item.append(card);
    list.append(item);
    cards.set(tool.key, card);
  }
  main.dataset.state = 'ready';
}

function button(id, words, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.id = id;
  node.textContent = words;
  node.addEventListener('click', () => action(node));
  return node;
}

// The fixture controls. They change the fixture API, not the kit.
async function fixture(change) {
  await call('/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) });
}
let serviceDown = false;
const controls = document.createElement('div');
controls.className = 'queue-actions';
controls.append(
  button('network', 'Go offline', (node) => {
    network.simulated = !network.simulated;
    node.textContent = network.simulated ? 'Go online' : 'Go offline';
    network.events.dispatchEvent(new Event(online() ? 'online' : 'offline'));
    refresh();
  }),
  button('service', 'Stop the service', async (node) => {
    await fixture({ service: serviceDown ? 'up' : 'down' });
    serviceDown = !serviceDown;
    node.textContent = serviceDown ? 'Start the service' : 'Stop the service';
    refresh();
  }),
  button('lose', 'Lose the next receipt', () => fixture({ lose_receipts: 1 })),
);

async function load() {
  const title = document.createElement('h1');
  title.textContent = 'Tool library';
  const note = document.createElement('p');
  note.textContent = 'The page acts as the application. Go offline, reserve a tool, then go online. The action shows as pending until its receipt comes back.';
  const kept = document.createElement('p');
  main.append(title, note, controls, status, pending, kept, list);

  // The queue keeps the actions in IndexedDB. If the device cannot open it, the page tells the person.
  const options = { name: 'tool-library', send, online, events: network.events, timeout: 4000 };
  let queue;
  try {
    queue = await openQueue(options);
  } catch {
    queue = await openQueue({ ...options, store: memoryStore() });
    kept.textContent = 'This device cannot keep the pending actions. A reload loses them.';
  }
  const show = (entries) => { pending.fill = queueFill('Pending actions', entries); };
  // After each receipt, the page reads the tools again. The API owns the state of each tool.
  queue.watch((entries, change) => {
    show(entries);
    if (change) refresh();
  });
  show(queue.entries);
  queueActions(main, queue);
  network.events.addEventListener('online', refresh);

  // The service worker keeps the files of this page, so the page loads offline. The page works without it.
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('queue-worker.js');
      await navigator.serviceWorker.ready;
      main.dataset.worker = 'ready';
    } catch {
      main.dataset.worker = 'none';
    }
  }
  await refresh();
}

load();
