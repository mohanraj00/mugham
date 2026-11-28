#!/usr/bin/env node
// The browser check of the README quickstart, from issue #111. It starts the file server that the
// quickstart names, tools/serve.py, and opens each page of examples/ in headless Chrome.
// Expected results: the README names the command. The server prints the URL of the index page. On each
// page, each request for a file of src/, catalog/ or examples/ gets its file. A dropped connection, a
// status other than 200 or a request with no end fails the check. A request to a fixture API is not a file request.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, newPage, open, pythonServer, sleep, startChrome } from '../../tools/browser_check.mjs';

const COMMAND = 'python3 tools/serve.py';
const SERVED = ['/src/', '/catalog/', '/examples/'];
// A page is complete when no request is open and no network event came for this time.
const QUIET = 300;
const LIMIT = 15000;

// Each HTML page below a folder, as a path from the repository root.
function pages(folder) {
  return readdirSync(join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? pages(path) : entry.name.endsWith('.html') ? [path] : [];
  }).sort();
}

// Opens a page and gives each request of the page, with its status or its error.
async function load(session, sessionId, url) {
  const requests = new Map();
  let last = Date.now();
  const listener = (message) => {
    if (message.sessionId !== sessionId || !message.method.startsWith('Network.')) return;
    last = Date.now();
    const { requestId } = message.params;
    if (message.method === 'Network.requestWillBeSent') requests.set(requestId, { url: message.params.request.url, open: true });
    const request = requests.get(requestId);
    if (!request) return;
    if (message.method === 'Network.responseReceived') request.status = message.params.response.status;
    if (message.method === 'Network.loadingFinished') request.open = false;
    if (message.method === 'Network.loadingFailed') Object.assign(request, { open: false, error: message.params.errorText });
  };
  session.listeners.push(listener);
  try {
    await open(session, sessionId, url);
    const start = Date.now();
    while (Date.now() - start < LIMIT) {
      if (Date.now() - last > QUIET && ![...requests.values()].some((request) => request.open)) break;
      await sleep(50);
    }
  } finally {
    session.listeners = session.listeners.filter((item) => item !== listener);
  }
  return [...requests.values()];
}

async function main() {
  const steps = [];
  const step = (page, name, ok, detail) => steps.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  let chrome;
  let api;
  try {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    step('README.md', 'the quickstart names the server command', readme.includes('```sh\n' + COMMAND + '\n```') && !readme.includes('http.server'), COMMAND);

    api = await pythonServer('serve.py', ['--port', '0']);
    const origin = new URL(api.url).origin;
    const file = (url) => url.startsWith(origin + '/') && SERVED.some((folder) => new URL(url).pathname.startsWith(folder));
    const list = pages('examples');
    step('tools/serve.py', 'the server prints the URL of the index page', new URL(api.url).pathname === '/examples/' && list.includes('examples/index.html'), api.url);

    const started = await startChrome(profile);
    chrome = started.chrome;
    const { session } = started;
    const { sessionId } = await newPage(session);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await session.send(method, {}, sessionId);
    // Each page asks for each file again, as on a first visit.
    await session.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    let total = 0;
    for (const page of list) {
      const files = (await load(session, sessionId, `${origin}/${page}`)).filter((request) => file(request.url));
      // A request that is open after the time limit did not get its file.
      const failed = files.filter((request) => request.open || request.error || request.status !== 200)
        .map((request) => `${new URL(request.url).pathname}: ${request.open ? 'no end' : request.error || request.status || 'no answer'}`);
      total += files.length;
      step(page, 'each file request gets its file', files.length > 0 && failed.length === 0, { requests: files.length, failed });
    }
    step('examples/', 'the pages ask for files', list.length > 0 && total > list.length, { pages: list.length, requests: total });
  } catch (error) {
    step('quickstart', 'the check runs', false, String(error.message || error));
  } finally {
    if (chrome) chrome.kill();
    if (api) api.server.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  const report = { passed: steps.every((item) => item.ok), check: 'the README quickstart server', steps };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

main();
