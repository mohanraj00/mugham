// The envelope reader gives the expected result for each conformance case in tests/vectors/envelope/.
// Each result agrees with docs/contracts/envelope-v1.schema.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schemaErrors } from '../src/render/validate.js';
import { createReader, readEnvelope, readStream, FALLBACK_TEXT } from '../src/envelope/envelope.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SCHEMA = load('../docs/contracts/envelope-v1.schema.json');
const ENVELOPES = load('./vectors/envelope/envelopes.json');
const STREAMS = load('./vectors/envelope/streams.json');
const EVENT = { $ref: '#/$defs/event' };
const READ_TYPES = ['RUN_STARTED', 'RUN_FINISHED', 'RUN_ERROR', 'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT',
  'TEXT_MESSAGE_END', 'ACTIVITY_SNAPSHOT'];

const envelopeErrors = (value) => schemaErrors(value, SCHEMA, SCHEMA, '', '(envelope)');

test('the fallback text of the vectors is the text of the kit', () => {
  assert.equal(ENVELOPES.fallback, FALLBACK_TEXT);
});

for (const item of ENVELOPES.cases) {
  test(`envelope: ${item.name}`, () => {
    const before = JSON.stringify(item.envelope);
    const result = readEnvelope(item.envelope);
    assert.deepEqual(result, item.result);
    assert.equal(JSON.stringify(item.envelope), before, 'the reader must not change the envelope');
    assert.equal(envelopeErrors(item.envelope).length === 0, item.schema, 'the schema result of the input');
    assert.deepEqual(envelopeErrors(result), [], 'the result must agree with the schema');
  });
}

for (const item of STREAMS.cases) {
  test(`stream: ${item.name}`, () => {
    const before = JSON.stringify(item.events);
    const result = readStream(item.events);
    assert.deepEqual(result, item.expected);
    assert.equal(JSON.stringify(item.events), before, 'the reader must not change the events');
    for (const message of result.messages) assert.deepEqual(envelopeErrors(message), [], message.messageId);
  });
}

test('each event of the thread case agrees with the event schema', () => {
  const thread = STREAMS.cases.find((item) => item.name === 'two people and two agents in one thread');
  for (const event of thread.events) assert.deepEqual(schemaErrors(event, EVENT, SCHEMA, '', '(event)'), [], event.type);
  assert.deepEqual(new Set(thread.events.map((event) => event.type)), new Set(READ_TYPES.filter((type) => type !== 'RUN_ERROR')));
});

test('the event schema refuses an event with no actor and a snapshot of a different activity', () => {
  const start = { type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant' };
  const other = { type: 'ACTIVITY_SNAPSHOT', messageId: 'm-1', activityType: 'other.progress', content: {},
    metadata: { mugham: { actor: { type: 'agent', id: 'agent-plan' } } } };
  assert.notDeepEqual(schemaErrors(start, EVENT, SCHEMA, '', '(event)'), []);
  assert.notDeepEqual(schemaErrors(other, EVENT, SCHEMA, '', '(event)'), []);
});

test('the reader shows each step of a stream with the honest state', () => {
  const reader = createReader();
  const actor = { type: 'agent', id: 'agent-plan' };
  reader.push({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', metadata: { mugham: { actor } } });
  reader.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'Half' });
  const middle = reader.result();
  assert.equal(middle.messages[0].state, 'partial');
  assert.equal(middle.messages[0].parts[0].text, 'Half');
  middle.messages[0].state = 'final';
  assert.equal(reader.result().messages[0].state, 'partial', 'a result is a copy');
  reader.push({ type: 'TEXT_MESSAGE_END', messageId: 'm-1' });
  assert.equal(reader.result().messages[0].state, 'final');
});

test('a text longer than 100000 characters refuses the message', () => {
  const actor = { type: 'agent', id: 'agent-plan' };
  const result = readStream([
    { type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', metadata: { mugham: { actor } } },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'a'.repeat(99999) },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: '\u{1F600}' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'b' },
    { type: 'TEXT_MESSAGE_END', messageId: 'm-1' },
  ]);
  assert.deepEqual(result.messages, [{ envelope: 1, agui: '1.0', messageId: 'm-1', state: 'refused',
    errors: ['text: more than 100000 characters'] }]);
  assert.equal(result.ignored, 1);
  assert.deepEqual(result.errors, []);
});

test('the actor never comes from the AG-UI role', () => {
  const result = readStream([{ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'user', metadata: {} }]);
  assert.equal(result.messages[0].state, 'refused');
  assert.equal(result.messages[0].actor, undefined);
});

test('the stream keeps 100 errors at most', () => {
  const result = readStream(new Array(150).fill(null));
  assert.equal(result.errors.length, 100);
});
