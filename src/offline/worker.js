// The service worker part of the offline mode. docs/contracts/offline-queue.md is the contract.
// The application owns the worker file, its scope and its registration. This file has no import and no export,
// so a classic worker loads it with importScripts. Then the worker calls mughamOffline.serve(self, options).
// The worker keeps only the files that the application lists. It keeps no API response and no action, and it
// sends no action. The queue of the page sends each action (src/offline/queue.js).
(() => {
  const PREFIX = 'mugham-shell-';
  const VERSION = /^[A-Za-z0-9._-]{1,64}$/;
  const MAX_FILES = 500;

  // The URL of each listed file, as text with no fragment. A file of a different origin or with a user name is refused.
  function listed(scope, files) {
    if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) throw new TypeError('files: a list of 1 to 500 URLs');
    const origin = new URL(scope.location.href).origin;
    return new Set(files.map((file) => {
      if (typeof file !== 'string' || file.length === 0) throw new TypeError('files: each URL is a text');
      const url = new URL(file, scope.location.href);
      if (url.origin !== origin || url.username || url.password) throw new TypeError('files: not a URL of this origin: ' + file);
      url.hash = '';
      return url.href;
    }));
  }

  function serve(scope, { version, files } = {}) {
    if (typeof version !== 'string' || !VERSION.test(version)) throw new TypeError('version: 1 to 64 characters of letters, digits, ., - and _');
    const urls = listed(scope, files);
    const name = PREFIX + version;

    // If one file fails, the install fails, and the older worker stays.
    scope.addEventListener('install', (event) => {
      event.waitUntil((async () => {
        const cache = await scope.caches.open(name);
        await cache.addAll([...urls].map((url) => new Request(url, { cache: 'reload' })));
      })());
    });

    scope.addEventListener('activate', (event) => {
      event.waitUntil((async () => {
        for (const key of await scope.caches.keys()) {
          if (key.startsWith(PREFIX) && key !== name) await scope.caches.delete(key);
        }
        await scope.clients.claim();
      })());
    });

    // Only a GET request of a listed file gets an answer from the worker: the network first, then the cache.
    // Each other request goes to the network as usual.
    scope.addEventListener('fetch', (event) => {
      const { request } = event;
      if (request.method !== 'GET') return;
      const url = new URL(request.url);
      url.hash = '';
      if (!urls.has(url.href)) return;
      event.respondWith((async () => {
        try {
          return await scope.fetch(request);
        } catch (error) {
          const cache = await scope.caches.open(name);
          const kept = await cache.match(url.href);
          if (kept) return kept;
          throw error;
        }
      })());
    });
  }

  globalThis.mughamOffline = Object.freeze({ serve });
})();
