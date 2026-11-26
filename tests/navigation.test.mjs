import assert from 'node:assert/strict';
import { setImmediate as nextTask } from 'node:timers/promises';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the DOM updates and the dialog calls. The browser check sends real keys.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};
  isConnected = true;
  disabled = false;

  constructor(tag) { super(); this.tag = tag; }
  append(...children) {
    for (const child of children) this.insertBefore(child, null);
  }
  insertBefore(child, before) {
    if (child instanceof TestNode) {
      child.remove();
      child.parentNode = this;
    }
    this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child);
  }
  get nextElementSibling() {
    const siblings = this.parentNode?.children;
    return siblings?.[siblings.indexOf(this) + 1] ?? null;
  }
  getRootNode() {
    return this.parentNode?.getRootNode() ?? this;
  }
  remove() {
    if (!this.parentNode) return;
    const root = this.getRootNode();
    for (let node = root.activeElement; node; node = node.parentNode) {
      if (node === this) root.activeElement = null;
    }
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  prepend(child) {
    this.insertBefore(child, this.children[0] ?? null);
  }
  replaceChildren(...children) {
    for (const child of this.children) if (child instanceof TestNode) child.remove();
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(node) { return this === node || this.children.some((child) => child.contains?.(node)); }
  get firstElementChild() { return this.children.find((child) => child instanceof TestNode) ?? null; }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(value) { this.setAttribute('id', value); }
  get localName() { return this.tag; }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: value }); }
  matches(selector) { return selector === 'a[href]' && this.tag === 'a' && this.getAttribute('href') !== null; }
  focus() {
    document.activeElement = this;
    for (let node = this; node; node = node.getRootNode().host) node.getRootNode().activeElement = node;
  }
  click() {
    if (!this.disabled) this.dispatchEvent(new Event('click', { cancelable: true }));
  }
}

class TestDialog extends TestNode {
  open = false;
  #previousFocus;

  showModal() {
    this.open = true;
    this.#previousFocus = document.activeElement;
    find(this, 'close').focus();
  }

  close() {
    this.open = false;
    this.#previousFocus?.focus();
    setImmediate(() => this.dispatchEvent(new Event('close')));
  }
}

function find(root, part) {
  if (root.getAttribute?.('part') === part) return root;
  return root.children?.map((child) => find(child, part)).find(Boolean);
}

const elements = new Map();
const phone = Object.assign(new EventTarget(), { matches: false });
globalThis.matchMedia = (query) => {
  assert.equal(query, '(max-width: 30rem)');
  return phone;
};
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = Object.assign(new TestNode(), { host: this })); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.document = {
  createElement: (tag) => tag === 'dialog' ? new TestDialog(tag) : elements.has(tag) ? new (elements.get(tag))() : new TestNode(tag),
  createTextNode: (textContent) => ({ textContent }),
};
globalThis.customElements = {
  define: (name, constructor) => elements.set(name, constructor),
  get: (name) => elements.get(name),
};

const { define } = await import('../src/components/index.js');
define();

const SHELL = { nav_label: 'Library sections', menu_label: 'Menu', close_label: 'Close menu', skip_label: 'Skip to main content' };
const BREADCRUMBS = { label: 'Breadcrumbs', items: [
  { label: 'Library <staff>', href: '../library/' },
  { label: 'Desk', href: 'https://example.org/desk' },
  { label: 'Loans' },
] };
const PAGINATION = { label: 'Loan pages', page: 8, page_count: 16 };
const STEPS = { label: 'Member steps', labels: ['Details <member>', 'Membership type', 'Review'], current: 1 };
const PROGRESS = { label: 'Member progress', maximum: 3.5, value: 1.5 };

function make(name, data) {
  const element = new (elements.get('mu-' + name))();
  element.fill = fill(name, data);
  return element;
}

function events(element, type) {
  const log = [];
  element.addEventListener(type, (event) => {
    assert.ok(event.bubbles && event.composed);
    log.push(event.detail);
  });
  return log;
}

for (const [name, data] of [['app-shell', SHELL], ['breadcrumbs', BREADCRUMBS], ['pagination', PAGINATION]]) {
  test(name + ' exports a tool schema and refuses a fill with an undeclared field', () => {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    assert.deepEqual(schema.properties.data.required, Object.keys(data));
    assert.equal(schema.properties.data.additionalProperties, false);
    assert.deepEqual(validateFill(fill(name, data)), []);
    if (name === 'breadcrumbs') {
      const { items } = schema.properties.data.properties.items;
      assert.equal(items.additionalProperties, false);
      assert.deepEqual(items.required, ['label']);
      assert.equal(items.properties.href.type, 'string');
    }
    if (name === 'pagination') {
      for (const key of ['page', 'page_count']) {
        assert.equal(schema.properties.data.properties[key].type, 'integer');
        assert.equal(schema.properties.data.properties[key].minimum, 1);
      }
    }
    const element = make(name, data);
    const refused = events(element, 'mu-refused');
    element.fill = fill(name, { ...data, markup: '<b>Page</b>' });
    assert.equal(element.fill, null);
    assert.equal(element.dataset.state, 'refused');
    assert.match(refused[0].errors[0], /^data.markup:/);
  });
}

