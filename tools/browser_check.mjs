#!/usr/bin/env node
// The accessibility and rendering check of the kit in headless Chrome, through the Chrome DevTools Protocol.
// It uses only Node.js and Chrome. See docs/decisions/0001-build-tools.md, Option A.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SERVED = ['src', 'catalog', 'examples', join('tests', 'browser')];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const MODES = {
  light: [{ name: 'prefers-color-scheme', value: 'light' }],
  dark: [{ name: 'prefers-color-scheme', value: 'dark' }],
  'forced-colors': [{ name: 'forced-colors', value: 'active' }],
  'reduced-motion': [{ name: 'prefers-reduced-motion', value: 'reduce' }],
};
const EXPECTED_AX = [['button', 'Keyboard target'], ['textbox', 'Shelf code'], ['group', 'Loan details'], ['group', 'Reading list']];
const CHROME = process.env.CHROME || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// A local server for the kit files only. It refuses each path outside the served folders.
function serve() {
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

async function startChrome(profile) {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-sync', '--disable-component-update', '--metrics-recording-only', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  // Keep the end of the Chrome errors. If Chrome does not start, the report gives them.
  let errors = '';
  let exited = false;
  chrome.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-2000); });
  chrome.on('exit', () => { exited = true; });
  chrome.on('error', (error) => { errors += error.message; exited = true; });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile) && !exited; i += 1) await sleep(100);
  if (!existsSync(portFile)) throw new Error(`Chrome did not start: ${CHROME}: ${errors.trim().slice(-600)}`);
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

async function evaluate(session, sessionId, expression) {
  const result = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error('page error: ' + result.exceptionDetails.text);
  return result.result.value;
}

async function open(session, sessionId, url, problems) {
  const loaded = session.once('Page.loadEventFired', sessionId);
  await session.send('Page.navigate', { url }, sessionId);
  await loaded;
  for (let i = 0; i < 50; i += 1) {
    if (await evaluate(session, sessionId, 'document.readyState === "complete"')) break;
    await sleep(50);
  }
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  const report = { passed: false, chrome: '', modes: {}, accessibility: [], keyboard: [], example: [], errors: [],
    scope: 'Headless Chrome on this machine: the primitive checks in four media modes, the accessibility tree, the keyboard and the example page. No screen reader.' };
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

    for (const [mode, features] of Object.entries(MODES)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/tests/browser/primitives.html?mode=${mode}`, problems);
      let checks = null;
      const before = problems.length;
      for (let i = 0; i < 100 && !checks && problems.length === before; i += 1) {
        checks = await evaluate(session, sessionId, 'window.muChecks || null');
        if (!checks) await sleep(50);
      }
      report.modes[mode] = checks ? checks.results : [];
      if (!checks) report.errors.push(`${mode}: the checks did not run`);
      for (const item of report.modes[mode]) if (!item.ok) report.errors.push(`${mode}: ${item.name}: ${item.detail}`);

      if (mode === 'light') {
        // The accessibility tree that a screen reader reads.
        const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
        const named = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
        for (const [role, name] of EXPECTED_AX.slice(0, 2)) {
          const ok = named.some(([r, n]) => r === role && n === name);
          report.accessibility.push({ role, name, ok });
          if (!ok) report.errors.push(`accessibility: no ${role} named ${name}`);
        }
        // Keyboard: Tab moves the focus to the first button. Enter and Space press it.
        await evaluate(session, sessionId, 'document.activeElement && document.activeElement.blur(), true');
        await key(session, sessionId, 'Tab', 'Tab', 9);
        const focused = await evaluate(session, sessionId, 'document.activeElement?.shadowRoot?.activeElement?.textContent || ""');
        report.keyboard.push({ step: 'Tab focuses the first button', ok: focused === 'Keyboard target', detail: focused });
        await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
        await key(session, sessionId, ' ', 'Space', 32, ' ');
        const presses = await evaluate(session, sessionId, 'window.muPresses()');
        report.keyboard.push({ step: 'Enter and Space press the button', ok: presses === 2, detail: presses });
        for (const step of report.keyboard) if (!step.ok) report.errors.push(`keyboard: ${step.step}: ${step.detail}`);
      }
    }

    // The example page loads with no error, shows each primitive and refuses the one invalid fill.
    await session.send('Emulation.setEmulatedMedia', { features: MODES.light }, sessionId);
    await open(session, sessionId, `${base}/examples/primitives.html`, problems);
    await sleep(200);
    const example = await evaluate(session, sessionId, `(() => {
      const all = [...document.querySelectorAll('mu-text, mu-button, mu-field, mu-stack, mu-grid')];
      return { elements: all.length, refused: all.filter((node) => node.dataset.state === 'refused').length };
    })()`);
    report.example.push({ step: 'the example page shows 16 primitives and refuses 1', ok: example.elements === 16 && example.refused === 1, detail: JSON.stringify(example) });
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const named = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
    for (const [role, name] of [['button', 'Renew'], ...EXPECTED_AX.slice(1)]) {
      const ok = named.some(([r, n]) => r === role && n === name);
      report.accessibility.push({ role, name, ok });
      if (!ok) report.errors.push(`accessibility: no ${role} named ${name}`);
    }
    for (const step of report.example) if (!step.ok) report.errors.push(`example: ${step.detail}`);
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

main();
