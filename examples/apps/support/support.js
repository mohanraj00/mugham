// The support desk app. A person opens a ticket from the queue. The thread shows the customer, a person on the
// team and two agents. The reply agent drafts a reply in an editable form. The person corrects it and sends it.
// The form shows Done only after the receipt of the API comes back. All data is synthetic.
import { define } from '../../../src/components/index.js';
import { define as defineThread } from '../../../src/thread/index.js';
import { Feed, alert, api, node, post } from '../app.js';

define();
defineThread();

const VERSION = '0.1.0';
// The help desk API gives the queue, so the queue cards name it as the author.
const DESK = { type: 'system', id: 'desk-api', name: 'Help desk' };
const STATUS = { open: 'Open', answered: 'Answered' };
const main = document.getElementById('main');
const queue = document.getElementById('queue');
const title = document.getElementById('ticket-title');
const ticket = document.getElementById('ticket');
const cards = new Map();

function ticketFill(item) {
  const fact = (label, value) => ({ component: 'fact', version: VERSION, data: { label, value } });
  return { component: 'card', version: VERSION, slots: { authorship: DESK }, data: {
    title: `${item.id} ${item.title}`, summary: `From ${item.customer}`, date: item.opened, date_label: 'Opened',
    facts: [fact('Priority', item.priority), fact('Channel', item.channel), fact('Status', STATUS[item.status])],
  } };
}

// The queue is a grid of cards. The application puts an open button in the actions slot of each card.
async function showQueue() {
  const { tickets } = await api('/support/tickets');
  if (!cards.size) {
    const grid = document.createElement('mu-grid');
    grid.fill = { component: 'grid', version: VERSION, data: { label: 'Ticket queue', min_column: 'medium', gap: 'medium' } };
    for (const item of tickets) {
      const card = document.createElement('mu-card');
      card.actor = DESK;
      const open = document.createElement('mu-button');
      open.slot = 'actions';
      open.fill = { component: 'button', version: VERSION, data: { label: `Open ${item.id}` } };
      open.addEventListener('mu-press', () => openTicket(item));
      card.append(open);
      cards.set(item.id, card);
      grid.append(card);
    }
    queue.replaceChildren(grid);
  }
  for (const item of tickets) cards.get(item.id).fill = ticketFill(item);
}

// The application binds the tool. The fill of the agent gives only the draft, and the form refuses a different title.
function binding(id) {
  return { tool: 'desk.send_reply', label: 'Send reply', title: `Reply to ${id}`, arguments: { ticket_id: id },
    editable: { to: 'To', reply: 'Reply' } };
}

async function openTicket(item) {
  title.textContent = `${item.id}: ${item.title}`;
  const thread = document.createElement('mu-thread');
  const feed = new Feed(thread, `/support/tickets/${item.id}/events`);
  thread.bind = (fill) => (fill.component === 'editable-form' ? binding(item.id) : undefined);
  thread.perform = async (request) => {
    const receipt = await post(request);
    // The receipt goes to the form first. Then the page reads the new state of the API.
    if (receipt.ok) setTimeout(() => Promise.all([showQueue(), feed.sync()]).catch((error) => alert(ticket, error)), 0);
    return receipt;
  };
  ticket.replaceChildren(node('p', { class: 'muted' }, `Customer: ${item.customer}. Priority: ${item.priority}.`), thread);
  title.focus();
  try {
    await feed.sync();
  } catch (error) {
    alert(ticket, error);
  }
}

async function load() {
  try {
    await showQueue();
    main.dataset.state = 'ready';
  } catch (error) {
    alert(queue, error);
  }
}

load();