test('the shell keeps the same side slot in the drawer and returns focus after close', async () => {
  const shell = make('app-shell', SHELL);
  shell.connectedCallback();
  const root = shell.shadowRoot;
  const side = find(root, 'side');
  const main = find(root, 'main');
  const menu = find(root, 'menu');
  const top = find(root, 'top');
  const skip = find(root, 'skip');
  const drawer = root.children.find((node) => node.constructor.component === 'drawer');
  const [dialog] = drawer.shadowRoot.children;
  assert.equal(top.tag, 'header');
  assert.equal(top.children[0].getAttribute('name'), 'top');
  assert.equal(side.tag, 'nav');
  assert.equal(side.getAttribute('aria-label'), SHELL.nav_label);
  assert.equal(side.children[0].getAttribute('name'), 'side');
  assert.equal(main.tag, 'main');
  assert.equal(main.children[0].tag, 'slot');
  assert.equal(main.getAttribute('tabindex'), '-1');
  assert.equal(skip.getAttribute('href'), '#' + main.id);
  skip.click();
  assert.equal(document.activeElement, main);
  assert.equal(menu.getAttribute('aria-controls'), drawer.id);
  assert.notEqual(side.parentNode, drawer);

  phone.matches = true;
  phone.dispatchEvent(new Event('change'));
  assert.equal(side.parentNode, drawer);
  menu.click();
  assert.equal(dialog.open, true);
  assert.equal(menu.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, find(dialog, 'close'));
  const link = new TestNode('a');
  link.setAttribute('href', '#loans');
  const select = Object.assign(new Event('click', { cancelable: true }), { composedPath: () => [link, side] });
  side.dispatchEvent(select);
  assert.equal(select.defaultPrevented, false);
  await nextTask();
  assert.equal(dialog.open, false);
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, menu);

  menu.click();
  phone.matches = false;
  phone.dispatchEvent(new Event('change'));
  await nextTask();
  assert.equal(dialog.open, false);
  assert.notEqual(side.parentNode, drawer);
  shell.disconnectedCallback();
});

test('breadcrumbs render an ordered list, safe links, silent separators and a current page', () => {
  const crumbs = make('breadcrumbs', BREADCRUMBS);
  const [nav] = crumbs.shadowRoot.children;
  const [list] = nav.children;
  assert.equal(nav.tag, 'nav');
  assert.equal(nav.getAttribute('aria-label'), BREADCRUMBS.label);
  assert.equal(list.tag, 'ol');
  assert.deepEqual(list.children.map((item) => item.tag), ['li', 'li', 'li']);
  const links = list.children.slice(0, -1).map((item) => find(item, 'link'));
  assert.deepEqual(links.map((link) => link.getAttribute('href')), ['../library/', 'https://example.org/desk']);
  assert.equal(links[0].textContent, 'Library <staff>');
  for (const item of list.children.slice(1)) assert.equal(find(item, 'separator').getAttribute('aria-hidden'), 'true');
  const current = find(list, 'current');
  assert.equal(current.getAttribute('aria-current'), 'page');
  assert.equal(current.getAttribute('href'), null);
  assert.equal(current.textContent, 'Loans');
});

test('breadcrumbs refuse unsafe addresses and require a link before the current page', () => {
  const crumbs = make('breadcrumbs', BREADCRUMBS);
  const refused = events(crumbs, 'mu-refused');
  for (const href of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/plain,Test', 'http://example.org/',
    'mailto:staff@example.org', 'ftp://example.org/', '//example.org/path', '/\\example.org/path',
    ' https://example.org/', 'https://staff@example.org/', 'https://', '',
    'https://192.0.2.1/', 'https://[2001:db8::1]:443/', 'https://bücher.example/', 'https://a\u200db.example/',
    'https://desk.example:65536/', 'https://-desk.example/', '/loans\ufeff', '/loans\u2003']) {
    const value = fill('breadcrumbs', { ...BREADCRUMBS, items: [{ label: 'Desk', href }, { label: 'Loans' }] });
    assert.match(validateFill(value)[0], /^data.items\[0\].href:/, href);
    crumbs.fill = value;
    assert.equal(crumbs.fill, null, href);
  }
  for (const href of ['/loans', './loans', 'loans', '#loans', '?page=2', 'HTTPS://example.org/',
    'https://xn--bcher-kva.example/', 'HTTPS://desk.example:65535/loans']) {
    const value = fill('breadcrumbs', {
      ...BREADCRUMBS, items: [{ label: 'Desk', href }, { label: 'Loans' }],
    });
    assert.deepEqual(validateFill(value), [], href);
    crumbs.fill = value;
    assert.equal(find(crumbs.shadowRoot, 'link').getAttribute('href'), href);
  }
  const missing = fill('breadcrumbs', { ...BREADCRUMBS, items: [{ label: 'Desk' }, { label: 'Loans' }] });
  crumbs.fill = missing;
  assert.match(refused.at(-1).errors[0], /^data.items\[0\].href:/);
  crumbs.fill = fill('breadcrumbs', { ...BREADCRUMBS, items: [{ label: 'Loans', href: 'data:,Test' }] });
  assert.match(refused.at(-1).errors[0], /^data.items\[0\].href:/);
});

test('pagination renders a short range and requests a new page only on activation', () => {
  const pagination = make('pagination', PAGINATION);
  const requested = events(pagination, 'mu-page-change');
  const [nav] = pagination.shadowRoot.children;
  const [previous, ...rest] = nav.children;
  const next = rest.pop();
  assert.equal(nav.tag, 'nav');
  assert.equal(nav.getAttribute('aria-label'), PAGINATION.label);
  assert.deepEqual(rest.map((node) => node.textContent), ['1', '…', '7', '8', '9', '…', '16']);
  const current = rest[3];
  assert.equal(current.getAttribute('aria-current'), 'page');
  assert.equal(current.getAttribute('aria-label'), 'Page 8');
  assert.equal(rest[1].getAttribute('aria-hidden'), 'true');
  current.click();
  next.click();
  rest[0].click();
  previous.click();
  assert.deepEqual(requested, [{ page: 9 }, { page: 1 }, { page: 7 }]);
  assert.equal(pagination.fill.data.page, 8);

  for (const page of [1, 3]) {
    pagination.fill = fill('pagination', { ...PAGINATION, page, page_count: 3 });
    const [before, first, second, last, after] = pagination.shadowRoot.children[0].children;
    assert.deepEqual([first, second, last].map((node) => node.textContent), ['1', '2', '3']);
    assert.equal(before.disabled, page === 1);
    assert.equal(after.disabled, page === 3);
    (page === 1 ? before : after).click();
  }
  assert.equal(requested.length, 3);

  const maximum = Number.MAX_SAFE_INTEGER;
  pagination.fill = fill('pagination', { ...PAGINATION, page: maximum - 4, page_count: maximum });
  assert.equal(pagination.shadowRoot.children[0].children.length, 9);
});

