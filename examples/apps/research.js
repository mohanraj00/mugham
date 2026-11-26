// A synthetic library search. Each press gives both views a new fill.
import { define } from '../../src/components/index.js';
import { createKit, onAction } from '../../src/kit.js';

define();

const actor = { type: 'agent', id: 'catalog-assistant', name: 'Catalog assistant' };
const { outer } = createKit({ actor });
const run = document.querySelector('mu-run-steps');
const plan = document.querySelector('mu-plan');
const approvals = document.querySelector('mu-approval-queue');
const advance = document.getElementById('advance-run');
run.actor = actor;
plan.actor = actor;
approvals.actor = actor;

const steps = [
  { id: 'read', name: 'Read the request' },
  { id: 'search', name: 'Search the catalog', tool_name: 'catalog.search',
    tool_arguments: 'Topic: moss\nBranch: east' },
  { id: 'check', name: 'Check availability' },
];
const tasks = [
  { id: 'read', name: 'Read the request' },
  { id: 'find', name: 'Find a book' },
  { id: 'check', name: 'Check availability' },
  { id: 'browse', name: 'Check the branch index' },
];
const stages = [
  { steps: ['pending', 'pending', 'pending'], tasks: ['pending', 'pending', 'pending', 'pending'] },
  { steps: ['done', 'running', 'pending'], tasks: ['done', 'in_progress', 'pending', 'pending'] },
  { steps: ['done', 'done', 'running'], tasks: ['done', 'done', 'in_progress', 'skipped'] },
  { steps: ['done', 'done', 'failed'], tasks: ['done', 'done', 'failed', 'skipped'] },
  { steps: ['done', 'done', 'done'], tasks: ['done', 'done', 'done', 'skipped'] },
];
const proposals = [
  { id: 'hold', title: 'Place a hold on Moss on stone', summary: 'Keep a copy at the east branch for pickup.' },
  { id: 'reading', title: 'Add Moss on stone to the reading list', summary: 'Keep the title on the list for later.' },
];

let stage = 0;
let failHold = true;
onAction(approvals, (tool, { proposal }, id) => {
  const failed = failHold && tool === 'catalog.approve' && proposal === 'hold';
  if (failed) failHold = false;
  return new Promise((resolve) => setTimeout(() => {
    resolve(failed ? { id, ok: false, message: 'The branch could not place the hold. Try again.' } : { id, ok: true });
  }, 500));
});

function showStage() {
  const states = stages[stage];
  run.fill = outer('run-steps', { label: 'Research run', steps: steps.map((step, index) => ({
    ...step, state: states.steps[index],
    ...(step.id === 'search' && stage >= 2 ? { tool_result: 'Moss on stone. Shelf B4.' } : {}),
  })) });
  plan.fill = outer('plan', { label: 'Research plan', tasks: tasks.map((task, index) => ({ ...task, state: states.tasks[index] })) });
  const done = stage === stages.length - 1;
  advance.textContent = done ? 'Restart run' : 'Advance run';
  approvals.fill = outer('approval-queue', { label: 'Research approvals', items: done ? proposals : [] });
  if (stage === 0) failHold = true;
  if (done) {
    for (const { id, title } of proposals) {
      approvals.bind(id, {
        approve: { tool: 'catalog.approve', arguments: { proposal: id },
          confirm: { message: `Approve this proposal? ${title}.`, label: 'Confirm approval' } },
        reject: { tool: 'catalog.reject', arguments: { proposal: id },
          confirm: { message: `Reject this proposal? ${title}.`, label: 'Confirm rejection' } },
      });
    }
  }
}
advance.addEventListener('click', () => {
  stage = (stage + 1) % stages.length;
  showStage();
});
showStage();
