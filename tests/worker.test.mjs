// Tests of the service worker part of the offline mode. Each expected result comes from "The service worker" in
// docs/contracts/offline-queue.md: the worker keeps only the listed files, and it answers no other request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/offline/worker.js';

const ORIGIN = 'https://app.example';

// A model of a worker scope: the events, the caches and the network of the test.
function scope({ caches = new Map(), network = async () => new Response('new') } = {}) {
  const listeners = {};
  const fetched = [];
  const open = async (name) => {
    if (!caches.has(name)) caches.set(name, new Map());
    const cache = caches.get(name);
    return {
      addAll: async (requests) => {
        const entries = [];
        for (const request of requests) {
          fetched.push(request.url);
          const response = await network(request);
          if (!response.ok) throw new TypeError('The file gave the status ' + response.status);
          entries.push([request.url, response]);
        }
        for (const [url, response] of entries) cache.set(url, response);
      },
      match: async (url) => cache.get(url)?.clone(),
    };
  };
  const self = {
    location: { href: ORIGIN + '/app/worker.js' }, claimed: 0, fetched,
    addEventListener: (type, listener) => { listeners[type] = listener; },
    caches: { open, keys: async () => [...caches.keys()], delete: async (name) => caches.delete(name) },
    clients: { claim: async () => { self.claimed += 1; } },
    fetch: (request) => network(request),
  };
  // Sends one event and returns the value that the worker gave to waitUntil or respondWith.
  self.send = async (type, init = {}) => {
    let answer;
    listeners[type]({ ...init, waitUntil: (promise) => { answer = promise; }, respondWith: (promise) => { answer = promise; } });
    return answer === undefined ? undefined : await answer;
  };
  return self;
}

const FILES = ['./', 'app.js', '/kit/src/kit.js?v=1'];
const get = (path, init) => new Request(ORIGIN + path, init);

// The name of the cache of one scope and one version.
const cacheOf = (version, place = ORIGIN + '/app/') => `mugham-shell ${place} ${version}`;

test('the install keeps each listed file, and the activate removes each older cache of its scope', async () => {
  const caches = new Map([[cacheOf('v1'), new Map()], ['other-cache', new Map()]]);
  const self = scope({ caches });
  globalThis.mughamOffline.serve(self, { version: 'v2', files: FILES });
  await self.send('install');
  assert.deepEqual(self.fetched, [ORIGIN + '/app/', ORIGIN + '/app/app.js', ORIGIN + '/kit/src/kit.js?v=1']);
  assert.deepEqual([...caches.get(cacheOf('v2')).keys()], self.fetched);
  await self.send('activate');
  assert.deepEqual([...caches.keys()], ['other-cache', cacheOf('v2')]);
  assert.equal(self.claimed, 1);
});

test('the activate keeps the cache of each other scope of the same origin', async () => {
  // Expected: a worker removes only the older caches of its own registration scope. A scope whose URL starts
  // with the URL of this scope is a different scope.
  const other = [cacheOf('v1', ORIGIN + '/second/'), cacheOf('v1', ORIGIN + '/app/admin/'), cacheOf('v1', ORIGIN + '/')];
  const caches = new Map([[cacheOf('v1'), new Map()], ...other.map((name) => [name, new Map()])]);
  const self = scope({ caches });
  globalThis.mughamOffline.serve(self, { version: 'v2', files: FILES });
  await self.send('install');
  await self.send('activate');
  assert.deepEqual([...caches.keys()], [...other, cacheOf('v2')]);
});

test('the cache name uses the scope of the registration, not the folder of the worker file', async () => {
  const caches = new Map([[cacheOf('v1', ORIGIN + '/'), new Map()], [cacheOf('v1'), new Map()]]);
  const self = scope({ caches });
  self.registration = { scope: ORIGIN + '/' };
  globalThis.mughamOffline.serve(self, { version: 'v2', files: FILES });
  await self.send('install');
  await self.send('activate');
  assert.deepEqual([...caches.keys()], [cacheOf('v1'), cacheOf('v2', ORIGIN + '/')]);
});

test('if one file fails, the install fails and keeps nothing', async () => {
  const caches = new Map();
  const self = scope({ caches, network: async (request) => new Response('', { status: request.url.endsWith('app.js') ? 404 : 200 }) });
  globalThis.mughamOffline.serve(self, { version: 'v1', files: FILES });
  await assert.rejects(self.send('install'), /404/);
  assert.equal(caches.get(cacheOf('v1')).size, 0);
});

test('a listed file comes from the network first, and from the cache when the network fails', async () => {
  let online = true;
  const self = scope({ network: async () => {
    if (!online) throw new TypeError('Failed to fetch');
    return new Response(online === true ? 'new' : '');
  } });
  globalThis.mughamOffline.serve(self, { version: 'v1', files: FILES });
  await self.send('install');
  assert.equal(await (await self.send('fetch', { request: get('/app/app.js') })).text(), 'new');
  online = false;
  assert.equal(await (await self.send('fetch', { request: get('/app/app.js#part') })).text(), 'new');
  assert.equal(await (await self.send('fetch', { request: get('/app/') })).text(), 'new');
});

test('the worker gives no answer for a request that is not a GET of a listed file', async () => {
  const self = scope();
  globalThis.mughamOffline.serve(self, { version: 'v1', files: FILES });
  await self.send('install');
  const before = self.fetched.length;
  for (const request of [get('/app/app.js', { method: 'POST', body: '{}' }), get('/api/actions', { method: 'POST', body: '{}' }),
    get('/api/tools'), get('/app/other.js'), get('/kit/src/kit.js'), new Request('https://other.example/app/app.js')]) {
    assert.equal(await self.send('fetch', { request }), undefined);
  }
  assert.equal(self.fetched.length, before);
});

test('a listed file that the cache does not have fails when the network fails', async () => {
  const self = scope({ network: async () => { throw new TypeError('Failed to fetch'); } });
  globalThis.mughamOffline.serve(self, { version: 'v1', files: FILES });
  await assert.rejects(self.send('fetch', { request: get('/app/app.js') }), /Failed to fetch/);
});

test('the worker refuses options that are not valid', () => {
  const serve = (options) => globalThis.mughamOffline.serve(scope(), options);
  assert.throws(() => serve({ version: 'v 1', files: FILES }), /version/);
  assert.throws(() => serve({ version: 'v1', files: [] }), /files/);
  assert.throws(() => serve({ version: 'v1', files: ['https://other.example/app.js'] }), /origin/);
  assert.throws(() => serve({ version: 'v1', files: ['https://user:word@app.example/app.js'] }), /origin/);
  assert.throws(() => serve({ version: 'v1', files: [7] }), /text/);
});