test('pagination refuses a page outside the integer range', () => {
  const pagination = make('pagination', PAGINATION);
  const refused = events(pagination, 'mu-refused');
  for (const change of [{ page: 0 }, { page: 1.5 }, { page: 17 }, { page: '1' }, { page_count: 0 }, { page_count: 2 ** 53 }]) {
    const value = fill('pagination', { ...PAGINATION, ...change });
    assert.match(validateFill(value)[0], /^data.page/);
    pagination.fill = value;
    assert.equal(pagination.fill, null);
  }
  assert.equal(refused.length, 6);
});

test('steps show position and state and only a done step requests a change', () => {
  const steps = make('steps', STEPS);
  const requested = events(steps, 'mu-step-change');
  const [list] = steps.shadowRoot.children;
  const [done, current, next] = list.children;
  assert.equal(list.tag, 'ol');
  assert.equal(list.getAttribute('aria-label'), STEPS.label);
  assert.deepEqual(list.children.map((item) => item.tag), ['li', 'li', 'li']);
  assert.deepEqual(list.children.map((item) => find(item, 'position').textContent),
    ['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3']);
  assert.deepEqual(list.children.map((item) => find(item, 'state').textContent), ['Done', 'Current', 'Next']);
  assert.deepEqual(list.children.map((item) => item.getAttribute('aria-current')), [null, 'step', null]);
  assert.equal(find(current, 'back'), undefined);
  assert.equal(find(next, 'back'), undefined);
  const back = find(done, 'back');
  assert.equal(back.tag, 'button');
  assert.match(back.textContent, /Details <member>/);
  const before = document.activeElement;
  current.click();
  next.click();
  back.click();
  assert.deepEqual(requested, [{ index: 0 }]);
  assert.equal(steps.fill.data.current, 1);
  assert.equal(document.activeElement, before);
  steps.fill = fill('steps', { ...STEPS, current: 0 });
  back.click();
  assert.equal(requested.length, 1);
  assert.equal(document.activeElement, before);
});

test('progress shows its name and range and can change from known to unknown', () => {
  const progress = make('progress', PROGRESS);
  const bar = find(progress.shadowRoot, 'bar');
  assert.equal(bar.tag, 'progress');
  assert.equal(bar.getAttribute('aria-labelledby'), find(progress.shadowRoot, 'label').id);
  assert.equal(bar.getAttribute('aria-valuemin'), '0');
  assert.equal(bar.getAttribute('aria-valuemax'), '3.5');
  assert.equal(bar.getAttribute('aria-valuenow'), '1.5');
  assert.equal(bar.getAttribute('max'), '3.5');
  assert.equal(bar.getAttribute('value'), '1.5');
  assert.equal(find(progress.shadowRoot, 'value').textContent, '1.5 of 3.5');
  assert.equal(progress.dataset.state, 'default');
  progress.fill = fill('progress', { label: 'Loading loans', maximum: 4 });
  const unknown = find(progress.shadowRoot, 'bar');
  assert.equal(unknown.getAttribute('role'), 'progressbar');
  assert.equal(unknown.getAttribute('aria-labelledby'), find(progress.shadowRoot, 'label').id);
  assert.equal(unknown.getAttribute('aria-valuenow'), null);
  assert.equal(find(progress.shadowRoot, 'value').textContent, 'Unknown');
  assert.ok(find(progress.shadowRoot, 'indicator'));
  assert.equal(progress.dataset.state, 'loading');
  for (const value of [0, PROGRESS.maximum]) {
    progress.fill = fill('progress', { ...PROGRESS, value });
    assert.equal(find(progress.shadowRoot, 'bar').getAttribute('aria-valuenow'), String(value));
    assert.equal(progress.dataset.state, 'default');
  }
});

test('steps and progress export tool schemas and refuse invalid fills', () => {
  const stepSchema = toolSchema('steps');
  assert.equal(stepSchema.properties.component.const, 'steps');
  assert.deepEqual(stepSchema.properties.data.required, ['label', 'labels', 'current']);
  assert.equal(stepSchema.properties.data.properties.labels.items.type, 'string');
  assert.equal(stepSchema.properties.data.properties.current.type, 'integer');
  const progressSchema = toolSchema('progress');
  assert.equal(progressSchema.properties.component.const, 'progress');
  assert.deepEqual(progressSchema.properties.data.required, ['label', 'maximum']);
  assert.equal(progressSchema.properties.data.properties.maximum.type, 'number');
  assert.equal(progressSchema.properties.data.properties.value.type, 'number');
  for (const [name, data, changes] of [
    ['steps', STEPS, [
      { label: ' ' }, { labels: [] }, { labels: ['Details', ' '] }, { current: -1 }, { current: 3 }, { current: 1.5 },
      { markup: '<b>Step</b>' },
    ]],
    ['progress', PROGRESS, [
      { label: ' ' }, { maximum: 0 }, { maximum: -1 }, { maximum: Infinity }, { maximum: NaN },
      { value: -1 }, { value: 4 }, { value: '1' }, { value: null }, { value: Infinity }, { value: NaN },
      { markup: '<b>Value</b>' },
    ]],
  ]) {
    const element = make(name, data);
    const refused = events(element, 'mu-refused');
    for (const change of changes) {
      const value = fill(name, { ...data, ...change });
      const errors = validateFill(value);
      assert.ok(errors[0]?.startsWith('data.' + Object.keys(change)[0]), JSON.stringify(change));
      element.fill = value;
      assert.equal(element.fill, null);
      assert.equal(element.dataset.state, 'refused');
      assert.deepEqual(refused.at(-1).errors, errors);
    }
    assert.equal(refused.length, changes.length);
  }
});

