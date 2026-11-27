import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { createRunSteps, validateFill } from '../src/kit.js';
import { createReader } from '../src/envelope/envelope.js';

const actor = { type: 'agent', id: 'garden-agent', name: 'Garden helper' };
const fills = [];
const event = (type, data) => ({ type, ...data });
const start = (runId = 'r1') => event('RUN_STARTED', { threadId: 'garden', runId });
const finish = (runId = 'r1') => event('RUN_FINISHED', { threadId: 'garden', runId });
const step = (stepName) => event('STEP_STARTED', { stepName });
const endStep = (stepName) => event('STEP_FINISHED', { stepName });
const tool = (toolCallId, toolCallName) => event('TOOL_CALL_START', { toolCallId, toolCallName });
const args = (toolCallId, delta) => event('TOOL_CALL_ARGS', { toolCallId, delta });
const endTool = (toolCallId) => event('TOOL_CALL_END', { toolCallId });
const result = (toolCallId, content) => event('TOOL_CALL_RESULT', { toolCallId, messageId: 'result', content });

function run(options) {
  const helper = createRunSteps({ actor, ...options });
  return (value) => {
    const snapshots = helper.push(value);
    assert.ok(snapshots.length <= 1);
    for (const snapshot of snapshots) {
      assert.equal(snapshot.type, 'ACTIVITY_SNAPSHOT');
      assert.equal(snapshot.activityType, 'mugham.fill');
      assert.equal(snapshot.replace, true);
      assert.equal(snapshot.content.format, 2);
      assert.deepEqual(snapshot.metadata.mugham.actor, actor);
      assert.deepEqual(validateFill(snapshot.content.fill), []);
      fills.push(structuredClone(snapshot.content.fill));
    }
    return snapshots[0];
  };
}

const rows = (snapshot) => snapshot.content.fill.data.steps;
const states = (snapshot) => rows(snapshot).map(({ id, state }) => [id, state]);

test('steps share one snapshot message and each occurrence has its own row', () => {
  const push = run();
  assert.equal(push(start()), undefined);
  const first = push(step('Prepare trays'));
  assert.equal(first.messageId, 'r1/steps');
  assert.deepEqual(states(first), [['Prepare trays', 'running']]);
  assert.deepEqual(states(push(endStep('Prepare trays'))), [['Prepare trays', 'done']]);
  assert.equal(push(endStep('Prepare trays')), undefined);
  assert.deepEqual(states(push(step('Prepare trays'))), [['Prepare trays', 'done'], ['Prepare trays#2', 'running']]);
  assert.equal(push(endStep('Prepare trays')).messageId, first.messageId);
  assert.equal(push(finish()), undefined);
  assert.equal(push(step('Outside a run')), undefined);
  assert.equal(push(start('r2')), undefined);
  const next = push(step('Prepare trays'));
  assert.equal(next.messageId, 'r2/steps');
  assert.deepEqual(states(next), [['Prepare trays', 'running']]);
  assert.deepEqual(states(first), [['Prepare trays', 'running']]);
});

test('tools follow their step and the latest running step gets each new tool', () => {
  const push = run();
  push(start());
  push(step('Check trays'));
  push(tool('count', 'Count seedlings'));
  push(step('Check soil'));
  push(tool('read', 'Read moisture'));
  push(endStep('Check soil'));
  const joined = push(tool('note', 'Write note'));
  assert.deepEqual(states(joined), [['Check trays', 'running'], ['Check trays/count', 'running'], ['Check trays/note', 'running'],
    ['Check soil', 'done'], ['Check soil/read', 'running']]);
  assert.deepEqual(rows(joined)[1], { id: 'Check trays/count', name: 'Count seedlings', state: 'running', tool_name: 'Count seedlings' });
  assert.equal(push(args('count', 'private arguments')), undefined);
  assert.equal(rows(push(endTool('count')))[1].state, 'done');
  assert.equal(push(result('count', 'private result')), undefined);
  assert.equal(rows(push(result('note', 'private result')))[2].state, 'done');
  push(endStep('Check trays'));
  assert.deepEqual(states(push(tool('loose', 'Read date'))).at(-1), ['loose', 'running']);
});

