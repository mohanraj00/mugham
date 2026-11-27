// An example approval page. The page acts as the application, and tools/approval_server.py is its fixture API.
// The page keeps no approval state of its own. It shows the decisions and the receipts that the API gives.
// A real workflow service can take the place of the fixture API through its own HTTP API. See approval.md.
import { define } from '../../src/components/index.js';
import { fill, mount, onAction, validateFill } from '../../src/kit.js';

define();

const API = '/api';
const ACTIONS = [['approval.approve', 'Approve', 'check'], ['approval.reject', 'Reject', 'cross']];
const main = document.getElementById('main');

async function call(path, options) {
  const response = await fetch(API + path, options);
  if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
  return response.json();
}

// The evidence and the status come from the API and show as text.
function decisionData(decision) {
  const fact = (label, value) => fill('fact', { label, value });
  return {
    title: decision.title, summary: decision.summary, date: decision.due, date_label: 'Due',
    facts: [...decision.evidence.map((item) => fact(item.label, item.value)), fact('Status', decision.status)],
  };
}

function decisionCard(decision) {
  const { author } = decision;
  const data = decisionData(decision);
  const slots = author === undefined ? undefined : { authorship: author };
  // Check the fill before the card binds the author.
  const actor = validateFill(fill('card', data, { slots })).length === 0 ? author : null;
  const card = mount('card', data, { actor, slots });
  if (!card.fill) return card;
  for (const [tool, word, icon] of ACTIONS) {
    const label = `${word} ${decision.id}`;
    const confirm = { message: `${word} ${decision.id}?`, label: `Confirm: ${word.toLowerCase()} ${decision.id}` };
    mount('action-button', { label, icon, display: 'icon' }, { parent: card, slot: 'actions',
      action: { tool, label, icon, display: 'icon', confirm, arguments: { decision_id: decision.id } } });
  }
  return card;
}

// Each action goes to the API. The button shows pending until the receipt comes back, and the API decides.
onAction(main, async (tool, args, id, request, button) => {
  const card = button.closest('mu-card');
  let receipt;
  try {
    receipt = await call('/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  } catch (error) {
    throw new Error('The API gave no receipt. ' + error.message);
  }
  // Read the status from the API after the receipt.
  setTimeout(async () => {
    try {
      const decision = await call('/decisions/' + encodeURIComponent(args.decision_id));
      card.fill = fill('card', decisionData(decision), { slots: { authorship: decision.author } });
    } catch {
      // Keep the last status from the API.
    }
  }, 0);
  return receipt;
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