const RESEARCHER = { type: 'agent', id: 'catalog-assistant', name: 'Catalog assistant' };
const RUN_STEPS = {
  label: 'Research run',
  steps: [
    { id: 'read', name: 'Read the request', state: 'done' },
    { id: 'search', name: 'Search the catalog', state: 'running',
      tool_name: 'catalog.search', tool_arguments: '<query>moss</query>', tool_result: '<img src=x>' },
    { id: 'check', name: 'Check availability', state: 'pending', detail: 'Check the east branch.' },
    { id: 'index', name: 'Read the index', state: 'failed' },
  ],
};
const PLAN = {
  label: 'Research plan',
  tasks: [
    { id: 'read', name: 'Read the request', state: 'done' },
    { id: 'find', name: 'Find a book', state: 'in_progress' },
    { id: 'check', name: 'Check availability', state: 'pending' },
    { id: 'index', name: 'Read the index', state: 'failed' },
    { id: 'browse', name: 'Browse another shelf', state: 'skipped' },
  ],
};

function researchFill(name, data) {
  return fill(name, data, { slots: { authorship: RESEARCHER } });
}

function makeResearch(name, data) {
  const component = new (elements.get('mu-' + name))();
  component.actor = RESEARCHER;
  component.fill = researchFill(name, data);
  return component;
}

const APPROVALS = {
  label: 'Library approvals',
  items: [
    { id: 'hold', title: 'Place a hold', summary: 'Keep <one> book at the east branch.' },
    { id: 'list', title: 'Add a book to the list', summary: 'Keep the title for later.' },
  ],
};

function bindDecisions(queue, id) {
  queue.bind(id, {
    approve: { tool: 'catalog.approve', arguments: { id }, confirm: { message: 'Approve this proposal?', label: 'Confirm approval' } },
    reject: { tool: 'catalog.reject', arguments: { id }, confirm: { message: 'Reject this proposal?', label: 'Confirm rejection' } },
  });
}

function decision(row, index) {
  const source = row.children.at(-1).children[index];
  const root = source.shadowRoot;
  const control = find(root, 'button');
  const requests = [];
  source.addEventListener('mu-action', ({ detail }) => requests.push(detail));
  return { source, root, control, requests, confirm: () => find(root, 'accept').click() };
}

function words(row) {
  return find(row, 'state').textContent;
}

test('the approval queue exports an authored fill and refuses duplicate ids and an invalid item', () => {
  const name = 'approval-queue';
  const schema = toolSchema(name);
  const item = schema.properties.data.properties.items.items;
  assert.equal(schema.properties.component.const, name);
  assert.deepEqual(item.required, ['id', 'title', 'summary']);
  assert.deepEqual(schema.properties.slots.required, ['authorship']);
  const queue = makeResearch(name, APPROVALS);
  const list = find(queue.shadowRoot, 'list');
  assert.equal(list.getAttribute('aria-label'), 'Library approvals');
  assert.equal(find(queue.shadowRoot, 'authorship').textContent, 'Author: Catalog assistant (agent, catalog-assistant)');
  assert.equal(find(list, 'summary').textContent, 'Keep <one> book at the east branch.');
  assert.deepEqual(list.children.map(words), ['Unavailable', 'Unavailable']);
  assert.equal(find(queue.shadowRoot, 'announcement').textContent, '');
  for (const [items, errors] of [
    [Array(2).fill(APPROVALS.items[0]), ['data.items[1].id: must be unique']],
    [[{ ...APPROVALS.items[0], state: 'approved' }], ['data.items[0].state: the contract does not declare this field']],
  ]) {
    queue.addEventListener('mu-refused', (event) => assert.deepEqual(event.detail.errors, errors), { once: true });
    queue.fill = { ...researchFill(name, APPROVALS), data: { label: 'Library approvals', items } };
    assert.equal(queue.dataset.state, 'refused');
    assert.equal(queue.fill, null);
    assert.ok(find(queue.shadowRoot, 'reason'));
  }
  queue.fill = researchFill(name, { label: 'Library approvals', items: [] });
  assert.equal(queue.dataset.state, 'empty');
  assert.equal(find(queue.shadowRoot, 'empty').textContent, 'No items need a decision. Check again later.');
});

test('each proposal confirms, waits for its own receipt and reports only its own result', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  bindDecisions(queue, 'list');
  const [hold, list] = find(queue.shadowRoot, 'list').children;
  const live = find(queue.shadowRoot, 'announcement');
  const approve = decision(hold, 0);
  const other = decision(hold, 1);
  const reject = decision(list, 1);
  assert.deepEqual([words(hold), words(list)], ['Awaiting decision', 'Awaiting decision']);

  approve.control.click();
  assert.equal(words(hold), 'Confirm approval');
  assert.equal(live.textContent, 'Place a hold: Confirm approval');
  assert.equal(approve.root.activeElement, find(approve.root, 'cancel'));
  assert.deepEqual(approve.requests, []);
  const step = find(approve.root, 'confirm');
  step.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
  assert.equal(approve.root.activeElement, approve.control);
  assert.equal(words(hold), 'Awaiting decision');
  assert.deepEqual(approve.requests, []);
  approve.control.click();
  approve.confirm();
  assert.equal(words(hold), 'Pending');
  assert.equal(live.textContent, 'Place a hold: Pending');
  assert.equal(approve.control.getAttribute('aria-busy'), 'true');
  assert.equal(other.control.getAttribute('aria-disabled'), 'true');
  other.control.click();
  assert.equal(find(other.root, 'confirm'), undefined);
  assert.deepEqual(other.requests, []);

  reject.control.click();
  reject.confirm();
  const [approval] = approve.requests;
  const [rejection] = reject.requests;
  assert.equal(approval.tool, 'catalog.approve');
  assert.equal(rejection.tool, 'catalog.reject');
  assert.deepEqual(approval.arguments, { id: 'hold' });
  assert.deepEqual(rejection.arguments, { id: 'list' });
  assert.notEqual(approval.key, rejection.key);
  assert.deepEqual([words(hold), words(list)], ['Pending', 'Pending']);
  assert.equal(queue.receipt({ id: approval.id, key: rejection.key, ok: true }), false);
  assert.equal(queue.receipt({ id: approval.id, key: approval.key, ok: true }), true);
  assert.deepEqual([words(hold), words(list)], ['Approved', 'Pending']);
  assert.equal(live.textContent, 'Place a hold: Approved');
  assert.equal(other.control.getAttribute('aria-disabled'), 'true');
  assert.equal(queue.receipt({ key: rejection.key, ok: true }), true);
  assert.deepEqual([words(hold), words(list)], ['Approved', 'Rejected']);
  assert.equal(live.textContent, 'Add a book to the list: Rejected');
  const announced = live.children[0];
  assert.equal(queue.receipt({ id: rejection.id, ok: true }), false);
  queue.fill = queue.fill;
  assert.equal(live.children[0], announced);
});

