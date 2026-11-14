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
    ['form', 'Loan details'], ['textbox', 'Branch'], ['group', 'Citation'], ['button', 'Open source: Keyboard source'],
    ['group', 'Source excerpt'], ['button', 'Open source: Keyboard excerpt source']],
  'tests/browser/thread.html': [['button', 'Keyboard target'], ['list', 'Thread'], ['article', 'Message from Robin, Person'],
    ['article', 'Message from Renewal agent, Agent']],
  'tests/browser/register.html': [['button', 'Keyboard target'], ['article', 'Plot 4'], ['article', 'Plot 7']],
};
// Each example page, the number of kit elements, the number of refused elements and the roles and names.
const EXAMPLES = {
  'examples/primitives.html': [16, 1, [['button', 'Renew'], ['group', 'Loan details'], ['group', 'Reading list'], ['textbox', 'Shelf code']]],
  'examples/loans.html': [9, 0, [['article', 'Field guide to moss'], ['button', 'Renew'], ['list', 'Current loans'], ['form', 'Change a loan']]],
  'examples/citation.html': [3, 1, [['group', 'Citation'], ['button', 'Open source: Synthetic weather notes, page 3'], ['article', 'Message from agent-weather']]],
  'examples/excerpt.html': [2, 1, [['group', 'Source excerpt'], ['button', 'Open source: Synthetic harbor guide, section 2'], ['article', 'Message from agent-reader']]],
  'examples/provenance.html': [2, 1, [['article', 'Renewal rule for short loans'], ['button', 'Open source: Synthetic library rules, section 4']]],
  'examples/register.html': [4, 1, [['article', 'Tray A1'], ['list', 'Thread'], ['article', 'Message from Garden helper, Agent'], ['article', 'Tray B2']]],
};
// Each example app, the kit elements of its first view, and the roles and names that its accessibility tree must have.
// tools/apps_server.py serves the apps. tests/browser/apps.mjs checks the main flow of each app.
const APPS = {
  'examples/apps/': [0, [['list', 'Example apps'], ['link', 'Support desk'], ['link', 'Change review'], ['link', 'Field inspection']]],
  'examples/apps/support/': [9, [['group', 'Ticket queue'], ['article', 'T-2041 Charged twice for one ride'], ['button', 'Open T-2041'],
    ['heading', 'No ticket open']]],
  'examples/apps/changes/': [6, [['article', 'CR-311 Run route 12 every 15 minutes on Saturday'], ['button', 'Open CR-311'],
    ['heading', 'Decision log']]],
  'examples/apps/inspection/': [6, [['list', 'Thread'], ['article', 'Message from Field agent, Agent'], ['list', 'Checklist I-0417'],
    ['form', 'Findings for I-0417'], ['textbox', 'Outlet pressure in bar'], ['button', 'Save findings']]],
};
// The theme and the width of each app check. The phone width is 375 CSS pixels.
const APP_VIEWS = {
  light: [MODES.light, null], dark: [MODES.dark, null],
  'phone light': [MODES.light, 375], 'phone dark': [MODES.dark, 375],
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
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error('page error: ' + (details.exception?.description || details.text));
  }
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

// Starts a Python server of tools/ on a free port. The server gives its URL on its first line of output.
export async function pythonServer(name, args) {
  const server = spawn(process.env.PYTHON || 'python3', ['-B', join(ROOT, 'tools', name), ...args],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((done, fail) => {
    let out = '';
    const timer = setTimeout(() => fail(new Error(`tools/${name} did not start`)), 10000);
    server.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes('\n')) {
        clearTimeout(timer);
        done(out.split('\n')[0].trim());
      }
    });
    server.on('exit', () => fail(new Error(`tools/${name} stopped`)));
  });
  return { server, url };
}

// Starts tools/thread_server.py with no delay. It gives the URL of the example on its first line.
const threadServer = () => pythonServer('thread_server.py', ['--port', '0', '--no-delay']);

// The thread example through server-sent events: two people, two agents, one refused component and
// one action. The action shows done only after the receipt of the API comes back.
async function threadExample(session, sessionId, report) {
  const page = 'examples/thread.html';
  const steps = [];
  const step = (name, ok, detail) => steps.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const { server, url } = await threadServer();
  try {
    await open(session, sessionId, url);
    const state = () => evaluate(session, sessionId, `(() => {
      const thread = document.querySelector('mu-thread');
      const root = thread?.shadowRoot;
      if (!root) return null;
      const button = root.querySelector('mu-action-button');
      return { state: thread.dataset.state,
        actors: [...root.querySelectorAll('li.message .actor')].map((node) => node.textContent),
        refusals: [...root.querySelectorAll('.refusal')].map((node) => node.textContent),
        card: root.querySelector('mu-card')?.shadowRoot.textContent || '',
        action: button?.dataset.state, status: button?.shadowRoot.querySelector('.status').textContent };
    })()`);
    // The module can run after the load event, so the check waits for the element too.
    let value = await state();
    for (let i = 0; i < 100 && (!value || value.state === 'idle' || value.state === 'reading'); i += 1) {
      await sleep(50);
      value = await state();
    }
    const where = value ? value.state : await evaluate(session, sessionId, `[location.href, document.readyState, Boolean(customElements.get('mu-thread'))].join(' ')`);
    step('the source ends', value?.state === 'ended', where);
    if (value?.state !== 'ended') return steps;
    const actors = new Set(value.actors);
    step('two people and two agents', ['Robin Person', 'Sam Person', 'Catalog agent Agent', 'Renewal agent Agent'].every((name) => actors.has(name)), value.actors);
    step('the undeclared component is refused', value.refusals.length === 1 && value.refusals[0].includes('banner'), value.refusals);
    step('the streamed card shows its last snapshot', value.card.includes('Renewals') && value.card.includes('1 of 3'), value.card);
    step('the action waits for a person', value.action === 'default', value);
    // The click and the read run in one task, before the response of the API can come back.
    const pending = await evaluate(session, sessionId, `(() => {
      const button = document.querySelector('mu-thread').shadowRoot.querySelector('mu-action-button');
      button.shadowRoot.querySelector('button').click();
      return { action: button.dataset.state, status: button.shadowRoot.querySelector('.status').textContent };
    })()`);
    for (let i = 0; i < 100 && value.action !== 'done' && value.action !== 'error'; i += 1) {
      await sleep(50);
      value = await state();
    }
    step('the action is pending before the receipt', pending.action === 'pending' && pending.status === 'Pending', pending);
    step('the receipt of the API makes the action done', value.action === 'done' && /^Done: .*Reference: R-\d{4}$/.test(value.status), value);
    report.accessibility.push(...await axErrors(session, sessionId, [['list', 'Thread'], ['article', 'Message from Robin, Person'],
      ['article', 'Message from Catalog agent, Agent'], ['article', 'Message from Renewal agent, Agent'], ['button', 'Renew']], page));
  } finally {
    server.kill();
  }
  return steps;
}

