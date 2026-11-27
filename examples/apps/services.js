import { define } from '../../src/components/index.js';
import { fill, mount, onAction, serviceHandler } from '../../src/kit.js';

define();

document.querySelector('mu-app-shell').fill = fill('app-shell', {
  nav_label: 'Services', menu_label: 'Menu', close_label: 'Close menu', skip_label: 'Skip to main content',
});
document.getElementById('regions').fill = fill('stack', { label: 'Service regions', direction: 'row', gap: 'large' });

// Three fixture APIs with synthetic data. Each API has its own origin, its own data and its own decisions.
// A real page sends each request to the API of the service, with fetch and the credentials of the application.
const FIXTURES = {
  'https://catalog.example.test/api/': {
    trays: () => [200, { items: ['Tray T-11: bean seeds', 'Tray T-12: pea seeds'] }],
    tools: () => [200, { items: ['Hand trowel H-3', 'Seed tray rack R-1'] }],
    'trays.reserve': () => [200, { ok: true, message: 'Tray T-12 is reserved.' }],
  },
  'https://loans.example.test/v2/': {
    loans: () => [200, { items: ['Loan L-7: A guide to rain gardens, due 2026-12-04'] }],
    // The loans service refuses the renewal. The page shows the decision of the service.
    'loans.renew': () => [409, { ok: false, code: 'renewal-limit', message: 'The loan has two renewals' }],
  },
  'https://notices.example.test/': {
    notices: () => [200, { items: ['Pickup notice N-4 for Tray T-11'] }],
    'notices.send': () => [200, { ok: true, message: 'The reminder is sent.' }],
  },
};

// Each request that the page sends, in order. The browser check reads this list.
const requests = [];
window.serviceRequests = requests;

// The fixture transport. It answers only a URL below the base URL of a fixture API.
async function send(url, request) {
  requests.push(url);
  await new Promise((done) => setTimeout(done, 300));
  const base = Object.keys(FIXTURES).find((root) => url.startsWith(root));
  const route = base && FIXTURES[base][url.slice(base.length)];
  const [status, body] = route ? route(request) : [404, { ok: false, code: 'not-found' }];
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Each region has one service: a short name, a base URL, the views that it reads and one action.
const REGIONS = [
  { id: 'catalog', service: 'Catalog service', base: 'https://catalog.example.test/api/',
    views: [['trays', '[slot="trays"]'], ['tools', '[slot="tools"]']],
    action: { tool: 'trays.reserve', label: 'Reserve tray T-12', arguments: { tray: 'T-12' } } },
  { id: 'loans', service: 'Loans service', base: 'https://loans.example.test/v2/',
    views: [['loans', '.items']],
    action: { tool: 'loans.renew', label: 'Renew loan L-7', arguments: { loan: 'L-7' } } },
  { id: 'notices', service: 'Notices service', base: 'https://notices.example.test/',
    views: [['notices', '.items']],
    action: { tool: 'notices.send', label: 'Send the pickup reminder', arguments: { notice: 'N-4' } } },
];

document.querySelector('mu-tabs').fill = fill('tabs', {
  label: 'Catalog views', tabs: [{ label: 'Seed trays', name: 'trays' }, { label: 'Tools', name: 'tools' }],
});

for (const { id, service, base, views, action } of REGIONS) {
  const region = document.getElementById(id);
  const button = mount('action-button', { label: action.label }, { parent: region });
  button.action = action;
  // One handler for each region. It sends each action of this region only to the base URL of its service.
  onAction(button, serviceHandler({ service, base, send }));
  for (const [path, selector] of views) {
    const list = region.querySelector(selector);
    send(new URL(path, base).href, { method: 'GET' }).then((response) => response.json()).then(({ items }) => {
      // The service data shows as text.
      list.replaceChildren(...items.map((item) => Object.assign(document.createElement('li'), { textContent: item })));
    });
  }
}
