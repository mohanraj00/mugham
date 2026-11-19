// A review queue built with the kit. The page acts as the application. The fixture API (review-queue-api.js) gives
// the open review tasks and decides each action. A reviewer accepts, corrects or rejects the extracted value of a
// task. The kit shows Done only after the receipt of the fixture API. A service with review tasks builds its own
// dashboard from this page. All data are synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';
import { ReviewApi } from './review-queue-api.js';

define();

const api = new ReviewApi();
// The page and the fixture API own the content, so the actor of each fill is the system.
const SYSTEM = { type: 'system', id: 'review-queue', name: 'Review queue' };
const { mount } = createKit({ actor: SYSTEM });
const REVIEWER = { type: 'human', id: 'reviewer-1' };
const FIELD = { number: 'number-field', text: 'field', date: 'date-field' };

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
  const table = mount('table', { label: 'Open review tasks', columns: ['Task', 'Field', 'Extracted value', 'Source'], rows });
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
  const excerpt = mount('excerpt', { passage: task.passage, span_start: task.span_start, span_end: task.span_end }, {
    slots: { citation: { source: task.document, locator: task.locator } } });
  const form = mount('editable-form', { title: `Review ${task.id}`, submit_label: 'Correct', fields: [
    fill(FIELD[task.kind], { name: 'value', label: 'Extracted value', value: task.extracted, hint: `The value of: ${task.field}.`, typed: true,
      ...(task.kind === 'number' ? { minimum: 0 } : {}) })] }, {
    action: { tool: 'review.correct', label: 'Correct', title: `Review ${task.id}`, arguments: { task_id: task.id },
      editable: { value: 'Extracted value' }, typed: ['value'], editor: REVIEWER },
  });
  const grid = document.createElement('div');
  grid.className = 'queue-detail';
  grid.append(excerpt, form);
  const actions = document.createElement('div');
  actions.className = 'queue-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', `Decide ${task.id}`);
  for (const [tool, label] of [['review.accept', 'Accept'], ['review.reject', 'Reject']]) {
    mount('action-button', { label }, { parent: actions, action: { tool, label, arguments: { task_id: task.id } } });
  }
  detail.replaceChildren(text('h2', `Task ${task.id}: ${task.field}`), grid, actions);
}

// The fixture API decides and gives the receipt. Only then does the page change the queue.
onAction(main, async (tool, args, id, request) => {
  const task = tasks.find((item) => item.id === args.task_id);
  const receipt = await api.perform(request);
  if (receipt.ok && task) setTimeout(() => showResult(task, request, receipt), 0);
  return receipt;
});

async function showResult(task, { tool, arguments: args, edits }, receipt) {
  await refresh();
  const done = { 'review.accept': 'Accepted', 'review.reject': 'Rejected', 'review.correct': 'Corrected' }[tool];
  const parts = [text('p', `${task.id}: ${done}. Reference: ${receipt.reference}.`, { id: 'decision' })];
  if (tool === 'review.correct') {
    const change = (label, kind, before, after) => fill('diff-change', { label, change: kind,
      ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) });
    parts.push(mount('diff', { title: `${task.id} ${task.field}`, before_label: 'Extracted', after_label: 'Corrected', parts: [
      fill('diff-part', { title: 'Value', changes: [change('Extracted value', 'changed', String(task.extracted), String(args.value)),
        change('Edit type', 'added', undefined, edits[0].type)] })] }));
  }
  result.replaceChildren(text('h2', 'Last decision'), ...parts);
}

main.append(text('h1', 'Mugham review queue'),
  text('p', 'The page acts as the application. A fixture API gives the open tasks and decides each action. Select a task, then accept, correct or reject its value.'),
  queue, detail, result);
refresh();
