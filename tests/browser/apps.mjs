#!/usr/bin/env node
// The browser check of the main flow of each example app in examples/apps/, against the fixture API tools/apps_server.py.
// Expected results, from issue #67:
// - Support desk: the queue shows 4 open tickets. T-2041 opens a thread with the customer, a person on the team and two
//   agents, and one refused part. The person corrects the draft and sends it. The form shows Pending, then Done with a
//   reference MSG-nnnn only after the receipt. The queue shows the ticket as answered, and the thread shows the reference.
// - Change review: CR-311 opens a thread with a cited card and two excerpts of two agents. Approve opens a confirm step.
//   After the confirm, the button shows Pending, then Done with a reference CHG-nnnn. The decision log shows the reference.
// - Field inspection: the registered checklist shows 6 items, 2 not checked. The API refuses a bad seal value, and the form
//   shows Not done with the reason. A good value gives Done with INS-nnnn and a new checklist. The close action has a
//   confirm step and shows Done with a reference INS-nnnn after the receipt.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate, open, pythonServer, sleep, startChrome } from '../../tools/browser_check.mjs';

// Helpers in the page: find kit elements in shadow roots, read the state of an action element, edit a field.
const HELPERS = `window.mu = {
  all(selector, root = document) {
    const found = [...root.querySelectorAll(selector)];
    for (const node of root.querySelectorAll('*')) if (node.shadowRoot) found.push(...window.mu.all(selector, node.shadowRoot));
    return found;
  },
  one(selector) { return window.mu.all(selector)[0]; },
  action(node) { return node ? { state: node.dataset.state, status: node.shadowRoot.querySelector('.status').textContent } : null; },
  press(node, part = 'button') { node.shadowRoot.querySelector(part === 'button' ? 'button' : '[part=' + part + ']').click(); },
  edit(form, name, change) {
    const field = [...form.shadowRoot.querySelectorAll('mu-field')].find((item) => item.fill.data.name === name);
    const input = field.shadowRoot.querySelector('input');
    input.value = change(input.value);
    input.dispatchEvent(new Event('input'));
  },
  thread() {
    const root = document.querySelector('mu-thread')?.shadowRoot;
    return root ? { actors: [...root.querySelectorAll('li.message .actor')].map((node) => node.textContent),
      refusals: [...root.querySelectorAll('.refusal')].map((node) => node.textContent), text: root.textContent } : null;
  },
}, true`;