test('a failed decision can start again and a try with no receipt keeps the same key', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  const [hold] = find(queue.shadowRoot, 'list').children;
  const approve = decision(hold, 0);
  const reject = decision(hold, 1);
  approve.control.click();
  approve.confirm();
  const [first] = approve.requests;
  assert.equal(queue.receipt({ id: first.id, ok: false, message: 'The branch is busy.' }), true);
  assert.equal(words(hold), 'Not done: The branch is busy.');
  assert.equal(find(queue.shadowRoot, 'announcement').textContent, 'Place a hold: Not done: The branch is busy.');
  assert.equal(reject.control.getAttribute('aria-disabled'), 'false');
  reject.control.click();
  find(reject.root, 'cancel').click();
  assert.equal(words(hold), 'Not done: The branch is busy.');

  approve.control.click();
  approve.confirm();
  const second = approve.requests[1];
  assert.notEqual(second.key, first.key);
  assert.equal(queue.receipt({ id: first.id, ok: true }), false);
  approve.source.noReceipt(second.id);
  assert.equal(words(hold), 'Pending: No receipt came back.');
  assert.equal(reject.control.getAttribute('aria-disabled'), 'true');
  find(approve.root, 'retry').click();
  const third = approve.requests[2];
  assert.equal(third.key, second.key);
  assert.notEqual(third.id, second.id);
  assert.equal(queue.receipt({ id: second.id, key: second.key, ok: true }), true);
  assert.equal(words(hold), 'Approved');
});

test('a new approval fill keeps the focused control, pending action and state by id', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  bindDecisions(queue, 'list');
  const list = find(queue.shadowRoot, 'list');
  const [hold, other] = list.children;
  const approve = decision(hold, 0);
  const reject = decision(other, 1);
  const live = find(queue.shadowRoot, 'announcement');
  approve.control.click();
  approve.confirm();
  reject.control.click();
  const cancel = find(reject.root, 'cancel');
  const announced = live.children[0];
  const [held, listed] = APPROVALS.items;
  queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [listed, held] });
  assert.deepEqual(list.children, [other, hold]);
  assert.equal(reject.root.activeElement, cancel);
  assert.equal(queue.shadowRoot.activeElement, reject.source);
  assert.equal(find(other, 'title').textContent, listed.title);
  assert.equal(find(hold, 'summary').textContent, held.summary);
  assert.deepEqual([words(other), words(hold)], ['Confirm rejection', 'Pending']);
  assert.equal(live.children[0], announced);
  assert.equal(queue.receipt({ key: approve.requests[0].key, ok: true }), true);
  assert.equal(words(hold), 'Approved');
  assert.equal(reject.root.activeElement, cancel);
  find(reject.root, 'cancel').click();
});

test('a new proposal title closes confirmation and requires a new binding', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  const [hold] = find(queue.shadowRoot, 'list').children;
  const approve = decision(hold, 0);
  const reject = decision(hold, 1);
  approve.control.click();
  assert.ok(find(approve.root, 'confirm'));

  const [held, listed] = APPROVALS.items;
  const title = 'Place a hold at the west branch';
  queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [{ ...held, title }, listed] });
  assert.equal(find(hold, 'title').textContent, title);
  assert.equal(words(hold), 'Unavailable');
  assert.equal(find(approve.root, 'confirm'), undefined);
  for (const { root, control, requests } of [approve, reject]) {
    assert.equal(root.children.find((node) => node.id === 'proposal-title').textContent, title);
    assert.equal(control.getAttribute('aria-disabled'), 'true');
    control.click();
    assert.equal(find(root, 'confirm'), undefined);
    assert.deepEqual(requests, []);
  }
  bindDecisions(queue, 'hold');
  assert.equal(words(hold), 'Awaiting decision');
  assert.equal(reject.control.getAttribute('aria-disabled'), 'false');
  reject.control.click();
  reject.confirm();
  assert.equal(reject.requests[0].tool, 'catalog.reject');
  assert.equal(queue.receipt({ key: reject.requests[0].key, ok: true }), true);
  queue.fill = queue.fill;
  assert.equal(words(hold), 'Rejected');
});

test('a new proposal summary removes the binding of that row', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  bindDecisions(queue, 'list');
  const [hold, other] = find(queue.shadowRoot, 'list').children;
  const controls = [decision(hold, 0), decision(hold, 1)];
  const [held, listed] = APPROVALS.items;
  const summary = 'Keep the book for two days.';
  queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [{ ...held, summary }, listed] });
  assert.equal(find(hold, 'summary').textContent, summary);
  assert.equal(words(hold), 'Unavailable');
  assert.equal(words(other), 'Awaiting decision');
  for (const { control } of controls) assert.equal(control.getAttribute('aria-disabled'), 'true');
  bindDecisions(queue, 'hold');
  assert.equal(words(hold), 'Awaiting decision');
});

