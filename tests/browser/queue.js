// The offline queue example (examples/cards/queue.html) against its fixture API, tools/queue_server.py.
// Expected results, from issue #12 and docs/contracts/offline-queue.md:
// - An action made offline shows as pending with a cancel, never as done, and the API gets no request.
// - After an offline reload, the page loads from the service worker, and the queue view shows the waiting actions.
// - After the device reconnects, the queue sends each action one time, in order, and the API does each one.
// - A try with no receipt stays pending with a retry and a cancel. The retry has the same key, and the API does
//   the action one time.
// - A rejection of a queued action shows on that action.
// - A cancel removes a waiting action, and the API gets no request for it.
// The browser goes offline through the DevTools protocol, so navigator.onLine and the online event are real.
const NETWORK_ERROR = /net::ERR_(INTERNET_DISCONNECTED|EMPTY_RESPONSE|CONNECTION_[A-Z_]+|FAILED|ABORTED)/;

// Removes the planned network errors of this example from the page problems, and returns the other ones.
export function plannedErrors(problems, start) {
  const added = problems.splice(start);
  const other = added.filter((text) => !NETWORK_ERROR.test(text));
  problems.push(...other);
  return other;
}

const READ = `(async () => {
  const main = document.getElementById('main');
  // A page that did not load has no main part. Then each check of the page fails with this value.
  if (!main) return { ready: '', worker: '', controlled: false, online: navigator.onLine, heading: '', source: '', tools: {}, summary: '', rows: [], href: location.href };
  const box = document.querySelector('#main mu-source-status')?.shadowRoot?.querySelector('[role="status"]');
  const queue = document.querySelector('#main mu-action-queue')?.shadowRoot;
  const tools = Object.fromEntries([...document.querySelectorAll('#main mu-card')].map((card) => {
    const button = card.querySelector('mu-action-button');
    const root = button.shadowRoot;
    return [card.fill.data.title, { status: card.fill.data.facts[1].data.value, state: button.dataset.state, wait: button.dataset.wait ?? '',
      text: root.querySelector('[part="status"]').textContent, exits: [...root.querySelectorAll('[part="exit"] button')].map((item) => item.textContent) }];
  }));
  return { ready: main.dataset.state ?? '', worker: main.dataset.worker ?? '', controlled: Boolean(navigator.serviceWorker.controller),
    online: navigator.onLine, heading: document.querySelector('h1')?.textContent ?? '',
    source: box?.querySelector('[part="state"]')?.textContent ?? '', tools,
    summary: queue?.querySelector('[part="summary"]')?.textContent ?? '',
    rows: [...(queue?.querySelectorAll('[part="action"]') ?? [])].map((row) => [row.querySelector('[part="name"]').textContent,
      row.querySelector('[part="state"]').textContent, [...row.querySelectorAll('button')].map((item) => item.textContent).join(',')].join('|')) };
})()`;

// The files that the page loaded and that the cache of the service worker does not have.
const NOT_KEPT = `(async () => {
  const cache = await caches.open('mugham-shell ' + new URL('./', location.href).href + ' queue-example-8');
  const kept = new Set((await cache.keys()).map((request) => request.url));
  const loaded = [location.href, ...performance.getEntriesByType('resource').map((entry) => entry.name)]
    .filter((url) => url.startsWith(location.origin) && !new URL(url).pathname.startsWith('/api/') && new URL(url).pathname !== '/favicon.ico');
  return { kept: kept.size, missing: [...new Set(loaded)].filter((url) => !kept.has(url.split('#')[0])) };
})()`;