test('opted-in text joins deltas and accepts a string result after tool end', () => {
  const push = run({ toolText: true });
  push(start());
  push(tool('count', 'Count seedlings'));
  assert.equal(push(args('count', '')), undefined);
  push(args('count', '<b>'));
  push(args('count', 'Tray</b>'));
  push(endTool('count'));
  assert.equal(push(args('count', 'late')), undefined);
  assert.equal(push(result('count', { total: 3 })), undefined);
  const done = push(result('count', '<b>Three</b>'));
  assert.deepEqual(rows(done), [{ id: 'count', name: 'Count seedlings', tool_name: 'Count seedlings', state: 'done',
    tool_arguments: '<b>Tray</b>', tool_result: '<b>Three</b>' }]);
  assert.equal(push(result('count', '<b>Three</b>')), undefined);
});

test('run ends give fixed details to each unfinished row', () => {
  for (const [end, detail] of [
    [event('RUN_ERROR', { message: 'private error', code: 'private code' }), 'The run stopped with an error.'],
    [finish(), 'The run ended before this step finished.'],
  ]) {
    const push = run({ toolText: true });
    push(start());
    push(step('Check trays'));
    push(tool('count', 'Count seedlings'));
    push(tool('read', 'Read moisture'));
    push(endTool('read'));
    assert.equal(push(finish('other')), undefined);
    const failed = push(end);
    assert.deepEqual(rows(failed).map(({ state, detail }) => [state, detail]), [['failed', detail], ['failed', detail], ['done', undefined]]);
    assert.doesNotMatch(JSON.stringify(failed), /private/);
    assert.equal(push(result('count', 'late')), undefined);
  }
});

test('unknown events, invalid ids and blank names give no snapshot', () => {
  const push = run({ toolText: true });
  const badId = 'x'.repeat(129);
  assert.equal(push(start(badId)), undefined);
  assert.equal(push(step('No run')), undefined);
  push(start());
  for (const value of [null, event('REASONING_START'), event('constructor'), step('  '), step(' '.repeat(130)), tool('', 'Tool'),
    tool(badId, 'Tool'), tool('t', '  '), { ...tool('t', 'Tool'), parentMessageId: badId },
    endStep('missing'), endTool(badId), args('missing', 'text'), result('missing', 'text')]) {
    assert.equal(push(value), undefined);
  }
  push(tool('t', 'Tool'));
  assert.equal(push({ ...result('t', 'text'), messageId: badId }), undefined);
  assert.deepEqual(states(push(endTool('t'))), [['t', 'done']]);
});

test('the last 20 rows stay visible and the count includes rows outside the retention limit', () => {
  const push = run();
  push(start());
  let last;
  for (let index = 1; index <= 130; index += 1) last = push(tool(`t${index}`, `Tool ${index}`));
  assert.equal(last.content.fill.data.label, 'Run steps (110 earlier steps not shown)');
  assert.deepEqual(rows(last).map(({ id }) => id), Array.from({ length: 20 }, (_, index) => `t${index + 111}`));
  assert.equal(push(endTool('t1')), undefined);
  assert.equal(push(endTool('t110')), undefined);
  assert.equal(rows(push(endTool('t111')))[0].state, 'done');
});

test('a tool for an earlier running step stays before later step rows', () => {
  const push = run({ label: 'L'.repeat(100) });
  push(start());
  push(step('Older step'));
  push(step('Later step'));
  for (let index = 0; index < 100; index += 1) push(tool(`t${index}`, `Tool ${index}`));
  const done = push(endStep('Later step'));
  assert.equal(done, undefined);
  const earlierTool = push(tool('early', 'Read the date'));
  assert.equal(earlierTool.content.fill.data.label.length, 80);
  assert.match(earlierTool.content.fill.data.label, /\(83 earlier steps not shown\)$/);
  assert.equal(rows(earlierTool)[0].id, 'Later step/t80');
  assert.equal(push(endTool('early')), undefined);
});