test('a new queue label removes the bindings of each row with no pending decision', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  bindDecisions(queue, 'list');
  const list = find(queue.shadowRoot, 'list');
  const [hold, listed] = list.children;
  const approve = decision(hold, 0);
  const controls = [approve, decision(hold, 1), decision(listed, 0), decision(listed, 1)];
  approve.control.click();
  assert.equal(words(hold), 'Confirm approval');

  const label = 'West branch approvals';
  queue.fill = researchFill('approval-queue', { ...APPROVALS, label });
  assert.equal(find(queue.shadowRoot, 'label').textContent, label);
  assert.equal(list.getAttribute('aria-label'), label);
  assert.deepEqual(list.children.map(words), ['Unavailable', 'Unavailable']);
  for (const { root, control, requests } of controls) {
    assert.equal(control.getAttribute('aria-disabled'), 'true');
    control.click();
    assert.equal(find(root, 'confirm'), undefined);
    assert.deepEqual(requests, []);
  }

  bindDecisions(queue, 'hold');
  assert.deepEqual(list.children.map(words), ['Awaiting decision', 'Unavailable']);
  approve.control.click();
  approve.confirm();
  const [request] = approve.requests;
  assert.equal(request.tool, 'catalog.approve');
  assert.equal(queue.receipt({ key: request.key, ok: true }), true);
  assert.equal(words(hold), 'Approved');
});

test('a new queue label keeps a pending decision until its receipt', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  const [hold] = find(queue.shadowRoot, 'list').children;
  const approve = decision(hold, 0);
  const reject = decision(hold, 1);
  approve.control.click();
  approve.confirm();
  const [request] = approve.requests;

  queue.fill = researchFill('approval-queue', { ...APPROVALS, label: 'West branch approvals' });
  const { title, summary } = APPROVALS.items[0];
  assert.equal(find(hold, 'title').textContent, title);
  assert.equal(find(hold, 'summary').textContent, summary);
  assert.equal(words(hold), 'Pending');
  assert.ok(hold.textContent.includes(APPROVALS.label));
  assert.equal(reject.control.getAttribute('aria-disabled'), 'true');

  assert.equal(queue.receipt({ id: request.id, key: request.key, ok: true }), true);
  assert.equal(find(queue.shadowRoot, 'announcement').textContent, title + ': Approved');
  assert.equal(words(hold), 'Unavailable');
  assert.equal(approve.control.getAttribute('aria-disabled'), 'true');
  assert.equal(reject.control.getAttribute('aria-disabled'), 'true');
  bindDecisions(queue, 'hold');
  assert.equal(words(hold), 'Awaiting decision');
});

test('a change to the queue actor removes each binding without a pending decision', () => {
  for (const change of [{ type: 'human' }, { id: 'west-assistant' }, { name: 'West assistant' }]) {
    const queue = makeResearch('approval-queue', APPROVALS);
    const authorship = { type: RESEARCHER.type, id: RESEARCHER.id };
    queue.fill = fill('approval-queue', APPROVALS, { slots: { authorship } });
    bindDecisions(queue, 'hold');
    bindDecisions(queue, 'list');
    queue.actor = { ...RESEARCHER };
    assert.deepEqual(find(queue.shadowRoot, 'list').children.map(words), ['Awaiting decision', 'Awaiting decision']);

    const actor = { ...RESEARCHER, ...change };
    queue.actor = actor;
    queue.fill = fill('approval-queue', APPROVALS, { slots: { authorship: actor } });
    const rows = find(queue.shadowRoot, 'list').children;
    assert.deepEqual(rows.map(words), ['Unavailable', 'Unavailable']);
    for (const row of rows) {
      for (const index of [0, 1]) assert.equal(decision(row, index).control.getAttribute('aria-disabled'), 'true');
    }
    bindDecisions(queue, 'hold');
    assert.equal(words(rows[0]), 'Awaiting decision');
  }
});

for (const end of ['receipt', 'cancel']) {
  test('a new queue actor keeps a pending decision until ' + end, () => {
    const queue = makeResearch('approval-queue', APPROVALS);
    bindDecisions(queue, 'hold');
    bindDecisions(queue, 'list');
    const [hold] = find(queue.shadowRoot, 'list').children;
    const approve = decision(hold, 0);
    approve.control.click();
    approve.confirm();
    const [request] = approve.requests;

    const actor = { type: 'human', id: 'west-reviewer', name: 'West reviewer' };
    queue.actor = actor;
    queue.fill = fill('approval-queue', APPROVALS, { slots: { authorship: actor } });
    const [pending, other] = find(queue.shadowRoot, 'list').children;
    assert.equal(pending, hold);
    assert.equal(words(hold), 'Pending');
    assert.equal(words(other), 'Unavailable');
    assert.ok(hold.textContent.includes('Author: Catalog assistant (agent, catalog-assistant)'));
    assert.equal(find(queue.shadowRoot, 'authorship').textContent, 'Author: West reviewer (human, west-reviewer)');
    approve.source.noReceipt(request.id);
    find(approve.root, 'retry').click();
    assert.equal(approve.requests[1].key, request.key);

    if (end === 'receipt') {
      assert.equal(queue.receipt({ key: request.key, ok: true }), true);
      assert.equal(find(queue.shadowRoot, 'announcement').textContent, 'Place a hold: Approved');
    } else {
      approve.source.noReceipt(approve.requests[1].id);
      find(approve.root, 'cancel').click();
    }
    assert.equal(words(hold), 'Unavailable');
    assert.ok(!hold.textContent.includes('Catalog assistant'));
    assert.equal(approve.control.getAttribute('aria-disabled'), 'true');
    assert.equal(decision(hold, 1).control.getAttribute('aria-disabled'), 'true');
    bindDecisions(queue, 'hold');
    assert.equal(words(hold), 'Awaiting decision');
  });
}

