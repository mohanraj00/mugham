#!/usr/bin/env node
// The accessibility and rendering check of the kit in headless Chrome, through the Chrome DevTools Protocol.
// It uses only Node.js and Chrome. See docs/decisions/0001-build-tools.md, Option A.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SERVED = ['src', 'catalog', 'examples', join('tests', 'browser')];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const MODES = {
  light: [{ name: 'prefers-color-scheme', value: 'light' }],
  dark: [{ name: 'prefers-color-scheme', value: 'dark' }],
  'forced-colors': [{ name: 'forced-colors', value: 'active' }],
  'reduced-motion': [{ name: 'prefers-reduced-motion', value: 'reduce' }],
};
// Each check page, and the roles and names that its accessibility tree must have in light mode.
const PAGES = {
  'tests/browser/primitives.html': [['button', 'Keyboard target'], ['textbox', 'Shelf code']],
  'tests/browser/components.html': [['button', 'Keyboard target'], ['article', 'Field guide to moss'], ['list', 'Loans'],
    ['form', 'Loan details'], ['textbox', 'Branch']],
};
// Each example page, the number of kit elements, the number of refused elements and the roles and names.
const EXAMPLES = {
  'examples/primitives.html': [16, 1, [['button', 'Renew'], ['group', 'Loan details'], ['group', 'Reading list'], ['textbox', 'Shelf code']]],
  'examples/loans.html': [9, 0, [['article', 'Field guide to moss'], ['button', 'Renew'], ['list', 'Current loans'], ['form', 'Change a loan']]],
};
const CHROME = process.env.CHROME || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// A local server for the kit files only. It refuses each path outside the served folders.
export function serve() {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = resolve(ROOT, '.' + path);
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const allowed = SERVED.some((folder) => file.startsWith(join(ROOT, folder) + sep));
    if (request.method !== 'GET' || !allowed || !TYPES[extname(file)] || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] + '; charset=utf-8', 'cache-control': 'no-store' });
    response.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.next = 1;
    this.pending = new Map();
    this.listeners = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { done, fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(message.error.message));
        else done(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.next++;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((done, fail) => this.pending.set(id, { done, fail }));
  }

  once(method, sessionId, timeout = 15000) {
    return new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('timeout: ' + method)), timeout);
      const listener = (message) => {
        if (message.method === method && message.sessionId === sessionId) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((item) => item !== listener);
          done(message.params);
        }
      };
      this.listeners.push(listener);
    });
  }
}

export async function startChrome(profile) {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-sync', '--disable-component-update', '--metrics-recording-only', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  // Keep the start of the Chrome errors, where the cause is. If Chrome does not start, the report gives them.
  let errors = '';
  let exited = false;
  chrome.stderr.on('data', (chunk) => { if (errors.length < 4000) errors = (errors + chunk).slice(0, 4000); });
  chrome.on('exit', () => { exited = true; });
  chrome.on('error', (error) => { errors += error.message; exited = true; });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile) && !exited; i += 1) await sleep(100);
  if (!existsSync(portFile)) {
    const lines = errors.split('\n').filter((line) => /FATAL|ERROR|error/.test(line)).slice(0, 5);
    throw new Error(`Chrome did not start: ${CHROME}: ${(lines.length ? lines.join('\n') : errors).trim().slice(0, 1200)}`);
  }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = () => fail(new Error('no DevTools socket')); });
  return { chrome, session: new Session(socket) };
}

async function key(session, sessionId, name, code, keyCode, text) {
  const base = { key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) }, sessionId);
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
}

export async function evaluate(session, sessionId, expression) {
  const result = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error('page error: ' + result.exceptionDetails.text);
  return result.result.value;
}

export async function open(session, sessionId, url, problems) {
  const loaded = session.once('Page.loadEventFired', sessionId);
  await session.send('Page.navigate', { url }, sessionId);
  await loaded;
  for (let i = 0; i < 50; i += 1) {
    if (await evaluate(session, sessionId, 'document.readyState === "complete"')) break;
    await sleep(50);
  }
}

