#!/usr/bin/env node
// The accessibility and rendering check of the kit in headless Chrome, through the Chrome DevTools Protocol.
// It uses only Node.js and Chrome. See docs/decisions/0001-build-tools.md, Option A.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guideChecks } from '../tests/browser/guides.mjs';
import { exampleIndexChecks } from '../tests/browser/examples-index.mjs';
import { imageKeyboardChecks } from '../tests/browser/image.js';
import { cardKeyboardChecks } from '../tests/browser/card.js';
import { readMoreKeyboardChecks } from '../tests/browser/read-more.js';
import { richTextKeyboardChecks } from '../tests/browser/rich-text.js';
import { budgetExampleChecks, dataGridKeyboardChecks } from '../tests/browser/data-grid.js';
import { reviewQueueChecks } from '../tests/browser/review-queue.js';
import { snapshotChecks } from '../tests/browser/snapshots.js';
import { UPLOAD_FILES, uploadExampleChecks, uploadKeyboardChecks } from '../tests/browser/upload.js';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// The upload checks give synthetic files to a file input. The files are in a temporary folder, not in the checkout.
let uploadFolder = null;
function uploadFile(name) {
  if (!uploadFolder) {
    uploadFolder = mkdtempSync(join(tmpdir(), 'mugham-upload-'));
    for (const [file, text] of Object.entries(UPLOAD_FILES)) writeFileSync(join(uploadFolder, file), text);
  }
  return join(uploadFolder, name);
}
const SERVED = ['src', 'catalog', 'examples', join('tests', 'browser')];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const MODES = {
  light: [{ name: 'prefers-color-scheme', value: 'light' }],
  dark: [{ name: 'prefers-color-scheme', value: 'dark' }],
  'forced-colors': [{ name: 'forced-colors', value: 'active' }],
  'reduced-motion': [{ name: 'prefers-reduced-motion', value: 'reduce' }],
};
// Each check page, and the roles and names that its accessibility tree must have in light mode.
const PAGES = {
  'tests/browser/read-more.html': [['button', 'Keyboard target'], ['button', 'Read more'],
    ['StaticText', 'Synthetic notes describe the east path and the small gate. '.repeat(16)
      + 'Last searchable sentence. Search target rich-text.']],
  'tests/browser/card.html': [['button', 'Keyboard target'], ['article', 'Keyboard card'], ['button', 'Collapse Keyboard card'],
    ['button', 'Expand all'], ['button', 'Collapse all']],
  'tests/browser/chart.html': [['button', 'Keyboard target'], ['group', 'Weekly tickets'], ['image', 'Received, Week 1: 12 tickets'], ['table', 'Weekly tickets'], ['columnheader', 'Received'], ['cell', '12 tickets']],
  'tests/browser/table.html': [['button', 'Keyboard target'], ['group', 'Sample rows'], ['table', 'Sample rows'], ['columnheader', 'Name'], ['columnheader', 'Status'], ['cell', 'Ready']],
  'tests/browser/status.html': [['button', 'Keyboard target'], ['group', 'Synthetic check A.'], ['group', 'Synthetic check B.'], ['group', 'Synthetic check C.'], ['group', 'Synthetic check D.']],
  'tests/browser/image.html': [['button', 'Keyboard target'], ['group', 'Image'], ['button', 'Open image at full size: Two rooms with a door.']],
  'tests/browser/rich-text.html': [['button', 'Keyboard target'], ['heading', 'Tray care'], ['heading', 'Details'], ['button', 'Synthetic rules'],
    ['list', ''], ['listitem', ''], ['blockquote', ''], ['code', '']],
  'tests/browser/data-grid.html': [['button', 'Keyboard target'], ['group', 'Synthetic budget'], ['grid', 'Synthetic budget'], ['columnheader', 'January'],
    ['rowheader', 'Rent'], ['gridcell', 'Paid by transfer'], ['gridcell', 'Late Changed']],
  'tests/browser/upload.html': [['button', 'Keyboard target'], ['group', 'Attach a note'], ['group', 'Attach receipts'], ['button', 'Choose files'],
    ['list', 'Files'], ['button', 'Remove pending.pdf'], ['button', 'Upload']],
  'tests/browser/primitives.html': [['button', 'Keyboard target'], ['textbox', 'Shelf code']],
  'tests/browser/components.html': [['button', 'Keyboard target'], ['article', 'Field guide to moss'], ['list', 'Loans'],
    ['form', 'Loan details'], ['textbox', 'Branch'], ['group', 'Citation'], ['button', 'Open source: Keyboard source'],
    ['group', 'Source excerpt'], ['button', 'Open source: Keyboard excerpt source'], ['group', 'Keyboard diff']],
  'tests/browser/thread.html': [['button', 'Keyboard target'], ['list', 'Thread'], ['article', 'Message from Robin, Person'],
    ['article', 'Message from Renewal agent, Agent']],
  'tests/browser/register.html': [['button', 'Keyboard target'], ['article', 'Plot 4'], ['article', 'Plot 7']],
};
// Each example page, the number of kit elements, the number of refused elements and the roles and names.
const EXAMPLES = {
  'examples/media/chart.html': [6, 0, [['group', 'Synthetic weekly tickets'], ['group', 'Synthetic weekly visits'], ['group', 'Synthetic weekly tasks'], ['button', 'Show data table']]],
  'examples/evidence/narration.html': [2, 0, [['article', 'Tray A1'], ['heading', 'Matching narration'], ['heading', 'Different narration']]],
  'examples/tables/table.html': [2, 0, [['table', 'Synthetic plots'], ['columnheader', 'Plot'], ['cell', 'Ready']]],
  'examples/cards/status.html': [5, 1, [['group', 'Synthetic check A.'], ['group', 'Synthetic check B.'], ['group', 'Synthetic check C.'], ['group', 'Synthetic check D.']]],
  'examples/media/image.html': [4, 1, [['group', 'Image'], ['article', 'Synthetic floor plan'], ['article', 'Message from agent-plan']]],
  'examples/thread/rich-text.html': [6, 1, [['list', 'Thread'], ['article', 'Message from Garden helper, Agent'], ['heading', 'Plant out tray B2'],
    ['button', 'synthetic planting guide'], ['article', 'Tray B2']]],
  'examples/tables/budget.html': [1, 0, [['group', 'Synthetic budget 2027'], ['grid', 'Synthetic budget 2027'], ['columnheader', 'January'], ['rowheader', 'Total'],
    ['gridcell', '1575']]],
  'examples/tables/review-queue.html': [1, 0, [['table', 'Open review tasks'], ['columnheader', 'Extracted value'], ['cell', 'R-101'], ['list', 'Tasks to review'], ['button', 'Review R-101']]],
  'examples/tables/snapshots.html': [1, 0, [['table', 'Collections'], ['columnheader', 'Snapshots'], ['cell', 'Ingredients'], ['list', 'Collections to open'], ['button', 'Open Ingredients']]],
  'examples/cards/primitives.html': [16, 1, [['button', 'Renew'], ['group', 'Loan details'], ['group', 'Reading list'], ['textbox', 'Shelf code']]],
  'examples/cards/loans.html': [9, 0, [['article', 'Field guide to moss'], ['button', 'Renew'], ['list', 'Current loans'], ['form', 'Change a loan']]],
  'examples/evidence/citation.html': [3, 1, [['group', 'Citation'], ['button', 'Open source: Synthetic weather notes, page 3'], ['article', 'Message from agent-weather']]],
  'examples/evidence/diff.html': [2, 0, [['group', 'Hall booking B-0042'], ['group', 'Weekly timetable'], ['article', 'Message from Bookings agent']]],
  'examples/cards/offline.html': [5, 0, [['status', 'Tool library'], ['list', 'Tools'], ['button', 'Go offline']]],
  'examples/evidence/excerpt.html': [2, 1, [['group', 'Source excerpt'], ['button', 'Open source: Synthetic harbor guide, section 2'], ['article', 'Message from agent-reader']]],
  'examples/evidence/provenance.html': [2, 1, [['article', 'Renewal rule for short loans'], ['button', 'Open source: Synthetic library rules, section 4']]],
  'examples/forms/inputs.html': [6, 0, [['form', 'Loan details'], ['textbox', 'Shelf code'], ['textbox', 'Note'], ['textbox', 'Copies'],
    ['textbox', 'Due date'], ['group', 'Branch'], ['radio', 'Harbor']]],
  'examples/forms/membership.html': [2, 0, [['list', 'Thread'], ['article', 'Message from Forms agent, Agent'], ['form', 'Membership form'],
    ['group', 'Household'], ['button', 'Edit Children: 1'], ['button', 'Send changes']]],
  'examples/cards/register.html': [4, 1, [['article', 'Tray A1'], ['list', 'Thread'], ['article', 'Message from Garden helper, Agent'], ['article', 'Tray B2']]],
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

// The docs panel of an example page must have a part for each component that the page shows, also for a
// component that shows only after a person does a step (issue 100). On each example page, WATCH records each
// kit element in each shadow root, 40 times in a second. COVER reads the record before the check leaves the page.
const WATCH = `(() => {
  if (window.muSeen) return true;
  window.muSeen = new Set();
  const walk = (root) => { for (const node of root.querySelectorAll('*')) {
    if (node.tagName === 'MU-THREAD') window.muSeen.add('thread');
    else if (node.tagName.startsWith('MU-') && node.constructor.component) window.muSeen.add(node.constructor.component);
    if (node.shadowRoot) walk(node.shadowRoot);
  } };
  window.muLook = () => walk(document);
  window.muLook();
  setInterval(window.muLook, 25);
  return true;
})()`;
const COVER = `(() => {
  const aside = document.querySelector('body > aside.example-docs');
  if (!window.muSeen || !aside) return null;
  window.muLook();
  const parts = [...aside.querySelectorAll(':scope > details')].map((part) => part.dataset.component);
  return { page: location.pathname.slice(1), seen: [...window.muSeen], missing: [...window.muSeen].filter((name) => !parts.includes(name)) };
})()`;
const covered = new Map();

async function cover(session, sessionId) {
  let found = null;
  try {
    found = await evaluate(session, sessionId, COVER);
  } catch {
    return;
  }
  if (!found) return;
  const entry = covered.get(found.page) ?? { seen: new Set(), missing: new Set() };
  for (const name of found.seen) entry.seen.add(name);
  for (const name of found.missing) entry.missing.add(name);
  covered.set(found.page, entry);
}

// One step for each example page that the check opened. Call it after the last flow.
export async function coverSteps(session, sessionId) {
  await cover(session, sessionId);
  return [...covered].map(([page, { seen, missing }]) => ({ page, step: 'the docs panel has a part for each component that the page showed',
    ok: missing.size === 0, detail: JSON.stringify({ missing: [...missing], seen: [...seen] }) }));
}

export async function open(session, sessionId, url, problems) {
  await cover(session, sessionId);
  const loaded = session.once('Page.loadEventFired', sessionId);
  await session.send('Page.navigate', { url }, sessionId);
  await loaded;
  for (let i = 0; i < 50; i += 1) {
    if (await evaluate(session, sessionId, 'document.readyState === "complete"')) break;
    await sleep(50);
  }
  if (new URL(url).pathname.includes('/examples/')) await evaluate(session, sessionId, WATCH);
}

async function axErrors(session, sessionId, expected, where) {
  const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
  const named = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
  return expected.map(([role, name]) => ({ where, role, name, ok: named.some(([r, n]) => r === role && n === name) }));
}

// The generic rules of decision 0006. They cover the risks of the axe-core rules that apply to the markup of the kit.
// Each control in the accessibility tree has a name. In each root, an id is unique and each id reference finds its
// target. Each role, each value of an ARIA attribute and each tabindex is valid. A tabindex above 0 changes the focus order.
const CONTROLS = new Set(['button', 'checkbox', 'combobox', 'DisclosureTriangle', 'link', 'listbox', 'menuitem', 'radio',
  'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox']);
export async function pageRules(session, sessionId, where) {
  const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
  const unnamed = nodes.filter((node) => !node.ignored && CONTROLS.has(node.role?.value) && !node.name?.value?.trim())
    .map((node) => node.role.value);
  const markup = await evaluate(session, sessionId, `(() => {
    const ROLES = new Set(['alert', 'article', 'button', 'checkbox', 'dialog', 'form', 'grid', 'group', 'heading', 'img', 'link', 'list',
      'listitem', 'log', 'main', 'navigation', 'none', 'presentation', 'radio', 'radiogroup', 'region', 'status', 'textbox']);
    const VALUES = { 'aria-invalid': ['true', 'false'], 'aria-live': ['off', 'polite', 'assertive'], 'aria-disabled': ['true', 'false'], tabindex: ['-1', '0'] };
    const problems = [];
    const check = (root, label) => {
      const ids = new Map();
      for (const node of root.querySelectorAll('[id]')) ids.set(node.id, (ids.get(node.id) || 0) + 1);
      for (const [id, count] of ids) if (count > 1) problems.push(label + ': the id ' + id + ' shows ' + count + ' times');
      for (const node of root.querySelectorAll('[aria-describedby], [aria-labelledby], label[for]')) {
        const refs = [node.getAttribute('aria-describedby'), node.getAttribute('aria-labelledby'), node.getAttribute('for')]
          .filter(Boolean).join(' ').split(/\\s+/).filter(Boolean);
        for (const ref of refs) if (!ids.has(ref)) problems.push(label + ': ' + node.tagName.toLowerCase() + ' refers to the missing id ' + ref);
      }
      for (const node of root.querySelectorAll('[role]')) {
        if (!ROLES.has(node.getAttribute('role'))) problems.push(label + ': the role ' + node.getAttribute('role') + ' is not known');
      }
      for (const [name, values] of Object.entries(VALUES)) {
        for (const node of root.querySelectorAll('[' + name + ']')) {
          if (!values.includes(node.getAttribute(name))) problems.push(label + ': ' + name + '="' + node.getAttribute(name) + '"');
        }
      }
      for (const node of root.querySelectorAll('*')) if (node.shadowRoot) check(node.shadowRoot, node.tagName.toLowerCase());
    };
    check(document, 'document');
    return problems;
  })()`);
  return [{ page: where, step: 'each control has a name', ok: unnamed.length === 0, detail: unnamed.join(' ') },
    { page: where, step: 'each id is unique, each id reference finds its target, and each role and ARIA value is valid',
      ok: markup.length === 0, detail: markup.slice(0, 10).join('; ') }];
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
  const page = 'examples/thread/thread.html';
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

// The offline source example (docs/contracts/data-source.md). Each button changes the network or the source. The
// status shows each state as text, and the page shows records only for ready or stale. A failed source shows no records.
async function offlineExample(session, sessionId, base) {
  const page = 'examples/cards/offline.html';
  const steps = [];
  await open(session, sessionId, `${base}/${page}`);
  const read = () => evaluate(session, sessionId, `(() => {
    const status = document.querySelector('mu-source-status');
    const box = status?.shadowRoot?.querySelector('[role="status"]');
    return box ? { state: box.querySelector('[part="state"]').textContent, reason: box.querySelector('[part="reason"]')?.textContent || '',
      checked: box.querySelector('[part="checked"]')?.textContent || '',
      cards: document.querySelector('mu-card-grid')?.shadowRoot.querySelectorAll('mu-card').length ?? 0 } : null;
  })()`);
  const wait = async (expected) => {
    let value = await read();
    for (let i = 0; i < 100 && value?.state !== expected; i += 1) {
      await sleep(20);
      value = await read();
    }
    return value;
  };
  const flow = [
    [null, 'Ready', 3, '', 'Checked: '],
    ['network', 'Stale', 3, 'The device is offline.', 'Last checked: '],
    ['damage', 'Error', 0, 'The source failed.', ''],
    ['damage', 'Stale', 3, 'The device is offline.', 'Last checked: '],
    ['network', 'Ready', 3, '', 'Checked: '],
    ['records', 'Empty', 0, '', 'Checked: '],
    ['network', 'Empty', 0, '', 'Checked: '],
    ['damage', 'Error', 0, 'The source failed.', ''],
    ['network', 'Error', 0, 'The source failed.', ''],
    ['damage', 'Empty', 0, '', 'Checked: '],
  ];
  let online = true;
  for (const [id, state, cards, reason, checked] of flow) {
    if (id === 'network') online = !online;
    if (id) await evaluate(session, sessionId, `document.getElementById('${id}').click(), true`);
    await sleep(50);
    const value = await wait(state);
    steps.push({ page, step: `${id ? `after ${id}, ` : ''}${online ? 'online' : 'offline'}: ${state} with ${cards} records`,
      ok: value?.state === state && value.cards === cards && value.reason === reason && value.checked.startsWith(checked) && (checked || !value.checked),
      detail: JSON.stringify(value) });
  }
  return steps;
}

// The membership example: a person edits one value in the form card of the thread and sends it. The card shows
// Pending, then Done only after the receipt, and it shows the new computed value of a read-only field.
async function membershipFlow(session, sessionId, base) {
  const page = 'examples/forms/membership.html';
  const steps = [];
  const step = (name, ok, detail) => steps.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  await open(session, sessionId, `${base}/${page}`);
  const card = `document.querySelector('mu-thread')?.shadowRoot?.querySelector('mu-form-card')`;
  const row = (name) => `[...${card}.shadowRoot.querySelectorAll('[part="line"]')].find((item) => item.dataset.name === '${name}')`;
  const read = () => evaluate(session, sessionId, `(() => {
    const node = ${card};
    if (!node) return null;
    return { state: node.dataset.state, status: node.shadowRoot.querySelector('[part="status"]').textContent,
      children: ${row('children')}.querySelector('[part="value"]').textContent,
      changed: Boolean(${row('children')}.querySelector('[part="changed"]')),
      size: ${row('household_size')}.querySelector('[part="value"]').textContent };
  })()`);
  let value = await read();
  for (let i = 0; i < 100 && !value; i += 1) {
    await sleep(50);
    value = await read();
  }
  step('the form card shows in the thread', value?.state === 'default', value);
  if (value?.state !== 'default') return steps;
  const edited = await evaluate(session, sessionId, `(() => {
    ${row('children')}.querySelector('[part="value"]').click();
    const editor = ${row('children')}.querySelector('[part="editor"]');
    const input = editor.querySelector('[data-state]').shadowRoot.querySelector('input');
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    editor.querySelector('[part="save"]').click();
    ${card}.shadowRoot.querySelector('form').requestSubmit();
    return true;
  })()`);
  value = await read();
  step('a sent change shows Pending before the receipt', edited && value.state === 'pending' && value.children === '2' && value.changed, value);
  for (let i = 0; i < 60 && value.state === 'pending'; i += 1) {
    await sleep(50);
    value = await read();
  }
  step('the receipt shows Done and the new computed value', value.state === 'done' && value.status.includes('Done')
    && value.children === '2' && !value.changed && value.size === '4', value);
  return steps;
}

// The upload example against its fixture API, tools/upload_server.py. The API keeps the files in memory only.
async function uploadExample(session, sessionId, report) {
  const page = 'examples/forms/upload.html';
  const { server, url } = await pythonServer('upload_server.py', ['--port', '0']);
  try {
    const files = ['receipt-a.pdf', 'receipt-b.pdf', 'receipt-a.txt', 'note.pdf'].map(uploadFile);
    const steps = await uploadExampleChecks(session, sessionId, url.slice(0, url.indexOf('/examples/')), { evaluate, open, sleep }, files);
    report.accessibility.push(...await axErrors(session, sessionId, [['heading', 'Ticket T-2041'], ['group', 'Attach receipts to ticket T-2041'],
      ['button', 'Choose files'], ['list', 'Files'], ['button', 'Remove note.pdf'], ['button', 'Upload']], page));
    return [...steps, ...await pageRules(session, sessionId, page)];
  } finally {
    server.kill();
  }
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
        if (page === 'tests/browser/image.html' && checks) report.keyboard.push(...await imageKeyboardChecks(session, sessionId, { evaluate, key, axErrors }, page));
        if (page === 'tests/browser/card.html' && checks) report.keyboard.push(...await cardKeyboardChecks(session, sessionId, { evaluate, key }, page));
        if (page === 'tests/browser/read-more.html' && checks) report.keyboard.push(...await readMoreKeyboardChecks(session, sessionId, { evaluate, key }, page));
        if (mode !== 'light' || !checks) continue;
        report.accessibility.push(...await axErrors(session, sessionId, expected, page));
        report.examples.push(...await pageRules(session, sessionId, page));
        // Keyboard: Tab moves the focus to the first button. Enter and Space press it.
        await evaluate(session, sessionId, 'document.activeElement && document.activeElement.blur(), true');
        await key(session, sessionId, 'Tab', 'Tab', 9);
        const focused = await evaluate(session, sessionId, 'document.activeElement?.shadowRoot?.activeElement?.textContent || ""');
        report.keyboard.push({ page, step: 'Tab focuses the first button', ok: focused === 'Keyboard target', detail: focused });
        await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
        await key(session, sessionId, ' ', 'Space', 32, ' ');
        const presses = await evaluate(session, sessionId, 'window.muPresses()');
        report.keyboard.push({ page, step: 'Enter and Space press the button', ok: presses === 2, detail: presses });
        if (page === 'tests/browser/rich-text.html') report.keyboard.push(...await richTextKeyboardChecks(session, sessionId, { evaluate, key }, page));
        if (page === 'tests/browser/data-grid.html') report.keyboard.push(...await dataGridKeyboardChecks(session, sessionId, { evaluate, key }, page));
        if (page === 'tests/browser/upload.html') {
          report.keyboard.push(...await uploadKeyboardChecks(session, sessionId, { evaluate, key }, page, uploadFile('receipt-a.txt')));
        }
        if (await evaluate(session, sessionId, 'typeof window.muChartKeys === "function"')) {
          for (const [name, code, expectedPoint] of [['Tab', 9, 0], ['ArrowRight', 39, 1], ['ArrowDown', 40, 2],
            ['ArrowLeft', 37, 1], ['ArrowUp', 38, 0], ['ArrowUp', 38, 5]]) {
            await key(session, sessionId, name, name, code);
            const found = await evaluate(session, sessionId, 'window.muChartKeys()');
            report.keyboard.push({ page, step: `${name} moves to chart point ${expectedPoint}`, ok: found.point === expectedPoint, detail: JSON.stringify(found) });
          }
          await key(session, sessionId, 'Tab', 'Tab', 9);
          for (const [name, code, text, expectedTable] of [['Enter', 13, '\r', true], [' ', 32, ' ', false]]) {
            await key(session, sessionId, name, name === ' ' ? 'Space' : name, code, text);
            const found = await evaluate(session, sessionId, 'window.muChartKeys()');
            report.keyboard.push({ page, step: `${name} toggles the chart table`, ok: found.table === expectedTable, detail: JSON.stringify(found) });
          }
        }
        if (await evaluate(session, sessionId, 'typeof window.muFocusTable === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusTable()');
          for (const [value, code, number, text, sort, first] of [
            ['Enter', 'Enter', 13, '\r', 'ascending', 'Plot A'], [' ', 'Space', 32, ' ', 'descending', 'Plot B']]) {
            await key(session, sessionId, value, code, number, text);
            const found = await evaluate(session, sessionId, 'window.muTableSort()');
            report.keyboard.push({ page, step: `${code} sorts the table and keeps focus`,
              ok: found.sort === sort && found.first === first && found.focused === 'Name', detail: JSON.stringify(found) });
          }
        }
        // The open button of a citation: Enter and Space press it. Each press sends one mu-open event.
        if (await evaluate(session, sessionId, 'typeof window.muFocusCitation === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusCitation()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          const opens = await evaluate(session, sessionId, 'window.muCitationOpens()');
          report.keyboard.push({ page, step: 'Enter and Space press the open button of a citation', ok: opens === 2, detail: opens });
        }
        // A part of a diff: Enter on its summary closes the open part, and Space opens it again.
        if (await evaluate(session, sessionId, 'typeof window.muFocusDiff === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusDiff()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          const closed = await evaluate(session, sessionId, 'window.muDiffOpen()');
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          const reopened = await evaluate(session, sessionId, 'window.muDiffOpen()');
          report.keyboard.push({ page, step: 'Enter closes and Space opens a part of a diff', ok: closed === false && reopened === true,
            detail: `${closed} ${reopened}` });
        }
        if (await evaluate(session, sessionId, 'typeof window.muFocusField === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusField()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          const submits = await evaluate(session, sessionId, 'window.muFormSubmits()');
          report.keyboard.push({ page, step: 'Enter in a field submits the form', ok: submits === 1, detail: submits });
        }
        // A typed edit: after a change, Tab goes to the edit type group. Space selects the first type, and an arrow key the next.
        if (await evaluate(session, sessionId, 'typeof window.muFocusTyped === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusTyped()');
          await key(session, sessionId, 'Tab', 'Tab', 9);
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          const first = await evaluate(session, sessionId, 'window.muTyped()');
          await key(session, sessionId, 'ArrowDown', 'ArrowDown', 40);
          const next = await evaluate(session, sessionId, 'window.muTyped()');
          report.keyboard.push({ page, step: 'Tab, Space and ArrowDown select the edit type', ok: first === 'judgment' && next === 'correction',
            detail: `${first} ${next}` });
          report.accessibility.push(...await axErrors(session, sessionId, [['group', 'Edit type'], ['radio', 'Judgment'],
            ['radio', 'Correction'], ['radio', 'Override']], page + ' edit type'));
        }
        // Long text: Enter adds a line and does not submit. A choice: an arrow key selects the next choice.
        if (await evaluate(session, sessionId, 'typeof window.muFocusLongText === "function"')) {
          await evaluate(session, sessionId, 'window.muFocusLongText()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          const text = await evaluate(session, sessionId, 'window.muInputs()');
          report.keyboard.push({ page, step: 'Enter in long text adds a line and does not submit the form',
            ok: text.submits === 0 && text.note === 'Keep dry.\n', detail: JSON.stringify(text) });
          await evaluate(session, sessionId, 'window.muFocusChoice()');
          await key(session, sessionId, 'ArrowDown', 'ArrowDown', 40);
          const choice = await evaluate(session, sessionId, 'window.muInputs()');
          report.keyboard.push({ page, step: 'ArrowDown selects the next choice', ok: choice.branch === 'South' && choice.submits === 0,
            detail: JSON.stringify(choice) });
          report.accessibility.push(...await axErrors(session, sessionId, [['form', 'Input form'], ['textbox', 'Note'],
            ['textbox', 'Copies'], ['textbox', 'Due date'], ['group', 'Branch'], ['radio', 'North'], ['radio', 'South'],
            ['radio', 'Harbor']], page + ' input types'));
        }
        // A form card: Enter opens the editor of a value, Escape cancels, Enter in the field saves, and Space on Save saves.
        // The focus goes back to the value after each step.
        if (await evaluate(session, sessionId, 'typeof window.muFocusCardValue === "function"')) {
          const card = () => evaluate(session, sessionId, 'window.muCard()');
          const push = (step, ok, detail) => report.keyboard.push({ page, step, ok, detail: JSON.stringify(detail) });
          await evaluate(session, sessionId, 'window.muFocusCardValue()');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          let state = await card();
          push('Enter on a value of a form card opens its editor', state.editing && state.inner === 'input', state);
          report.accessibility.push(...await axErrors(session, sessionId, [['form', 'Keyboard card'], ['group', 'Household'],
            ['group', 'Edit Children'], ['textbox', 'Children'], ['button', 'Save'], ['button', 'Cancel'], ['button', 'Edit Adults: 2']],
          page + ' form card editor'));
          await key(session, sessionId, 'Escape', 'Escape', 27);
          state = await card();
          push('Escape cancels the editor and the focus goes back to the value', !state.editing && state.focus === 'Edit Children: 1', state);
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          await evaluate(session, sessionId, 'window.muCardType("4")');
          await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
          state = await card();
          push('Enter in the field saves and the focus goes back to the value', !state.editing && state.value === '4'
            && state.focus === 'Edit Children: 4, changed', state);
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          await key(session, sessionId, 'Tab', 'Tab', 9);
          await key(session, sessionId, ' ', 'Space', 32, ' ');
          state = await card();
          push('Space opens the editor, and Tab and Space on Save save', !state.editing && state.value === '4'
            && state.focus === 'Edit Children: 4, changed', state);
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
      report.examples.push(...await pageRules(session, sessionId, page));
    }
    // The fixture of decision 0006 has one defect of each kind. The generic rules must find each one.
    await open(session, sessionId, `${base}/tests/browser/rules.html`);
    for (let i = 0; i < 100 && !await evaluate(session, sessionId, 'window.muRulesReady === true'); i += 1) await sleep(50);
    const [names, markup] = await pageRules(session, sessionId, 'tests/browser/rules.html');
    const found = markup.detail.split('; ');
    const wanted = ['document: the id twice shows 2 times', 'document: input refers to the missing id nowhere',
      'document: the role bogus is not known', 'document: aria-live="loud"', 'document: tabindex="3"', 'div: label refers to the missing id missing'];
    report.examples.push({ page: 'tests/browser/rules.html', step: 'the generic rules find each defect of the fixture',
      ok: !names.ok && names.detail === 'button' && !markup.ok && found.length === wanted.length && wanted.every((item) => found.includes(item)),
      detail: `${names.detail} | ${markup.detail}` });
    // The guide pages of docs/guides/. tests/browser/guides.mjs gives the expected results.
    const guides = await guideChecks(session, sessionId, base, { evaluate, open, sleep });
    report.examples.push(...guides.steps);
    report.accessibility.push(...guides.accessibility);
    // The index of the examples and the frame of each example page. tests/browser/examples-index.mjs gives the expected results.
    report.examples.push(...await exampleIndexChecks(session, sessionId, base, { evaluate, open, sleep, pythonServer }));
    report.examples.push(...await threadExample(session, sessionId, report));
    report.examples.push(...await offlineExample(session, sessionId, base));
    report.examples.push(...await membershipFlow(session, sessionId, base));
    report.examples.push(...await budgetExampleChecks(session, sessionId, base, { evaluate, open, sleep, key }));
    report.examples.push(...await reviewQueueChecks(session, sessionId, base, { evaluate, open, sleep }));
    report.examples.push(...await snapshotChecks(session, sessionId, base, { evaluate, open, sleep }));
    report.examples.push(...await uploadExample(session, sessionId, report));
    report.examples.push(...await appPages(session, sessionId, report));
    report.examples.push(...await coverSteps(session, sessionId));
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
    if (uploadFolder) rmSync(uploadFolder, { recursive: true, force: true });
  }
  report.passed = report.errors.length === 0;
  // Exit only after the report is written. A pipe can take less than the full report at one time.
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

// Run the check only when Node runs this file. tools/screenshots.mjs imports the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