for (const end of ['receipt', 'cancel']) {
  test('a pending decision keeps its bound text until ' + end, () => {
    const queue = makeResearch('approval-queue', APPROVALS);
    bindDecisions(queue, 'hold');
    const [hold] = find(queue.shadowRoot, 'list').children;
    const live = find(queue.shadowRoot, 'announcement');
    const approve = decision(hold, 0);
    const reject = decision(hold, 1);
    approve.control.click();
    approve.confirm();
    const [request] = approve.requests;
    const [held, listed] = APPROVALS.items;
    const title = 'Place a hold at the west branch';
    const summary = 'Keep the book for two days.';
    queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [{ ...held, title }, listed] });
    queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [{ ...held, title, summary }, listed] });
    assert.equal(find(hold, 'title').textContent, held.title);
    assert.equal(find(hold, 'summary').textContent, held.summary);
    assert.equal(approve.root.children.find((node) => node.id === 'proposal-title').textContent, held.title);
    assert.equal(words(hold), 'Pending');
    assert.equal(live.textContent, held.title + ': Pending');

    if (end === 'receipt') {
      assert.equal(queue.receipt({ key: request.key, ok: true }), true);
      assert.equal(live.textContent, held.title + ': Approved');
    } else {
      approve.source.noReceipt(request.id);
      find(approve.root, 'cancel').click();
      assert.equal(queue.receipt({ key: request.key, ok: true }), false);
    }
    assert.equal(find(hold, 'title').textContent, title);
    assert.equal(find(hold, 'summary').textContent, summary);
    assert.equal(words(hold), 'Unavailable');
    assert.equal(approve.control.getAttribute('aria-disabled'), 'true');
    assert.equal(reject.control.getAttribute('aria-disabled'), 'true');
    bindDecisions(queue, 'hold');
    assert.equal(words(hold), 'Awaiting decision');
  });
}

test('a fill that omits a pending row keeps it until a later fill after its receipt', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  const list = find(queue.shadowRoot, 'list');
  const [hold] = list.children;
  const approve = decision(hold, 0);
  approve.control.click();
  approve.confirm();
  const omitted = researchFill('approval-queue', { ...APPROVALS, items: [] });
  queue.fill = omitted;
  assert.deepEqual(list.children, [hold]);
  assert.equal(queue.dataset.state, 'default');
  assert.equal(find(queue.shadowRoot, 'empty').hidden, true);
  assert.equal(find(hold, 'title').textContent, APPROVALS.items[0].title);
  assert.equal(find(hold, 'summary').textContent, APPROVALS.items[0].summary);
  assert.equal(words(hold), 'Pending');
  assert.equal(queue.receipt({ key: approve.requests[0].key, ok: true }), true);
  assert.deepEqual(list.children, [hold]);
  assert.equal(words(hold), 'Approved');
  assert.equal(find(queue.shadowRoot, 'announcement').textContent, 'Place a hold: Approved');
  queue.fill = omitted;
  assert.deepEqual(list.children, []);
  assert.equal(queue.dataset.state, 'empty');
  assert.equal(find(queue.shadowRoot, 'empty').hidden, false);
});

test('a refused fill keeps pending rows, their keys and their receipt results', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  bindDecisions(queue, 'list');
  const [hold, listed] = find(queue.shadowRoot, 'list').children;
  const approve = decision(hold, 0);
  const reject = decision(listed, 1);
  approve.control.click();
  approve.confirm();
  reject.control.click();
  reject.confirm();
  const [approval] = approve.requests;
  const [rejection] = reject.requests;

  queue.fill = null;
  assert.equal(queue.dataset.state, 'refused');
  assert.equal(find(queue.shadowRoot, 'list'), undefined);
  assert.equal(queue.receipt({ key: approval.key, ok: true }), true);
  assert.equal(find(queue.shadowRoot, 'announcement').textContent, 'Place a hold: Approved');
  queue.fill = null;
  queue.fill = researchFill('approval-queue', APPROVALS);
  assert.deepEqual(find(queue.shadowRoot, 'list').children, [hold, listed]);
  assert.deepEqual([words(hold), words(listed)], ['Approved', 'Pending']);
  reject.source.noReceipt(rejection.id);
  find(reject.root, 'retry').click();
  const retry = reject.requests[1];
  assert.notEqual(retry.id, rejection.id);
  assert.equal(retry.key, rejection.key);
  assert.equal(queue.receipt({ key: retry.key, ok: true }), true);
  assert.equal(words(listed), 'Rejected');
});

test('a fill that omits a row closes its open confirm step and removes the row', () => {
  const queue = makeResearch('approval-queue', APPROVALS);
  bindDecisions(queue, 'hold');
  const list = find(queue.shadowRoot, 'list');
  const [hold, other] = list.children;
  const approve = decision(hold, 0);
  approve.control.click();
  assert.ok(find(approve.root, 'confirm'));
  queue.fill = researchFill('approval-queue', { ...APPROVALS, items: [APPROVALS.items[1]] });
  assert.deepEqual(list.children, [other]);
  assert.equal(find(approve.root, 'confirm'), undefined);
  assert.deepEqual(approve.requests, []);
});

