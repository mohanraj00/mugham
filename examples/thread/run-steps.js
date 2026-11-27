import { createRunSteps } from '../../src/kit.js';
import { define } from '../../src/thread/index.js';

define();
const actor = { type: 'agent', id: 'garden-agent', name: 'Garden helper' };
const run = { threadId: 'garden', runId: 'check-trays' };
const events = [
  { type: 'RUN_STARTED', ...run },
  { type: 'STEP_STARTED', stepName: 'Check the trays' },
  { type: 'TOOL_CALL_START', toolCallId: 'count', toolCallName: 'Count seedlings' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'count', delta: '{"tray":' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'count', delta: '"A1"}' },
  { type: 'TOOL_CALL_END', toolCallId: 'count' },
  { type: 'TOOL_CALL_RESULT', toolCallId: 'count', messageId: 'tray-count', content: '<tray>A1 has 12 seedlings.</tray>' },
  { type: 'STEP_FINISHED', stepName: 'Check the trays' },
  { type: 'STEP_STARTED', stepName: 'Write the report' },
  { type: 'RUN_FINISHED', ...run },
];

const thread = document.querySelector('mu-thread');
thread.actorFor = () => actor;
const steps = createRunSteps({ actor, label: 'Tray check', toolText: true });
for (const event of events) {
  thread.push(event);
  for (const snapshot of steps.push(event)) thread.push(snapshot);
}
