// The change review app. An agent proposes a timetable change with a citation and excerpts of the sources.
// A reviewer approves or rejects it. Each decision has a confirm step, and the page shows the reference of the
// receipt in the decision log. The API decides and keeps the log. All data is synthetic.
import { define } from '../../../src/components/index.js';
import { define as defineThread } from '../../../src/thread/index.js';
import { Feed, alert, api, node, post } from '../app.js';

define();
defineThread();

const VERSION = '0.1.0';
const LOG = { type: 'system', id: 'change-api', name: 'Change log' };
const STATUS = { open: 'Open', approved: 'Approved', rejected: 'Rejected' };
const main = document.getElementById('main');
const list = document.getElementById('changes');
const log = document.getElementById('log');
const title = document.getElementById('change-title');
const detail = document.getElementById('change');
const cards = new Map();
// The change that is open, and the feed of its thread.
let opened = null;

function changeFill(item) {
  const fact = (label, value) => ({ component: 'fact', version: VERSION, data: { label, value } });
  return { component: 'card', version: VERSION, slots: { authorship: LOG }, data: {
    title: `${item.id} ${item.title}`, date: item.start, date_label: 'Starts', facts: [fact('Status', STATUS[item.status])],
  } };
}

async function showChanges() {
  const { changes } = await api('/changes');
  for (const item of changes) {
    if (!cards.has(item.id)) {
      const card = document.createElement('mu-card');
      card.actor = LOG;
      const open = document.createElement('mu-button');
      open.slot = 'actions';
      open.fill = { component: 'button', version: VERSION, data: { label: `Open ${item.id}` } };
      open.addEventListener('mu-press', () => openChange(item.id));
      card.append(open);
      cards.set(item.id, card);
      list.append(card);
    }
    cards.get(item.id).fill = changeFill(item);
  }
  return changes;
}

async function showLog() {
  const { log: entries } = await api('/changes/log');
  if (!entries.length) return log.replaceChildren(node('p', { class: 'muted' }, 'No decisions yet.'));
  log.replaceChildren(node('ul', { class: 'log', 'aria-label': 'Decision log' },
    ...entries.map((entry) => node('li', {}, `${entry.reference}: ${entry.change} ${STATUS[entry.status].toLowerCase()}. ${entry.title}.`))));
}

// The application binds each decision tool and its confirm step. The agent cannot select a tool.
function decision(id, tool, word, message) {
  const label = `${word} ${id}`;
  const button = document.createElement('mu-action-button');
  button.action = { tool, label, arguments: { change_id: id }, confirm: { message, label: `Yes, ${word.toLowerCase()}` } };
  button.fill = { component: 'action-button', version: VERSION, data: { label } };
  return button;
}

async function openChange(id) {
  const changes = await showChanges();
  const item = changes.find((change) => change.id === id);
  title.textContent = `${item.id}: ${item.title}`;
  const thread = document.createElement('mu-thread');
  const feed = new Feed(thread, `/changes/${id}/events`);
  const parts = [thread];
  if (item.status === 'open') {
    parts.push(node('h3', {}, 'Your decision'), node('div', { class: 'actions' },
      decision(id, 'change.approve', 'Approve', `Approve ${id}? The timetable changes on ${item.start}.`),
      decision(id, 'change.reject', 'Reject', `Reject ${id}? The planning team gets your decision.`)));
  } else {
    parts.push(node('p', {}, `This change is ${STATUS[item.status].toLowerCase()}.`));
  }
  detail.replaceChildren(...parts);
  opened = { id, feed };
  title.focus();
  try {
    await feed.sync();
  } catch (error) {
    alert(detail, error);
  }
}

// Each decision goes to the API. The button shows Pending until the receipt comes back.
detail.addEventListener('mu-action', async (event) => {
  const button = event.target;
  const request = event.detail;
  const { id, feed } = opened;
  try {
    button.receipt(await post(request));
  } catch (error) {
    button.receipt({ id: request.id, ok: false, message: 'The API gave no receipt. ' + error.message });
    return;
  }
  // The status, the log and the thread come from the API again, not from the page.
  try {
    await Promise.all([showChanges(), showLog(), opened.id === id ? feed.sync() : null]);
  } catch (error) {
    alert(log, error);
  }
});

async function load() {
  try {
    await Promise.all([showChanges(), showLog()]);
    main.dataset.state = 'ready';
  } catch (error) {
    alert(list, error);
  }
}

load();
