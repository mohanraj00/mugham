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
    for (const child of children) {
      if (child instanceof TestNode) {
        if (child.parentNode) child.parentNode.children = child.parentNode.children.filter((node) => node !== child);
        child.parentNode = this;
      }
      this.children.push(child);
    }
  }
  prepend(child) {
    this.append(child);
    this.children.unshift(this.children.pop());
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(value) { this.setAttribute('id', value); }
  get localName() { return this.tag; }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: value }); }
  matches(selector) { return selector === 'a[href]' && this.tag === 'a' && this.getAttribute('href') !== null; }
  focus() { document.activeElement = this; }
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
  attachShadow() { return (this.shadowRoot = new TestNode()); }
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
