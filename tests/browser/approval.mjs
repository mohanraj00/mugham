#!/usr/bin/env node
// The browser check of examples/cards/approval.html against the fixture API tools/approval_server.py.
// Expected results, from issue #8: the page lists the two open decisions with their evidence. An approve
// shows pending, then done only after the receipt. A second action on the same decision shows the refusal
// of the API as an error. The status on the card comes from the API.
// A missing or invalid author causes a refusal for that decision. A valid decision still shows its actions.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, coverSteps, evaluate, open, sleep, startChrome } from '../../tools/browser_check.mjs';

async function fixtureApi() {
  const server = spawn(process.env.PYTHON || 'python3', ['-B', join(ROOT, 'tools', 'approval_server.py'), '--port', '0'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((done, fail) => {
    let out = '';
    const timer = setTimeout(() => fail(new Error('tools/approval_server.py did not start')), 10000);
    server.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes('\n')) {
        clearTimeout(timer);
        done(out.split('\n')[0].trim());
      }
    });
    server.on('exit', () => fail(new Error('tools/approval_server.py stopped')));
  });
  return { server, url };
}

// The state of the page: the text of each card, and the state and status of each button.
const STATE = `(() => [...document.querySelectorAll('mu-card')].map((card) => ({
  state: card.dataset.state,
  text: card.shadowRoot.textContent,
  details: card.shadowRoot.querySelector('[part="details"] > div')?.textContent,
  buttons: Object.fromEntries([...card.querySelectorAll('mu-action-button')].map((button) => [button.fill.data.label,
    { state: button.dataset.state, status: button.shadowRoot.querySelector('.status').textContent,
      reference: button.shadowRoot.querySelector('[part="reference"]')?.textContent }])),
})))()`;
// The click and the read run in one task, before the response of the API can come back.
// Each action of the example has a confirm step. The press reads the step, then accepts it.
const press = (label) => `(() => {
  const button = [...document.querySelectorAll('mu-action-button')].find((node) => node.fill.data.label === ${JSON.stringify(label)});
  button.shadowRoot.querySelector('[part="button"]').click();
  const accept = button.shadowRoot.querySelector('[part="accept"]');
  const cancel = button.shadowRoot.querySelector('[part="cancel"]');
  const control = (node) => node && { name: node.getAttribute('aria-label') ?? node.textContent, icon: node.dataset.icon ?? null,
    svg: Boolean(node.querySelector('svg')), text: node.textContent };
  // The step starts at the start of the action row, below all the actions of the card.
  const step = button.shadowRoot.querySelector('[part="confirm"]')?.getBoundingClientRect();
  const actions = [...button.closest('mu-card').querySelectorAll('mu-action-button')]
    .map((node) => node.shadowRoot.querySelector('[part="button"]').getBoundingClientRect());
  const confirm = { state: button.dataset.state, accept: control(accept), cancel: control(cancel),
    message: button.shadowRoot.querySelector('[part="confirm"] p')?.textContent,
    start: step && Math.abs(step.left - actions[0].left) < 1 && actions.every((box) => step.top >= box.bottom) };
  accept?.click();
  return { confirm, state: button.dataset.state, status: button.shadowRoot.querySelector('.status').textContent };
})()`;

