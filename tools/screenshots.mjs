#!/usr/bin/env node
// Write the README image sequence of examples/thread.html to docs/screenshots/. It starts tools/thread_server.py
// with no delay and renders the example in headless Chrome, with the helpers of tools/browser_check.mjs.
// It uses only Node.js, Python 3 and Chrome. See decision 0001. All data is synthetic.
// The images are documentation. tools/build.py does not put them in the package.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, evaluate, open, pythonServer, sleep, startChrome } from './browser_check.mjs';

const OUT = join(ROOT, 'docs', 'screenshots');
const MODES = ['light', 'dark'];
// The frames of the sequence, in order. Each frame is a part of the thread, and the action state that it must show.
const FRAMES = [
  { name: 'thread-1-people-and-agents', part: 'conversation', action: 'default' },
  { name: 'thread-2-refused', part: 'refusal', action: 'default' },
  { name: 'thread-3-pending', part: 'action', action: 'pending' },
  { name: 'thread-4-done', part: 'action', action: 'done' },
];
// CONSTITUTION.md allows 16 README screenshots maximum.
const LIMIT = 16;
const MARGIN = 8;

// The state of the thread, and the box of each part of a frame, in page coordinates.
const STATE = `(() => {
  const thread = document.querySelector('mu-thread');
  const root = thread?.shadowRoot;
  if (!root) return null;
  const box = (nodes) => {
    const rects = nodes.filter(Boolean).map((node) => node.getBoundingClientRect());
    if (!rects.length) return null;
    const top = Math.min(...rects.map((r) => r.top)) + scrollY;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + scrollY;
    const main = document.querySelector('main').getBoundingClientRect();
    return { x: main.left, y: top, width: main.width, height: bottom - top };
  };
  const messages = [...root.querySelectorAll('li.message')];
  const refused = messages.findIndex((node) => node.querySelector('.refusal'));
  const action = messages.find((node) => node.querySelector('mu-action-button'));
  const button = action?.querySelector('mu-action-button');
  return { state: thread.dataset.state,
    actors: messages.map((node) => node.querySelector('.actor')?.textContent),
    refusals: [...root.querySelectorAll('.refusal')].map((node) => node.textContent),
    action: button?.dataset.state, status: button?.shadowRoot.querySelector('.status').textContent,
    boxes: { conversation: box([document.querySelector('h1'), ...messages.slice(0, Math.max(refused, 1))]),
      refusal: box(refused < 0 ? [] : [messages[refused]]), action: box([action]) } };
})()`;

async function capture(session, sessionId, box, file) {
  const clip = { x: Math.max(box.x - MARGIN, 0), y: Math.max(box.y - MARGIN, 0), width: box.width + 2 * MARGIN,
    height: box.height + 2 * MARGIN, scale: 1 };
  const { data } = await session.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true }, sessionId);
  writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
}

async function waitFor(session, sessionId, test) {
  let value = null;
  for (let i = 0; i < 200; i += 1) {
    value = await evaluate(session, sessionId, STATE);
    if (value && test(value)) return value;
    await sleep(50);
  }
  throw new Error('the thread did not reach the expected state: ' + JSON.stringify(value));
}

async function main() {
  if (FRAMES.length * MODES.length > LIMIT) throw new Error(`the sequence gives more than ${LIMIT} images`);
  const { server, url } = await pythonServer('thread_server.py', ['--port', '0', '--no-delay']);
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  let chrome;
  const written = [];
  try {
    const started = await startChrome(profile);
    chrome = started.chrome;
    const { session } = started;
    const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true });
    for (const method of ['Page.enable', 'Runtime.enable']) await session.send(method, {}, sessionId);
    await session.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 900, deviceScaleFactor: 1.5, mobile: false }, sessionId);
    mkdirSync(OUT, { recursive: true });
    for (const name of readdirSync(OUT)) if (name.endsWith('.png')) rmSync(join(OUT, name));
    for (const mode of MODES) {
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] }, sessionId);
      // The script holds each request of the action, so the frame of the pending state is certain.
      await session.send('Fetch.enable', { patterns: [{ urlPattern: '*/actions', requestStage: 'Request' }] }, sessionId);
      const held = session.once('Fetch.requestPaused', sessionId);
      await open(session, sessionId, url);
      let value = await waitFor(session, sessionId, (v) => v.state === 'ended' && v.action === 'default');
      await evaluate(session, sessionId, 'document.fonts.ready.then(() => true)');
      const actors = new Set(value.actors);
      if (!['Robin Person', 'Sam Person', 'Catalog agent Agent', 'Renewal agent Agent'].every((name) => actors.has(name))) {
        throw new Error('the thread does not show two people and two agents: ' + JSON.stringify(value.actors));
      }
      if (value.refusals.length !== 1) throw new Error('the thread does not show one refusal: ' + JSON.stringify(value.refusals));
      for (const frame of FRAMES) {
        if (frame.action === 'pending') {
          await evaluate(session, sessionId, `document.querySelector('mu-thread').shadowRoot.querySelector('mu-action-button')
            .shadowRoot.querySelector('button').click(), true`);
          value = await waitFor(session, sessionId, (v) => v.action === 'pending');
          if (value.status !== 'Pending') throw new Error('the pending action shows ' + value.status);
        }
        if (frame.action === 'done') {
          const { requestId } = await held;
          await session.send('Fetch.continueRequest', { requestId }, sessionId);
          value = await waitFor(session, sessionId, (v) => v.action === 'done' || v.action === 'error');
          if (!/^Done: .*Reference: R-\d{4}$/.test(value.status)) throw new Error('the action shows ' + value.status);
        }
        if (value.action !== frame.action) throw new Error(`${frame.name}: the action is ${value.action}, not ${frame.action}`);
        const box = value.boxes[frame.part];
        if (!box) throw new Error(`${frame.name}: the thread has no ${frame.part}`);
        const file = `${frame.name}-${mode}.png`;
        await capture(session, sessionId, box, file);
        written.push(file);
      }
      await session.send('Fetch.disable', {}, sessionId);
    }
  } finally {
    if (chrome) chrome.kill();
    server.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ folder: 'docs/screenshots', images: written }, null, 2));
}

main().catch((error) => {
  console.error(String(error.message || error));
  process.exit(1);
});