test('run steps show an ordered list, the states and optional details as text', () => {
  const run = makeResearch('run-steps', RUN_STEPS);
  const list = find(run.shadowRoot, 'list');
  assert.equal(list.tag, 'ol');
  assert.equal(list.getAttribute('aria-label'), 'Research run');
  assert.match(find(run.shadowRoot, 'authorship').textContent, /Catalog assistant \(agent, catalog-assistant\)/);
  assert.deepEqual(list.children.map((row) => find(row, 'state').textContent), ['Done', 'Running', 'Pending', 'Failed']);
  assert.equal(find(list.children[0], 'toggle'), undefined);
  const [, search, check] = list.children;
  const button = find(search, 'toggle');
  const panel = find(search, 'panel');
  assert.equal(button.tag, 'button');
  assert.equal(button.getAttribute('aria-labelledby'), find(button, 'name').id);
  assert.equal(button.getAttribute('aria-controls'), panel.id);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);
  assert.match(find(search, 'tool').textContent, /catalog\.search/);
  for (const [part, expected] of [['arguments', '<query>moss</query>'], ['result', '<img src=x>']]) {
    const node = find(search, part);
    assert.equal(node.tag, 'pre');
    assert.equal(node.textContent, expected);
    assert.equal(node.children.some((child) => child instanceof TestNode), false);
  }
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  assert.equal(find(check, 'detail').textContent, 'Check the east branch.');
});

test('run step updates keep the same open and focused button across a reorder', () => {
  const run = makeResearch('run-steps', RUN_STEPS);
  const list = find(run.shadowRoot, 'list');
  const live = find(run.shadowRoot, 'announcement');
  assert.equal(live.getAttribute('aria-live'), 'polite');
  assert.equal(live.textContent, '');
  const [read, search, check, index] = RUN_STEPS.steps;
  const toggle = find(list.children[1], 'toggle');
  const other = find(list.children[2], 'toggle');
  toggle.click();
  other.click();
  toggle.focus();
  const updated = { ...RUN_STEPS, steps: [read, check, { ...search, state: 'done', tool_result: 'One match.' }, index] };
  run.fill = researchFill('run-steps', updated);
  assert.equal(find(run.shadowRoot, 'list'), list);
  assert.equal(find(run.shadowRoot, 'announcement'), live);
  assert.equal(find(list.children[2], 'toggle'), toggle);
  assert.equal(run.shadowRoot.activeElement, toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(other.getAttribute('aria-expanded'), 'true');
  assert.equal(find(list.children[2], 'result').textContent, 'One match.');
  assert.equal(live.textContent, 'Search the catalog: done');
  const [notice] = live.children;
  run.fill = researchFill('run-steps', updated);
  assert.equal(live.children[0], notice);
  run.fill = researchFill('run-steps', { ...updated, steps: [read, check, index] });
  assert.equal(run.shadowRoot.activeElement, null);
  assert.equal(other.getAttribute('aria-expanded'), 'true');
});

test('plan shows each task state as text and announces each changed state once', () => {
  const plan = makeResearch('plan', PLAN);
  const list = find(plan.shadowRoot, 'list');
  const live = find(plan.shadowRoot, 'announcement');
  assert.equal(list.tag, 'ul');
  assert.equal(list.getAttribute('aria-label'), 'Research plan');
  assert.equal(find(plan.shadowRoot, 'toggle'), undefined);
  assert.deepEqual(list.children.map((row) => find(row, 'state').textContent), ['Done', 'In progress', 'Pending', 'Failed', 'Skipped']);
  assert.equal(live.getAttribute('aria-live'), 'polite');
  assert.equal(live.textContent, '');
  const [read, findBook, check, index] = PLAN.tasks;
  const updated = { ...PLAN, tasks: [read, { ...findBook, state: 'done' }, { ...check, state: 'in_progress' },
    index, { id: 'note', name: 'Write the result', state: 'pending' }] };
  const outside = new TestNode('button');
  outside.focus();
  plan.fill = researchFill('plan', updated);
  assert.equal(find(plan.shadowRoot, 'announcement'), live);
  assert.equal(document.activeElement, outside);
  assert.equal(live.textContent, 'Find a book: done. Check availability: in progress');
  const [notice] = live.children;
  plan.fill = researchFill('plan', updated);
  assert.equal(live.children[0], notice);
});

test('run steps and plan export tool schemas and refuse invalid fills', () => {
  for (const [name, data, key, states] of [
    ['run-steps', RUN_STEPS, 'steps', ['pending', 'running', 'done', 'failed']],
    ['plan', PLAN, 'tasks', ['pending', 'in_progress', 'done', 'failed', 'skipped']],
  ]) {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    const items = schema.properties.data.properties[key].items;
    assert.deepEqual(items.required, ['id', 'name', 'state']);
    assert.deepEqual(items.properties.state.enum, states);
    if (key === 'steps') {
      assert.equal(items.properties.tool_arguments.maxLength, 2000);
      assert.equal(items.properties.tool_result.maxLength, 2000);
    }
    const component = makeResearch(name, data);
    const [first] = data[key];
    const cases = [
      [[first, { ...first, name: 'A different name' }], 'data.' + key + '[1].id: must be unique'],
      [[{ ...first, state: 'invalid' }], 'data.' + key + '[0].state: must be one of ' + states.join(', ')],
    ];
    if (key === 'steps') {
      cases.push([[{ ...first, tool_name: 'catalog.search', tool_arguments: { query: 'moss' } }],
        'data.steps[0].tool_arguments: must be a string']);
      cases.push([[{ ...first, tool_name: 'catalog.search', tool_result: 'x'.repeat(2001) }],
        'data.steps[0].tool_result: more than 2000 characters']);
    }
    const refused = events(component, 'mu-refused');
    for (const [items, error] of cases) {
      const invalid = researchFill(name, { ...data, [key]: items });
      assert.deepEqual(validateFill(invalid), [error]);
      component.fill = invalid;
      assert.equal(component.dataset.state, 'refused');
      assert.equal(component.fill, null);
      assert.deepEqual(refused.at(-1).errors, [error]);
    }
    component.fill = researchFill(name, data);
    assert.equal(find(component.shadowRoot, 'announcement').textContent, '');
  }
});
