// An example approval page. The page acts as the application, and tools/approval_server.py is its fixture API.
// The page keeps no approval state of its own. It shows the decisions and the receipts that the API gives.
// A real workflow service can take the place of the fixture API through its own HTTP API. See approval.md.
import { define } from '../src/components/index.js';

define();

const API = '/api';
const VERSION = '0.1.0';
const ACTIONS = [['approval.approve', 'Approve'], ['approval.reject', 'Reject']];
const main = document.getElementById('main');

async function call(path, options) {
  const response = await fetch(API + path, options);
  if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
  return response.json();
}

// The fill of a decision card. The evidence and the status come from the API, and they show only as text.
function decisionFill(decision) {
  const fact = (label, value) => ({ component: 'fact', version: VERSION, data: { label, value } });
  return { component: 'card', version: VERSION, slots: { authorship: decision.author }, data: {
    title: decision.title, summary: decision.summary, date: decision.due, date_label: 'Due',
    facts: [...decision.evidence.map((item) => fact(item.label, item.value)), fact('Status', decision.status)],
  } };
}

function decisionCard(decision) {
  const card = document.createElement('mu-card');
  // The application trusts its API for the author of each decision. The authorship slot names the same actor.
  card.actor = decision.author;
  card.fill = decisionFill(decision);
  for (const [tool, word] of ACTIONS) {
    const label = `${word} ${decision.id}`;
    const button = document.createElement('mu-action-button');
    button.slot = 'actions';
    button.action = { tool, label, arguments: { decision_id: decision.id } };
    button.fill = { component: 'action-button', version: VERSION, data: { label } };
    card.append(button);
  }
  return card;
}

// Each action goes to the API. The button shows pending until the receipt comes back, and the API decides.
document.addEventListener('mu-action', async (event) => {
  const button = event.target;
  const request = event.detail;
  const card = button.closest('mu-card');
  try {
    button.receipt(await call('/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }));
  } catch (error) {
    button.receipt({ id: request.id, ok: false, message: 'The API gave no receipt. ' + error.message });
    return;
  }
  // The status on the card comes from the API again, not from the page.
  try {
    card.fill = decisionFill(await call('/decisions/' + encodeURIComponent(request.arguments.decision_id)));
  } catch {
    // The receipt shows on the button. The status on the card stays as the API gave it before.
  }
});

async function load() {
  const title = document.createElement('h1');
  title.textContent = 'Open decisions';
  main.append(title);
  let decisions;
  try {
    ({ decisions } = await call('/decisions'));
  } catch (error) {
    const alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'The page cannot read the decisions. ' + error.message;
    main.append(alert);
    return;
  }
  if (decisions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No open decisions.';
    main.append(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'decisions';
  list.setAttribute('aria-label', 'Open decisions');
  for (const decision of decisions) {
    const item = document.createElement('li');
    item.append(decisionCard(decision));
    list.append(item);
  }
  main.append(list);
  main.dataset.state = 'ready';
}

load();