test('long text stays within the limits and maximum length ids remain distinct', () => {
  const push = run({ label: '🌱'.repeat(100), toolText: true });
  const prefix = '🌱'.repeat(127);
  const firstRun = prefix + 'a';
  push(start(firstRun));
  const stepName = '🌱'.repeat(130);
  const first = push(step(stepName));
  assert.ok([...first.messageId].length <= 128);
  assert.equal([...first.content.fill.data.label].length, 80);
  assert.equal([...rows(first)[0].name].length, 80);
  const started = push(tool('x'.repeat(128), '🌱'.repeat(300)));
  assert.equal([...rows(started)[1].tool_name].length, 80);
  const callId = 'x'.repeat(128);
  push(args(callId, '\ud83c'));
  const joined = push(args(callId, '\udf31' + 'x'.repeat(2500)));
  assert.equal(rows(joined)[1].tool_arguments, '🌱' + 'x'.repeat(1996) + '...');
  assert.equal(push(args(callId, 'more')), undefined);
  const completed = push(result(callId, '🌱'.repeat(3000)));
  assert.equal(rows(completed)[1].tool_result, '🌱'.repeat(1997) + '...');
  const last = push(finish(firstRun));
  assert.equal(rows(last)[0].state, 'failed');
  push(start(prefix + 'b'));
  assert.notEqual(push(step(stepName)).messageId, first.messageId);
});

test('step ids stay unique when supplied names contain generated ids', () => {
  const push = run();
  push(start());
  push(step('Check'));
  push(tool('t', 'Tool'));
  push(step('Check/t'));
  push(step('Check#2'));
  const last = push(step('Check'));
  assert.equal(new Set(rows(last).map(({ id }) => id)).size, 5);
  assert.equal(rows(push(endStep('Check'))).at(-1).state, 'done');
});

test('the real reader checks the page actor without changing the input stream', () => {
  for (const invalid of [undefined, null, {}, { type: 'bot', id: 'a' }, { type: 'agent', id: 'x'.repeat(129) },
    { type: 'agent', id: 'a', name: 'x'.repeat(81) }]) {
    assert.throws(() => createRunSteps({ actor: invalid }), TypeError);
  }
  const push = run();
  const reader = createReader();
  const refused = createReader();
  const checks = [];
  const originals = [start(), { ...step('Check trays'), metadata: { mugham: { actor: { type: 'human', id: 'other' } } } },
    event('REASONING_START'), endStep('Check trays'), finish()];
  const before = structuredClone(originals);
  for (const original of originals) {
    reader.push(original);
    refused.push(original);
    const snapshot = push(original);
    if (snapshot) {
      reader.push(snapshot, { actorFor: ({ messageId, runId }) => {
        checks.push([messageId, runId]);
        return actor;
      } });
      refused.push(snapshot, { actorFor: () => ({ ...actor, type: 'human' }) });
    }
  }
  assert.deepEqual(originals, before);
  assert.deepEqual(checks, [['r1/steps', 'r1'], ['r1/steps', 'r1']]);
  const { ignored, messages, errors } = reader.result();
  assert.equal(ignored, 3);
  assert.deepEqual(errors, []);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].actor, actor);
  assert.equal(messages[0].parts[0].fill.data.steps[0].state, 'done');
  assert.deepEqual(refused.result().messages[0].errors, ['Actor check failed.']);
});

after(() => {
  assert.ok(fills.length > 0);
  const checked = spawnSync(process.env.PYTHON || 'python3', ['-B', '-c', `
import json
from pathlib import Path
import sys
sys.path.insert(0, 'tools')
from catalog import fill_errors, load_catalog
catalog, errors = load_catalog(Path('catalog'))
assert not errors, errors
for index, fill in enumerate(json.load(sys.stdin)):
    errors = fill_errors(fill, catalog)
    assert not errors, (index, errors)
`], { cwd: new URL('..', import.meta.url), input: JSON.stringify(fills), encoding: 'utf8' });
  assert.ifError(checked.error);
  assert.equal(checked.status, 0, checked.stderr);
});