async function main() {
  const steps = [];
  const step = (name, ok, detail) => steps.push({ step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const problems = [];
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  let chrome;
  let api;
  try {
    api = await fixtureApi();
    const started = await startChrome(profile);
    chrome = started.chrome;
    const { session } = started;
    const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true });
    session.listeners.push((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') problems.push(message.params.entry.text);
    });
    for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Accessibility.enable']) await session.send(method, {}, sessionId);
    await open(session, sessionId, api.url);
    const until = async (test) => {
      let value = await evaluate(session, sessionId, STATE);
      for (let i = 0; i < 100 && !test(value); i += 1) {
        await sleep(50);
        value = await evaluate(session, sessionId, STATE);
      }
      return value;
    };

    let cards = await until((value) => value.length === 2);
    step('the page lists the two open decisions as cards', cards.length === 2
      && cards[0].text.includes('Raise the print budget') && cards[1].text.includes('Open the north branch'), cards.map((card) => card.text));
    step('each card shows its evidence and the status of the API', cards.length === 2
      && cards[0].text.includes('Amount') && cards[0].text.includes('240 credits') && cards[0].text.includes('Synthetic budget sheet, row 12')
      && cards.every((card) => card.text.includes('Statusopen')), cards.map((card) => card.text));
    step('each action waits for a person', cards.every((card) => Object.values(card.buttons).every((button) => button.state === 'default')), cards);

    const pending = await evaluate(session, sessionId, press('Approve D-0001'));
    // Decision 0009, sections 3 and 4: the confirm step of a check action shows a check and a cross.
    const { accept, cancel } = pending.confirm;
    step('the approve asks for a confirm step with a check and a cross', pending.confirm.state === 'confirm'
      && pending.confirm.message === 'Approve D-0001?' && accept?.icon === 'check' && accept.svg && accept.text === ''
      && accept.name === 'Confirm: approve D-0001' && cancel?.icon === 'cross' && cancel.svg && cancel.name === 'Cancel', pending.confirm);
    step('the approve confirm step starts below the actions, at the start of the row', pending.confirm.start, pending.confirm);
    step('the approve is pending before the receipt', pending.state === 'pending' && pending.status === 'Pending', pending);
    cards = await until((value) => value[0].buttons['Approve D-0001'].state !== 'pending' && value[0].text.includes('approved'));
    const approve = cards[0].buttons['Approve D-0001'];
    step('the receipt of the API makes the approve done', approve.state === 'done' && approve.status.startsWith('Done:')
      && /^Reference: A-\d{4}$/.test(approve.reference), approve);
    step('the card shows the new status of the API', cards[0].text.includes('approved'), cards[0].text);

    const rejected = await evaluate(session, sessionId, press('Reject D-0001'));
    // A check for a rejection is not clear, so the confirm step of the reject keeps its text.
    step('the reject confirm step shows its text and no check', rejected.confirm.state === 'confirm'
      && rejected.confirm.accept?.text === 'Confirm: reject D-0001' && !rejected.confirm.accept.svg && rejected.confirm.accept.icon === null
      && rejected.confirm.cancel?.text === 'Cancel' && !rejected.confirm.cancel.svg, rejected.confirm);
    step('the reject confirm step has no indent', rejected.confirm.start, rejected.confirm);
    cards = await until((value) => value[0].buttons['Reject D-0001'].state !== 'pending');
    const reject = cards[0].buttons['Reject D-0001'];
    step('the refusal of the API shows as an error', reject.state === 'error' && reject.status.includes('already approved'), reject);
    step('the refusal does not change the approve', cards[0].buttons['Approve D-0001'].state === 'done', cards[0].buttons);

    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const named = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
    for (const [role, name] of [['list', 'Open decisions'], ['article', 'Raise the print budget of the east reading room'],
      ['button', 'Approve D-0001'], ['button', 'Reject D-0002']]) {
      step(`the accessibility tree has the ${role} ${name}`, named.some(([r, n]) => r === role && n === name), name);
    }
    steps.push(...await coverSteps(session, sessionId));

    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const fetchFromApi = window.fetch.bind(window);
      window.fetch = async (path, options) => {
        const response = await fetchFromApi(path, options);
        if (path !== '/api/decisions' || !response.ok) return response;
        const { decisions } = await response.json();
        const { author, ...decision } = decisions[0];
        return Response.json({ decisions: [
          { ...decision, id: 'D-0003' },
          { ...decision, id: 'D-0004', author: { ...author, type: 'unknown' } },
          ...decisions,
        ] });
      };
    ` }, sessionId);
    await open(session, sessionId, api.url);
    cards = await until((value) => value.length === 3);
    step('a missing or invalid author causes a refusal for each decision', cards.length === 3
      && cards.slice(0, 2).every((card) => card.state === 'refused' && card.details?.includes('slots.authorship')
        && Object.keys(card.buttons).length === 0), cards);
    step('the valid decision shows its actions after the refusals', cards.length === 3
      && cards[2].text.includes('Open the north branch') && cards[2].buttons['Approve D-0002']?.state === 'default', cards[2]);
  } catch (error) {
    step('the check runs', false, String(error.message || error));
  } finally {
    if (chrome) chrome.kill();
    if (api) api.server.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  for (const problem of problems) step('no page error', false, problem);
  const report = { passed: steps.every((item) => item.ok), page: 'examples/cards/approval.html', steps };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

main();