async function main() {
  const steps = [];
  const step = (page, name, ok, detail) => steps.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const problems = [];
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  let chrome;
  let api;
  try {
    api = await pythonServer('apps_server.py', ['--port', '0']);
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
    for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable']) await session.send(method, {}, sessionId);
    const run = (expression) => evaluate(session, sessionId, expression);
    // Waits until the expression gives a true value, for 5 seconds at most. Gives the last value.
    const until = async (expression) => {
      let value = await run(expression);
      for (let i = 0; i < 100 && !value; i += 1) {
        await sleep(50);
        value = await run(expression);
      }
      return value;
    };
    const visit = async (app) => {
      await open(session, sessionId, api.url + app + '/');
      await until(`document.getElementById('main')?.dataset.state === 'ready'`);
      await run(HELPERS);
    };

    // Support desk.
    let page = 'examples/apps/support/';
    await visit('support');
    const queue = await run(`mu.all('mu-card').map((card) => card.shadowRoot.textContent)`);
    step(page, 'the queue shows 4 open tickets', queue.length === 4 && queue.every((text) => text.includes('StatusOpen'))
      && queue[0].includes('T-2041 Charged twice for one ride'), queue);
    await run(`mu.press(mu.all('mu-button').find((node) => node.fill.data.label === 'Open T-2041')), true`);
    let thread = await until(`(() => { const t = mu.thread(); return t && mu.one('mu-editable-form') ? t : null; })()`);
    step(page, 'the thread shows the customer, a person on the team and two agents', thread
      && ['Ines K. Person', 'Alex P. Person', 'Triage agent Agent', 'Reply agent Agent'].every((name) => thread.actors.includes(name)), thread?.actors);
    step(page, 'the thread refuses one undeclared component', thread?.refusals.length === 1 && thread.refusals[0].includes('mood-meter'), thread?.refusals);
    step(page, 'the heading names the open ticket', await run(`document.getElementById('ticket-title').textContent`) === 'T-2041: Charged twice for one ride', '');
    const sent = await run(`(() => {
      const form = mu.one('mu-editable-form');
      const before = mu.action(form);
      mu.edit(form, 'reply', (value) => value.replace('6.80', '3.40'));
      form.shadowRoot.querySelector('button[type=submit]').click();
      return { before, pending: mu.action(form) };
    })()`);
    step(page, 'the form waits for a person, then shows Pending before the receipt', sent.before.state === 'default'
      && sent.pending.state === 'pending' && sent.pending.status === 'Pending', sent);
    let form = await until(`(() => { const a = mu.action(mu.one('mu-editable-form')); return a.state === 'pending' ? null : a; })()`);
    step(page, 'the receipt makes the reply done, with a reference', form?.state === 'done'
      && /^Done: The reply to T-2041 is sent, with the edits of a person\.Reference: MSG-\d{4}$/.test(form.status), form);
    const reference = form?.status.match(/MSG-\d{4}/)?.[0];
    thread = await until(`(() => { const t = mu.thread(); return t.actors.includes('Help desk System') ? t : null; })()`);
    step(page, 'the thread shows the sent reply and the reference', thread?.text.includes('We refunded 3.40 to your card.')
      && thread.text.includes(`T-2041 is answered. Reference ${reference}.`), thread?.actors);
    const answered = await until(`mu.all('mu-card')[0].shadowRoot.textContent.includes('StatusAnswered')`);
    step(page, 'the queue shows the ticket as answered', answered, '');

    // Change review.
    page = 'examples/apps/changes/';
    await visit('changes');
    step(page, 'the log has no decision', await run(`document.getElementById('log').textContent`) === 'No decisions yet.', '');
    await run(`mu.press(mu.all('mu-button').find((node) => node.fill.data.label === 'Open CR-311')), true`);
    thread = await until(`(() => { const t = mu.thread(); return t && mu.all('mu-excerpt').length === 2 ? t : null; })()`);
    step(page, 'the thread shows the proposal of the planning agent and the evidence of two agents', thread
      && thread.actors.filter((name) => name === 'Planning agent Agent').length === 3 && thread.actors.includes('Policy agent Agent')
      && thread.refusals.length === 0, thread?.actors);
    const cited = await run(`mu.all('mu-card').find((card) => card.getRootNode() !== document)?.shadowRoot.textContent || ''`);
    step(page, 'the proposal card cites its source', cited.includes('Synthetic ridership report 2026, section 3'), cited);
    const approve = await run(`(() => {
      const button = mu.all('mu-action-button').find((node) => node.fill.data.label === 'Approve CR-311');
      mu.press(button);
      const asked = { ...mu.action(button), step: button.shadowRoot.querySelector('[part=confirm]')?.getAttribute('aria-label') };
      mu.press(button, 'accept');
      return { asked, pending: mu.action(button) };
    })()`);
    step(page, 'Approve opens a confirm step and sends nothing', approve.asked.state === 'confirm'
      && approve.asked.step === 'Approve CR-311? The timetable changes on 2026-12-06.', approve.asked);
    step(page, 'the confirm shows Pending before the receipt', approve.pending.state === 'pending' && approve.pending.status === 'Pending', approve.pending);
    const done = await until(`(() => { const a = mu.action(mu.all('mu-action-button').find((node) => node.fill.data.label === 'Approve CR-311')); return a.state === 'pending' ? null : a; })()`);
    step(page, 'the receipt makes the approve done, with a reference', done?.state === 'done' && /^Done: The change CR-311 is approved\.Reference: CHG-\d{4}$/.test(done.status), done);
    const change = done?.status.match(/CHG-\d{4}/)?.[0];
    const log = await until(`(() => { const t = document.getElementById('log').textContent; return t.includes('CHG-') ? t : null; })()`);
    step(page, 'the decision log shows the reference of the receipt', log === `${change}: CR-311 approved. Run route 12 every 15 minutes on Saturday.`, log);
    thread = await until(`(() => { const t = mu.thread(); return t.actors.includes('Change log System') ? t : null; })()`);
    step(page, 'the thread records the decision', thread?.text.includes(`Jordan M. approved CR-311. Reference ${change}.`), thread?.actors);
    step(page, 'the list shows the change as approved', await until(`mu.all('mu-card')[0].shadowRoot.textContent.includes('StatusApproved')`), '');

    // Field inspection.
    page = 'examples/apps/inspection/';
    await visit('inspection');
    const checklist = `mu.one('mu-app-inspection-checklist')?.shadowRoot.textContent || ''`;
    let list = await until(checklist);
    step(page, 'the registered checklist shows 6 items, 2 not checked', (list.match(/Not checked/g) || []).length === 2
      && (list.match(/Pass/g) || []).length === 4, list);
    const bad = await run(`(() => {
      const form = mu.one('mu-editable-form');
      mu.edit(form, 'pressure', () => '4.2');
      mu.edit(form, 'seal', () => 'fine');
      form.shadowRoot.querySelector('button[type=submit]').click();
      return mu.action(form);
    })()`);
    step(page, 'the save shows Pending before the receipt', bad.state === 'pending', bad);
    form = await until(`(() => { const a = mu.action(mu.one('mu-editable-form')); return a.state === 'pending' ? null : a; })()`);
    step(page, 'the API refuses a bad seal value, and the form shows the reason', form?.state === 'error'
      && form.status === 'Not done: Write ok, worn or leak for the valve seal.', form);
    await run(`(() => { const form = mu.one('mu-editable-form'); mu.edit(form, 'seal', () => 'worn'); form.shadowRoot.querySelector('button[type=submit]').click(); return true; })()`);
    form = await until(`(() => { const a = mu.action(mu.one('mu-editable-form')); return a.state === 'pending' ? null : a; })()`);
    step(page, 'the receipt makes the findings done, with a reference', form?.state === 'done'
      && /^Done: The findings for I-0417 are saved\.Reference: INS-\d{4}$/.test(form.status), form);
    list = await until(`(() => { const t = ${checklist}; return t.includes('Needs work') ? t : null; })()`);
    step(page, 'the API replaces the checklist with the findings', list?.includes('4.2 bar today') && list.includes('Worn today')
      && !list.includes('Not checked'), list);
    await until(`mu.one('mu-action-button')`);
    const close = await run(`(() => {
      const button = mu.one('mu-action-button');
      mu.press(button);
      const asked = mu.action(button);
      mu.press(button, 'accept');
      return { asked, pending: mu.action(button) };
    })()`);
    step(page, 'Close opens a confirm step, then shows Pending', close.asked.state === 'confirm' && close.pending.state === 'pending', close);
    const closed = await until(`(() => { const a = mu.action(mu.one('mu-action-button')); return a.state === 'pending' ? null : a; })()`);
    step(page, 'the receipt makes the close done, with a reference', closed?.state === 'done'
      && /^Done: The inspection I-0417 is closed\.Reference: INS-\d{4}$/.test(closed.status), closed);
    thread = await until(`(() => { const t = mu.thread(); return t.text.includes('I-0417 is closed.') ? t : null; })()`);
    step(page, 'the thread shows the closed inspection', thread?.actors.includes('Dispatch System') && thread.refusals.length === 0, thread?.actors);
  } catch (error) {
    step('examples/apps/', 'the check runs', false, String(error.message || error));
  } finally {
    if (chrome) chrome.kill();
    if (api) api.server.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  for (const problem of problems) step('examples/apps/', 'no page error', false, problem);
  const report = { passed: steps.every((item) => item.ok), steps };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

main();
