import { FILL_ACTIVITY, FILL_FORMAT } from '../../src/envelope/envelope.js';
import { createKit, fill } from '../../src/kit.js';
import { define } from '../../src/thread/index.js';

const AUTHOR = { type: 'agent', id: 'sample-agent', name: 'Sample agent' };
const METADATA = { mugham: { actor: AUTHOR } };
const STREAM = 'stream';
const DELTA = 'The synthetic sample gives the quantity for one row. '.repeat(20);
const WARM_UPDATES = 10;
const SAMPLE_UPDATES = 60;

const startText = (messageId) => ({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', metadata: METADATA });
const textDelta = (messageId, delta) => ({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta });
const endText = (messageId) => ({ type: 'TEXT_MESSAGE_END', messageId });

function gridEvent(rowCount) {
  const columns = ['Plan', 'Count', 'Total'].map((label) =>
    fill('data-grid-column', { key: label.toLowerCase(), label, type: 'number' }));
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const number = index + 1;
    return fill('data-grid-row', {
      key: `row-${number}`, label: `Sample row ${number}`,
      cells: [number, number + 1, 2 * number + 1].map((value) => fill('number-cell', { value })),
    });
  });
  return {
    type: 'ACTIVITY_SNAPSHOT', activityType: FILL_ACTIVITY, messageId: 'grid', metadata: METADATA,
    content: { format: FILL_FORMAT, fill: createKit({ actor: AUTHOR }).outer('data-grid', { label: 'Sample counts', columns, rows }) },
  };
}

function history(messageCount, gridRows) {
  const events = [];
  const textCount = messageCount - (gridRows ? 2 : 1);
  for (let number = 1; number <= textCount; number += 1) {
    const id = `sample-${number}`;
    events.push(startText(id), textDelta(id, `Sample message ${number}. The agent records counts from the test sample.`), endText(id));
  }
  if (gridRows) events.push(gridEvent(gridRows));
  events.push(startText(STREAM));
  return events;
}

// The thread queues its render callback between these two callbacks. Read the height to include layout.
// Check the DOM before and after the timed work so a timer fallback cannot give a false short time.
async function measureFrame(thread, push, updated) {
  if (document.visibilityState !== 'visible') throw new Error('The bench page is hidden.');
  let start;
  let updatedEarly;
  requestAnimationFrame(() => {
    updatedEarly = updated();
    start = performance.now();
  });
  push();
  const end = await new Promise((done) => requestAnimationFrame(() => {
    thread.getBoundingClientRect();
    done(performance.now());
  }));
  if (updatedEarly || !updated()) throw new Error('The thread did not update in the measured frame.');
  return Number((end - start).toFixed(3));
}

async function run({ messageCount, gridRows }) {
  const thread = document.querySelector('mu-thread');
  const root = thread.shadowRoot;
  const list = root.querySelector('[part="list"]');
  const last = () => list.lastElementChild;
  const text = () => last().querySelector('.text')?.textContent;
  const events = history(messageCount, gridRows);
  const started = performance.now();
  const initialFrameMs = await measureFrame(thread, () => {
    for (const event of events) thread.push(event);
  }, () => list.childElementCount === messageCount);

  const grid = root.querySelector('mu-data-grid');
  const rows = grid?.shadowRoot.querySelectorAll('tbody tr').length ?? 0;
  if (rows !== gridRows) throw new Error(`The grid has ${rows} rows. Expected ${gridRows}.`);
  const samplesMs = [];
  for (let update = 1; update <= WARM_UPDATES + SAMPLE_UPDATES; update += 1) {
    const time = await measureFrame(thread, () => thread.push(textDelta(STREAM, DELTA)),
      () => last().dataset.state === 'partial' && text()?.length === update * DELTA.length);
    if (update > WARM_UPDATES) samplesMs.push(time);
  }
  const finalFrameMs = await measureFrame(thread, () => thread.push(endText(STREAM)), () => last().dataset.state === 'final');
  const totalMs = Number((performance.now() - started).toFixed(3));
  const expectedText = DELTA.repeat(WARM_UPDATES + SAMPLE_UPDATES);
  if (text() !== expectedText) throw new Error('The thread did not show all streamed text.');
  if (root.querySelector('.refusal, [data-state="refused"]') || !root.querySelector('[part="stream"]').hidden) {
    throw new Error('The thread refused a bench message or reported a stream error.');
  }
  return { initialFrameMs, finalFrameMs, totalMs, samplesMs, warmUpUpdates: WARM_UPDATES, streamCharacters: expectedText.length };
}

define();
window.muRunThreadBench = run;
