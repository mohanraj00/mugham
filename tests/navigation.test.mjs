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
    ' https://example.org/', 'https://staff@example.org/', 'https://', '']) {
    const value = fill('breadcrumbs', { ...BREADCRUMBS, items: [{ label: 'Desk', href }, { label: 'Loans' }] });
    assert.match(validateFill(value)[0], /^data.items\[0\].href:/, href);
    crumbs.fill = value;
    assert.equal(crumbs.fill, null, href);
  }
  for (const href of ['/loans', './loans', 'loans', '#loans', '?page=2', 'HTTPS://example.org/']) {
    assert.deepEqual(validateFill(fill('breadcrumbs', {
      ...BREADCRUMBS, items: [{ label: 'Desk', href }, { label: 'Loans' }],
    })), [], href);
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