// The example apps in each theme and at the phone width: the page loads with no error, shows its kit elements with no
// refusal, has the roles and names, has no horizontal scroll, and its body text has a contrast of 4.5 or more.
async function appPages(session, sessionId, report) {
  const steps = [];
  const { server, url } = await pythonServer('apps_server.py', ['--port', '0']);
  const base = url.slice(0, url.indexOf('/examples/'));
  try {
    for (const [view, [features, width]] of Object.entries(APP_VIEWS)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      if (width) await session.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 2, mobile: true }, sessionId);
      else await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
      for (const [page, [elements, expected]] of Object.entries(APPS)) {
        await open(session, sessionId, `${base}/${page}`);
        let found = null;
        for (let i = 0; i < 100; i += 1) {
          found = await evaluate(session, sessionId, `(() => {
            const all = [];
            const walk = (root) => { for (const node of root.querySelectorAll('*')) {
              if (node.tagName.startsWith('MU-')) all.push(node);
              if (node.shadowRoot) walk(node.shadowRoot);
            } };
            walk(document);
            const rgb = (value) => value.match(/[0-9.]+/g).slice(0, 3).map(Number);
            const lum = (value) => { const [r, g, b] = rgb(value).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const style = getComputedStyle(document.body);
            const [light, dark] = [lum(style.color), lum(style.backgroundColor)].sort((a, b) => b - a);
            return { ready: !document.getElementById('main').dataset.state || document.getElementById('main').dataset.state === 'ready',
              elements: all.length, refused: all.filter((node) => node.dataset.state === 'refused').length,
              scroll: document.documentElement.scrollWidth - innerWidth, width: innerWidth,
              dark: matchMedia('(prefers-color-scheme: dark)').matches, background: lum(style.backgroundColor),
              contrast: Math.round(((light + 0.05) / (dark + 0.05)) * 10) / 10 };
          })()`);
          if (found.ready && found.elements >= elements) break;
          await sleep(50);
        }
        const theme = view.endsWith('dark') ? found.dark && found.background < 0.1 : !found.dark && found.background > 0.8;
        const ok = found.ready && found.elements === elements && found.refused === 0 && found.scroll <= 0
          && (!width || found.width === width) && theme && found.contrast >= 4.5;
        steps.push({ page, step: `${view}: ${elements} kit elements, no refusal, no horizontal scroll, the theme and a contrast of 4.5`, ok,
          detail: JSON.stringify(found) });
        report.accessibility.push(...await axErrors(session, sessionId, expected, `${page} ${view}`));
      }
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    server.kill();
  }
  return steps;
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  const report = { passed: false, chrome: '', pages: {}, accessibility: [], keyboard: [], examples: [], errors: [],
    scope: 'Headless Chrome on this machine: the check pages in four media modes, the accessibility tree, the keyboard the example pages, and the example apps in the light theme, the dark theme and at the phone width. No screen reader.' };
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
        // The open button of a citation: Enter and Space press it. Each press sends one mu-open event.
        if (await evaluate(session, sessionId, 'typeof window.muFocusCitation === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusCitation()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          const opens = await evaluate(session, sessionId, 'window.muCitationOpens()');
          report.keyboard.push({ page, step: 'Enter and Space press the open button of a citation', ok: opens === 2, detail: opens });
        }
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
    report.examples.push(...await threadExample(session, sessionId, report));
    report.examples.push(...await appPages(session, sessionId, report));
    for (const item of report.accessibility) if (!item.ok) report.errors.push(`accessibility: ${item.where}: no ${item.role} named ${item.name}`);
    for (const step of [...report.keyboard, ...report.examples]) if (!step.ok) report.errors.push(`${step.page}: ${step.step}: ${step.detail}`);
    for (const problem of problems) report.errors.push('page error: ' + problem);
  } catch (error) {
    report.errors.push(String(error.message || error));
  } finally {
    if (chrome) chrome.kill();
    server.close();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  report.passed = report.errors.length === 0;
  // Exit only after the report is written. A pipe can take less than the full report at one time.
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

// Run the check only when Node runs this file. tools/screenshots.mjs imports the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