export async function queueExampleChecks(session, sessionId, base, { evaluate, open, sleep }) {
  const page = 'examples/cards/queue.html';
  const results = [];
  const check = (step, ok, detail) => results.push({ page, step, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const api = async (path, body) => (await fetch(`${base}/api${path}`, body === undefined ? undefined
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const offline = (value) => session.send('Network.emulateNetworkConditions',
    { offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
  const read = () => evaluate(session, sessionId, READ);
  const until = async (test) => {
    let found = await read();
    for (let i = 0; i < 100 && !test(found); i += 1) {
      await sleep(50);
      found = await read();
    }
    return found;
  };
  const press = (name, part = 'button') => evaluate(session, sessionId, `(() => {
    const card = [...document.querySelectorAll('#main mu-card')].find((item) => item.fill.data.title === ${JSON.stringify(name)});
    card.querySelector('mu-action-button').shadowRoot.querySelector('[part="${part}"]').click();
    return true;
  })()`);
  const tryOf = (log, toolId) => log.requests.filter((item) => item.tool_id === toolId);

  await session.send('Network.enable', {}, sessionId);
  await open(session, sessionId, `${base}/${page}`);
  let found = await until((value) => value.ready === 'ready' && value.worker === 'ready' && value.controlled && value.source === 'Ready');
  check('online: the page shows the tools of the API and an empty queue', found.ready === 'ready' && found.source === 'Ready'
    && Object.entries(found.tools).map(([name, tool]) => `${name}:${tool.status}:${tool.state}`).join(',')
      === 'Ladder:Free:default,Drill:Reserved:default,Garden fork:Free:default,Hand saw:Free:default'
    && found.summary === 'No pending actions.' && found.rows.length === 0, found);
  check('online: the service worker controls the page', found.worker === 'ready' && found.controlled, [found.worker, found.controlled]);
  const files = await evaluate(session, sessionId, NOT_KEPT);
  check('the file list of the worker has each file that the page loads', files.kept > 0 && files.missing.length === 0, files);

  // Offline: two actions wait in the queue as pending, and the API gets nothing.
  await offline(true);
  await press('Ladder');
  await press('Garden fork');
  found = await until((value) => value.rows.length === 2);
  const queuedTool = (tool) => tool.state === 'pending' && tool.wait === 'queued' && tool.text === 'Pending: Waiting for a connection.' && tool.exits.join(',') === 'Cancel';
  check('offline: each action shows as pending with a cancel, never as done', found.online === false && queuedTool(found.tools.Ladder)
    && queuedTool(found.tools['Garden fork']) && !JSON.stringify(found).includes('Done'), found);
  check('offline: the queue view lists the two actions in order as pending', found.summary === '2 pending.' && found.rows.join(';')
    === 'Reserve Ladder|Pending: Waiting for a connection.|Cancel;Reserve Garden fork|Pending: Waiting for a connection.|Cancel', found.rows);
  let log = await api('/log');
  check('offline: the API got no request', log.requests.length === 0 && log.applied.length === 0, log);

  // An offline reload, with no answer from the service: the page loads from the service worker, and the queue has the actions.
  await api('/control', { service: 'down' });
  await open(session, sessionId, `${base}/${page}`);
  found = await until((value) => value.ready === 'ready' && value.rows.length === 2);
  check('offline reload: the page loads from the service worker with the stale copy of the tools', found.online === false && found.controlled
    && found.heading === 'Tool library' && found.source === 'Stale' && found.tools.Ladder?.status === 'Free' && Object.keys(found.tools).length === 4, found);
  check('offline reload: the queue view shows the two waiting actions as pending, never as done', found.summary === '2 pending.' && found.rows.join(';')
    === 'Reserve Ladder|Pending: Waiting for a connection.|Cancel;Reserve Garden fork|Pending: Waiting for a connection.|Cancel'
    && !JSON.stringify(found).includes('Done'), found);

  // The device reconnects: the queue sends each action one time, in order, and the API does each one.
  await api('/control', { service: 'up' });
  await offline(false);
  found = await until((value) => value.rows.length === 0 && value.source === 'Ready' && value.tools['Garden fork']?.status === 'Reserved');
  log = await api('/log');
  check('reconnect: an action made offline goes through after the device reconnects', found.online === true && found.summary === 'No pending actions.'
    && found.tools.Ladder.status === 'Reserved' && found.tools['Garden fork'].status === 'Reserved' && found.source === 'Ready', found);
  check('reconnect: the API got each action one time, in order, with one key for each', log.requests.map((item) => item.tool_id).join(',') === 'T-01,T-03'
    && log.applied.length === 2 && log.applied.join(',') === log.requests.map((item) => item.key).join(',') && log.applied[0] !== log.applied[1], log);

  // A lost receipt: the API does the action, but no receipt comes back. The action stays pending with its exits.
  await api('/control', { lose_receipts: 1 });
  await press('Hand saw');
  found = await until((value) => value.tools['Hand saw'].wait === 'stalled');
  check('no receipt: the action stays pending with a retry and a cancel, never done', found.tools['Hand saw'].state === 'pending'
    && found.tools['Hand saw'].text === 'Pending: No receipt came back.' && found.tools['Hand saw'].exits.join(',') === 'Retry,Cancel'
    && found.rows.join(';') === 'Reserve Hand saw|Pending: No receipt came back.|Retry,Cancel' && !JSON.stringify(found).includes('Done'), found);
  await press('Hand saw', 'retry');
  found = await until((value) => value.tools['Hand saw'].state === 'done');
  log = await api('/log');
  const saw = tryOf(log, 'T-04');
  check('duplicate send: the retry has the same key and a new id, and the action shows done after its receipt', found.tools['Hand saw'].state === 'done'
    && found.tools['Hand saw'].text.startsWith('Done: The tool T-04 is reserved.') && found.rows.length === 0 && saw.length === 2
    && saw[0].key === saw[1].key && saw[0].id !== saw[1].id, [found.tools['Hand saw'], saw]);
  check('duplicate send: the API did the action one time', log.applied.length === 3 && log.applied.filter((key) => key === saw[0]?.key).length === 1, log.applied);

  // A rejection of a queued action shows on that action.
  await offline(true);
  await press('Drill');
  found = await until((value) => value.rows.length === 1);
  const waiting = found.tools.Drill;
  await offline(false);
  found = await until((value) => value.tools.Drill.state === 'error');
  log = await api('/log');
  check('rejection: the queued action shows the rejection of the API on its button', queuedTool(waiting) && found.tools.Drill.state === 'error'
    && found.tools.Drill.text === 'Not done: The tool T-02 is already reserved.' && found.rows.length === 0 && log.applied.length === 3, [waiting, found.tools.Drill]);

  // A cancel removes a waiting action. The API gets no request for it.
  const before = log.requests.length;
  await offline(true);
  await press('Ladder');
  found = await until((value) => value.rows.length === 1);
  await press('Ladder', 'cancel');
  found = await until((value) => value.rows.length === 0);
  await offline(false);
  await sleep(300);
  log = await api('/log');
  check('cancel: a canceled action goes back to its start state, and the API gets no request', found.tools.Ladder.state === 'default'
    && found.tools.Ladder.text === 'Canceled. The request did not leave this device.' && found.summary === 'No pending actions.'
    && log.requests.length === before, [found.tools.Ladder, log.requests.length, before]);
  found = await until((value) => value.source === 'Ready');
  return results;
}