async function axErrors(session, sessionId, expected, where) {
  const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
  const named = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
  return expected.map(([role, name]) => ({ where, role, name, ok: named.some(([r, n]) => r === role && n === name) }));
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  const report = { passed: false, chrome: '', pages: {}, accessibility: [], keyboard: [], examples: [], errors: [],
    scope: 'Headless Chrome on this machine: the check pages in four media modes, the accessibility tree, the keyboard and the example pages. No screen reader.' };
  let chrome;
  try {
    const started = await startChrome(profile);
    chrome = started.chrome;
    const session = started.session;
    report.chrome = (await session.send('Browser.getVersion')).product;
    const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true });
    const problems = [];
    session.listeners.push((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') problems.push(message.params.entry.text);
    });
    for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Accessibility.enable']) await session.send(method, {}, sessionId);

    for (const [page, expected] of Object.entries(PAGES)) {
      report.pages[page] = {};
      for (const [mode, features] of Object.entries(MODES)) {
        await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
        const before = problems.length;
        await open(session, sessionId, `${base}/${page}?mode=${mode}`, problems);
        let checks = null;
        for (let i = 0; i < 100 && !checks && problems.length === before; i += 1) {
          checks = await evaluate(session, sessionId, 'window.muChecks || null');
          if (!checks) await sleep(50);
        }
        report.pages[page][mode] = checks ? checks.results : [];
        if (!checks) report.errors.push(`${page} ${mode}: the checks did not run`);
        for (const item of report.pages[page][mode]) if (!item.ok) report.errors.push(`${page} ${mode}: ${item.name}: ${item.detail}`);
        if (mode !== 'light' || !checks) continue;
        report.accessibility.push(...await axErrors(session, sessionId, expected, page));
        // Keyboard: Tab moves the focus to the first button. Enter and Space press it.
        await evaluate(session, sessionId, 'document.activeElement && document.activeElement.blur(), true');
        await key(session, sessionId, 'Tab', 'Tab', 9);
        const focused = await evaluate(session, sessionId, 'document.activeElement?.shadowRoot?.activeElement?.textContent || ""');
        report.keyboard.push({ page, step: 'Tab focuses the first button', ok: focused === 'Keyboard target', detail: focused });
        await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
        await key(session, sessionId, ' ', 'Space', 32, ' ');
        const presses = await evaluate(session, sessionId, 'window.muPresses()');
        report.keyboard.push({ page, step: 'Enter and Space press the button', ok: presses === 2, detail: presses });
        if (await evaluate(session, sessionId, 'typeof window.muFocusField === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusField()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          const submits = await evaluate(session, sessionId, 'window.muFormSubmits()');
          report.keyboard.push({ page, step: 'Enter in a field submits the form', ok: submits === 1, detail: submits });
        }
        // The confirm step: Enter opens it, Escape closes it, and only the confirm button sends the action.
        // The accessibility tree must name the group and its buttons. See catalog/README.md#actions.
        if (await evaluate(session, sessionId, 'typeof window.muFocusConfirm === "function"')) {
          const active = () => evaluate(session, sessionId, 'document.activeElement?.shadowRoot?.activeElement?.textContent || ""');
          const confirm = () => evaluate(session, sessionId, 'window.muConfirm()');
          const push = (step, ok, detail) => report.keyboard.push({ page, step, ok, detail: JSON.stringify(detail) });
          await evaluate(session, sessionId, 'window.muFocusConfirm()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          let state = await confirm();
          let focus = await active();
          push('Enter opens the confirm step with the focus on Cancel', state.presses === 0 && state.state === 'confirm' && focus === 'Cancel', { state, focus });
          report.accessibility.push(...await axErrors(session, sessionId, [['group', 'Cancel the loan? You cannot undo this.'],
            ['button', 'Cancel'], ['button', 'Yes, cancel']], page + ' confirm step'));
          await key(session, sessionId, 'Escape', 'Escape', 27);
          state = await confirm();
          focus = await active();
          push('Escape closes the confirm step and sends no action', state.presses === 0 && state.state === 'default' && focus === 'Confirm target', { state, focus });
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          await key(session, sessionId, 'Tab', 'Tab', 9);
          focus = await active();
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          state = await confirm();
          push('Tab and Enter on the confirm button send one action', focus === 'Yes, cancel' && state.presses === 1, { state, focus });
          await evaluate(session, sessionId, 'window.muFocusConfirmField()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          state = await confirm();
          focus = await active();
          push('Enter in a field opens the confirm step of the form', state.submits === 0 && state.formState === 'confirm' && focus === 'Cancel', { state, focus });
          report.accessibility.push(...await axErrors(session, sessionId, [['group', 'Save the new shelf?'], ['button', 'Yes, save']],
            page + ' form confirm step'));
          await key(session, sessionId, 'Tab', 'Tab', 9);
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          state = await confirm();
          push('Space on the confirm button submits the form one time', state.submits === 1, { state });
        }
      }
    }

    // Each example page loads with no error, shows its kit elements and refuses only the planned fills.
    await session.send('Emulation.setEmulatedMedia', { features: MODES.light }, sessionId);
    for (const [page, [elements, refused, expected]] of Object.entries(EXAMPLES)) {
      await open(session, sessionId, `${base}/${page}`, problems);
      await sleep(200);
      const found = await evaluate(session, sessionId, `(() => {
        const all = [];
        const walk = (root) => { for (const node of root.querySelectorAll('*')) {
          if (node.tagName.startsWith('MU-')) all.push(node);
          if (node.shadowRoot) walk(node.shadowRoot);
        } };
        walk(document);
        return { elements: all.length, refused: all.filter((node) => node.dataset.state === 'refused').length };
      })()`);
      report.examples.push({ page, step: `${elements} kit elements and ${refused} refused`,
        ok: found.elements === elements && found.refused === refused, detail: JSON.stringify(found) });
      report.accessibility.push(...await axErrors(session, sessionId, expected, page));
    }
    for (const item of report.accessibility) if (!item.ok) report.errors.push(`accessibility: ${item.where}: no ${item.role} named ${item.name}`);
    for (const step of [...report.keyboard, ...report.examples]) if (!step.ok) report.errors.push(`${step.page}: ${step.step}: ${step.detail}`);
    for (const problem of problems) report.errors.push('page error: ' + problem);
  } catch (error) {
    report.errors.push(String(error.message || error));
  } finally {
    if (chrome) chrome.kill();
    server.close();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }
  report.passed = report.errors.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}

// Run the check only when Node runs this file. tools/screenshots.mjs imports the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
