// The time limits of the browser check (issue 214). A lost DevTools answer or a hidden page must fail with the
// page name, and never stop the run with no output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, ensureVisible } from '../tools/browser_check.mjs';

// A fake DevTools socket. It records each call. answer(call) gives the result, or undefined for no answer.
function fakeSocket(answer = () => undefined) {
  const listeners = { message: [], close: [] };
  const socket = {
    calls: [],
    addEventListener(type, listener) { listeners[type]?.push(listener); },
    send(text) {
      const call = JSON.parse(text);
      socket.calls.push(call);
      const result = answer(call);
      if (result === undefined) return;
      const data = JSON.stringify({ id: call.id, result, ...(call.sessionId ? { sessionId: call.sessionId } : {}) });
      setImmediate(() => { for (const listener of listeners.message) listener({ data }); });
    },
    close() { for (const listener of listeners.close) listener({}); },
  };
  return socket;
}

async function failure(promise) {
  const start = Date.now();
  const error = await promise.then(() => null, (reason) => reason);
  assert.ok(error, 'the call must fail');
  return { message: error.message, ms: Date.now() - start };
}

test('a call with no answer fails in the call limit with the page, the method and the limit', async () => {
  const session = new Session(fakeSocket(), { callLimit: 60, pageLimit: 10000 });
  session.startPage('page-1', 'examples/cards/service-status.html');
  const { message, ms } = await failure(session.send('Runtime.evaluate', { expression: '1' }, 'page-1'));
  assert.equal(message, 'page examples/cards/service-status.html: Runtime.evaluate had no answer in 0.06 s');
  assert.ok(ms >= 50 && ms < 1000, `the failure came after ${ms} ms`);
  assert.equal(session.pending.size, 0);
});

test('a browser call with no answer names the browser', async () => {
  const session = new Session(fakeSocket(), { callLimit: 40, pageLimit: 10000 });
  const { message } = await failure(session.send('Target.createTarget', { url: 'about:blank' }));
  assert.equal(message, 'the browser: Target.createTarget had no answer in 0.04 s');
});

test('a page that passes its total limit fails with its name and its last step', async () => {
  const session = new Session(fakeSocket((call) => (call.method === 'Page.navigate' ? {} : undefined)),
    { callLimit: 10000, pageLimit: 120 });
  session.startPage('page-1', 'examples/cards/service-status.html?mode=dark');
  await session.send('Page.navigate', { url: 'x' }, 'page-1');
  const { message, ms } = await failure(session.send('Runtime.evaluate', { expression: 'window.muWait(\n  "hover")' }, 'page-1'));
  assert.equal(message, 'page examples/cards/service-status.html?mode=dark: the page passed its time limit of 0.12 s;'
    + ' last step: Runtime.evaluate window.muWait( "hover")');
  assert.ok(ms < 1000, `the failure came after ${ms} ms`);
  // After the limit, each next call of the page fails at once.
  const next = await failure(session.send('Page.reload', {}, 'page-1'));
  assert.ok(next.ms < 50);
  assert.match(next.message, /passed its time limit/);
});

test('an answer in time gives the result and stops the timer', async () => {
  const session = new Session(fakeSocket(() => ({ product: 'Chrome' })), { callLimit: 50, pageLimit: 10000 });
  assert.deepEqual(await session.send('Browser.getVersion'), { product: 'Chrome' });
  assert.equal(session.pending.size, 0);
});

test('a closed socket fails each open call', async () => {
  const socket = fakeSocket();
  const session = new Session(socket, { callLimit: 10000, pageLimit: 10000 });
  const call = session.send('Browser.getVersion');
  socket.close();
  const { message, ms } = await failure(call);
  assert.equal(message, 'the browser: the DevTools socket closed before the answer to Browser.getVersion');
  assert.ok(ms < 1000);
});

test('an event that does not come fails with the page name', async () => {
  const session = new Session(fakeSocket(), { callLimit: 10000, pageLimit: 10000 });
  session.startPage('page-1', 'examples/index.html');
  const { message } = await failure(session.once('Page.loadEventFired', 'page-1', 30));
  assert.equal(message, 'page examples/index.html: no Page.loadEventFired event in 0.03 s');
});

test('a hidden page comes to the front, or fails with a clear message', async () => {
  let state = 'hidden';
  const answer = (call) => {
    if (call.method === 'Page.bringToFront') {
      state = 'visible';
      return {};
    }
    return { result: { value: state } };
  };
  const front = new Session(fakeSocket(answer), { callLimit: 1000, pageLimit: 10000 });
  await ensureVisible(front, 'page-1');
  assert.equal(state, 'visible');

  const stuck = new Session(fakeSocket((call) => (call.method === 'Page.bringToFront' ? {} : { result: { value: 'hidden' } })),
    { callLimit: 1000, pageLimit: 10000 });
  stuck.startPage('page-1', 'examples/cards/service-status.html');
  const { message } = await failure(ensureVisible(stuck, 'page-1'));
  assert.equal(message, 'page examples/cards/service-status.html: the page is hidden, so it gets no animation frames');
});
