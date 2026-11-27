// Tests of the service handler (#190). Each expected result comes from the issue and from src/actions/service.js:
// - Each request goes to the base URL of its own service.
// - A typed refusal body gives a receipt with ok false, the service name of the binding and the code.
// - A network failure or a body that is not valid gives no receipt, so the action stays pending.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionState } from '../src/actions/action.js';
import { onAction, receiptFromResponse, serviceHandler } from '../src/kit.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Two synthetic fixture services on different origins. Each one records the URLs that it gets.
function fixtures() {
  const calls = [];
  const answers = new Map();
  const send = async (url, request) => {
    calls.push(url);
    const answer = answers.get(new URL(url).origin);
    if (answer instanceof Error) throw answer;
    return answer(request);
  };
  const seeds = serviceHandler({ service: 'Seed orders', base: 'https://seeds.example.test/api', send });
  const water = serviceHandler({ service: 'Watering plan', base: 'https://water.example.test/v1/?unused=1#top', send,
    path: (tool, args) => `plans/${encodeURIComponent(args.plan_id)}/${encodeURIComponent(tool)}` });
  return { calls, answers, seeds, water };
}

// Sends one action through onAction, as a page does, and returns the source element after the handler settles.
async function act(handler, tool, args = {}) {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool, arguments: args });
  const stop = onAction(root, handler);
  const event = new CustomEvent('mu-action', { detail: source.start() });
  event.composedPath = () => [source, root];
  root.dispatchEvent(event);
  for (let turn = 0; turn < 20 && source.state === 'pending' && source.wait !== 'stalled'; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  stop();
  return source;
}

test('each request goes to the base URL of its own service', async () => {
  const { calls, answers, seeds, water } = fixtures();
  answers.set('https://seeds.example.test', () => json(200, { ok: true, reference: 'O-0001' }));
  answers.set('https://water.example.test', () => json(200, { ok: true }));
  const order = await act(seeds, 'tray.order', { tray_id: 'T-01' });
  const plan = await act(water, 'plan.start', { plan_id: 'P 7' });
  assert.deepEqual(calls, ['https://seeds.example.test/api/tray.order', 'https://water.example.test/v1/plans/P%207/plan.start']);
  assert.deepEqual([order.state, order.reference, order.service, order.code], ['done', 'O-0001', '', '']);
  assert.deepEqual([plan.state, plan.service], ['done', '']);
});

test('a refusal from each service shows its own name and code', async () => {
  const { answers, seeds, water } = fixtures();
  // The body cannot give a different service name. The name comes from the binding.
  answers.set('https://seeds.example.test', () => json(409, { ok: false, code: 'tray-full', message: 'The tray is full.',
    service: 'Watering plan' }));
  answers.set('https://water.example.test', () => json(200, { ok: false, code: 'dry-soil' }));
  const order = await act(seeds, 'tray.order');
  const plan = await act(water, 'plan.start', { plan_id: 'P-7' });
  assert.deepEqual([order.state, order.service, order.code, order.outcome],
    ['error', 'Seed orders', 'tray-full', 'The tray is full. Service: Seed orders. Code: tray-full.']);
  assert.deepEqual([plan.state, plan.service, plan.code, plan.outcome],
    ['error', 'Watering plan', 'dry-soil', 'Service: Watering plan. Code: dry-soil.']);
});

test('a network failure or a body that is not valid gives no receipt, so the action stays pending', async () => {
  const cases = [
    new TypeError('Failed to fetch'),
    () => json(500, { ok: false, code: 'down' }),
    () => json(302, { ok: true }),
    () => json(404, { ok: true }),
    () => json(409, { ok: false }),
    () => json(409, { ok: false, code: '' }),
    () => json(200, { ok: 'yes' }),
    () => json(200, ['ok']),
    () => new Response('<html>Sign in</html>', { status: 200 }),
    () => new Response(JSON.stringify({ ok: true, message: 'M'.repeat(5000) }), { status: 200 }),
    () => json(409, { ok: false, code: 'C'.repeat(81) }),
    () => ({ ok: true }),
  ];
  for (const answer of cases) {
    const { answers, seeds } = fixtures();
    answers.set('https://seeds.example.test', answer);
    const order = await act(seeds, 'tray.order');
    assert.deepEqual([order.state, order.wait], ['pending', 'stalled'], String(answer));
  }
});

test('a path cannot leave the base URL, and the handler sends nothing then', async () => {
  for (const target of ['../admin', 'https://other.example.test/api/x', '//other.example.test/api/x', '/x', '%2e%2e/admin']) {
    const calls = [];
    const handler = serviceHandler({ service: 'Seed orders', base: 'https://seeds.example.test/api/', path: () => target,
      send: async (url) => { calls.push(url); return json(200, { ok: true }); } });
    const order = await act(handler, 'tray.order');
    assert.deepEqual([order.state, calls], ['pending', []], target);
  }
});

test('the binding needs a service name, an http or https base URL and a transport', () => {
  const send = async () => json(200, { ok: true });
  assert.throws(() => serviceHandler({ base: 'https://seeds.example.test/', send }), TypeError);
  assert.throws(() => serviceHandler({ service: 'S'.repeat(81), base: 'https://seeds.example.test/', send }), TypeError);
  assert.throws(() => serviceHandler({ service: 'Seed orders', base: 'api/', send }), TypeError);
  assert.throws(() => serviceHandler({ service: 'Seed orders', base: 'javascript:alert(1)', send }), TypeError);
  assert.throws(() => serviceHandler({ service: 'Seed orders', base: 'https://user:secret@seeds.example.test/', send }), TypeError);
  assert.throws(() => serviceHandler({ service: 'Seed orders', base: 'https://seeds.example.test/' }), TypeError);
  assert.equal(typeof serviceHandler({ service: 'Seed orders', base: 'http://localhost:8080/api', send }), 'function');
});

test('receiptFromResponse keeps only the receipt fields of the body', async () => {
  assert.deepEqual(await receiptFromResponse(json(200, { ok: true, id: 'a', key: 'b', message: 'Done.', reference: 'R-1',
    code: 'ignored', service: 'Other', extra: 1 }), 'Seed orders'), { ok: true, id: 'a', key: 'b', message: 'Done.', reference: 'R-1' });
  assert.deepEqual(await receiptFromResponse(json(422, { ok: false, code: 'late', extra: 1 }), 'Seed orders'),
    { ok: false, service: 'Seed orders', code: 'late' });
  await assert.rejects(receiptFromResponse(json(200, { ok: true }), ''), TypeError);
});
