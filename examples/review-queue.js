// A review queue built with the kit. The page acts as the application. The fixture API (review-queue-api.js) gives
// the open review tasks and decides each action. A reviewer accepts, corrects or rejects the extracted value of a
// task. The kit shows Done only after the receipt of the fixture API. A service with review tasks builds its own
// dashboard from this page. All data are synthetic and neutral.
import { define } from '../src/components/index.js';
import { ReviewApi } from './review-queue-api.js';

define();

const api = new ReviewApi();
const fill = (component, data) => ({ component, version: '0.1.0', data });
// The page and the fixture API own the content, so the actor of each fill is the system.
const SYSTEM = { type: 'system', id: 'review-queue', name: 'Review queue' };
const REVIEWER = { type: 'human', id: 'reviewer-1' };
const FIELD = { number: 'number-field', text: 'field', date: 'date-field' };

function make(tag, value, authored = true) {
  const node = document.createElement(tag);
  node.actor = SYSTEM;
  // An action button has no authorship slot.
  node.fill = authored ? { ...value, slots: { ...value.slots, authorship: SYSTEM } } : value;
  return node;
}

function text(tag, words, attributes = {}) {
  const node = document.createElement(tag);
  node.textContent = words;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

const main = document.getElementById('main');
const queue = document.createElement('section');
queue.setAttribute('aria-labelledby', 'queue-title');
const picks = document.createElement('ul');
picks.className = 'queue-picks';
picks.setAttribute('aria-label', 'Tasks to review');
const detail = document.createElement('section');
detail.id = 'detail';
detail.setAttribute('aria-live', 'polite');
const result = document.createElement('section');
result.id = 'result';
result.setAttribute('aria-live', 'polite');
let tasks = [];
let selected = null;

// The table lists the open tasks from the fixture API. A table has no row selection, so the buttons select a task.
async function refresh() {
  tasks = await api.list();
  const rows = tasks.map((task) => fill('table-row', { cells: [task.id, task.field, String(task.extracted), task.document] }));
  const table = make('mu-table', fill('table', { label: 'Open review tasks', columns: ['Task', 'Field', 'Extracted value', 'Source'], rows }));
  queue.replaceChildren(text('h2', 'Open review tasks', { id: 'queue-title' }), table, picks);
  picks.replaceChildren(...tasks.map((task) => {
    const item = document.createElement('li');
    const button = text('button', `Review ${task.id}`, { type: 'button', 'aria-pressed': String(task.id === selected?.id) });
    button.addEventListener('click', () => show(task));
    item.append(button);
    return item;
  }));
  if (!tasks.length) queue.append(text('p', 'No open tasks.'));
}

// The detail of one task: the source excerpt next to the extracted value, and the three actions.
function show(task) {
  selected = task;
  for (const button of picks.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.textContent === `Review ${task.id}`));
  result.replaceChildren();
  const excerpt = make('mu-excerpt', { ...fill('excerpt', { passage: task.passage, span_start: task.span_start, span_end: task.span_end }),
    slots: { citation: { source: task.document, locator: task.locator } } });
  const form = make('mu-editable-form', fill('editable-form', { title: `Review ${task.id}`, submit_label: 'Correct', fields: [
    fill(FIELD[task.kind], { name: 'value', label: 'Extracted value', value: task.extracted, hint: `The value of: ${task.field}.`, typed: true,
      ...(task.kind === 'number' ? { minimum: 0 } : {}) })] }));
  form.action = { tool: 'review.correct', label: 'Correct', title: `Review ${task.id}`, arguments: { task_id: task.id },
    editable: { value: 'Extracted value' }, typed: ['value'], editor: REVIEWER };
  const accept = make('mu-action-button', fill('action-button', { label: 'Accept' }), false);
  accept.action = { tool: 'review.accept', label: 'Accept', arguments: { task_id: task.id } };
  const reject = make('mu-action-button', fill('action-button', { label: 'Reject' }), false);
  reject.action = { tool: 'review.reject', label: 'Reject', arguments: { task_id: task.id } };
  const grid = document.createElement('div');
  grid.className = 'queue-detail';
  grid.append(excerpt, form);
  const actions = document.createElement('div');
  actions.className = 'queue-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', `Decide ${task.id}`);
  actions.append(accept, reject);
  detail.replaceChildren(text('h2', `Task ${task.id}: ${task.field}`), grid, actions);
}

// The fixture API decides and gives the receipt. Only then does the page change the queue.
main.addEventListener('mu-action', async (event) => {
  const { id, tool, arguments: args, edits } = event.detail;
  const element = event.target;
  const task = tasks.find((item) => item.id === args.task_id);
  const receipt = await api.perform({ tool, arguments: args, edits });
  element.receipt({ id, ...receipt });
  if (!receipt.ok || !task) return;
  await refresh();
  const done = { 'review.accept': 'Accepted', 'review.reject': 'Rejected', 'review.correct': 'Corrected' }[tool];
  const parts = [text('p', `${task.id}: ${done}. Reference: ${receipt.reference}.`, { id: 'decision' })];
  if (tool === 'review.correct') {
    const change = (label, kind, before, after) => fill('diff-change', { label, change: kind,
      ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) });
    parts.push(make('mu-diff', fill('diff', { title: `${task.id} ${task.field}`, before_label: 'Extracted', after_label: 'Corrected', parts: [
      fill('diff-part', { title: 'Value', changes: [change('Extracted value', 'changed', String(task.extracted), String(args.value)),
        change('Edit type', 'added', undefined, edits[0].type)] })] })));
  }
  result.replaceChildren(text('h2', 'Last decision'), ...parts);
});

main.append(text('h1', 'Mugham review queue'),
  text('p', 'The page acts as the application. A fixture API gives the open tasks and decides each action. Select a task, then accept, correct or reject its value.'),
  queue, detail, result);
refresh();
