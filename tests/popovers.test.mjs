import assert from 'node:assert/strict';
import { setImmediate as nextTask } from 'node:timers/promises';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the native Popover API. The browser check sends real keys and reads the accessibility tree.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};
  style = { setProperty() {} };
  isConnected = true;
  clientHeight = 44;
  scrollHeight = 44;
  offsetHeight = 44;
  #open = false;

  constructor(tag) { super(); this.tag = tag; }
  append(child) { this.children.push(child); child.parentNode = this; }
  replaceChildren(...children) { this.children = []; children.forEach((child) => this.append(child)); }
  remove() { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: value }); }
  contains(node) { return this === node || this.children.some((child) => child.contains?.(node)); }
  focus() { document.activeElement = this; }
  click() { this.dispatchEvent(new Event('click', { cancelable: true })); }
  matches(selector) { return selector === ':popover-open' && this.#open; }
  getBoundingClientRect() { return { left: 10, right: 110, top: 20, bottom: 64, width: 100, height: 44 }; }
  getRootNode() { return document; }
  assignedElements() { return []; }

  #toggle(oldState, newState) {
    const event = (type) => Object.assign(new Event(type), { oldState, newState });
    this.dispatchEvent(event('beforetoggle'));
    this.#open = newState === 'open';
    setImmediate(() => this.dispatchEvent(event('toggle')));
  }

  showPopover() {
    this.#toggle('closed', 'open');
  }

  hidePopover() {
    if (!this.#open) return;
    this.#toggle('open', 'closed');
    // Model the fallback to the body when the browser cannot restore focus.
    if (this.contains(document.activeElement)) document.body.focus();
  }

  escape() {
    if (this.popover !== 'manual') this.hidePopover();
  }
}

function find(root, name) {
  if (root.getAttribute?.('part') === name || root.tag === name) return root;
  return root.children?.map((child) => find(child, name)).find(Boolean);
}

function press(node, key) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key });
  if (node.dispatchEvent(event) && ['Enter', ' '].includes(key)) node.click();
}

const elements = new Map();
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() {
    this.shadowRoot = new TestNode();
    Object.defineProperty(this.shadowRoot, 'activeElement', { get: () => document.activeElement });
    return this.shadowRoot;
  }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  createElement: (tag) => new TestNode(tag),
  createTextNode: (textContent) => ({ textContent }),
  getElementById: () => null,
  body: new TestNode('body'),
  documentElement: { clientWidth: 375, clientHeight: 812 },
});
globalThis.customElements = {
  define: (name, constructor) => elements.set(name, constructor),
  get: (name) => elements.get(name),
};

const { define } = await import('../src/components/index.js');
define();
const menuData = { label: 'Tray options', items: [{ label: 'Export <CSV>', name: 'export_csv' }, { label: 'Print list', name: 'print_list' }] };
const tooltipData = { text: 'Each tray holds <12> cells.' };
const toastData = { message: 'Tray <A3> saved.' };
const make = (name, data) => {
  const element = new (elements.get('mu-' + name))();
  element.fill = fill(name, data);
  return element;
};

function watch(element, types) {
  const events = [];
  for (const type of types) {
    element.addEventListener(type, (event) => {
      assert.ok(event.bubbles && event.composed);
      events.push([event.type, event.detail]);
    });
  }
  return events;
}

for (const [name, data, required, bad] of [
  ['menu', menuData, ['label', 'items'], { items: [{ label: 'Export', name: 'Export CSV' }] }],
  ['tooltip', tooltipData, ['text'], { text: { component: 'button' } }],
  ['toast', toastData, ['message'], { kind: 'warning' }],
]) {
  test(name + ' exports its fill schema and refuses invalid data', () => {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    assert.deepEqual(schema.properties.data.required, required);
    assert.equal(schema.properties.data.additionalProperties, false);
    assert.deepEqual(validateFill(fill(name, data)), []);
    assert.ok(validateFill(fill(name, { ...data, ...bad })).length);
    const element = make(name, { ...data, ...bad });
    assert.equal(element.dataset.state, 'refused');
    assert.equal(element.fill, null);
    assert.equal(find(element.shadowRoot, name), undefined);
  });
}

test('the menu tool schema gives each item two required scalar fields', () => {
  const item = toolSchema('menu').properties.data.properties.items.items;
  assert.deepEqual(item.required, ['label', 'name']);
  assert.equal(item.additionalProperties, false);
  assert.equal(item.properties.label.type, 'string');
  assert.equal(item.properties.name.type, 'string');
  assert.equal(item.properties.name.pattern, '^[a-z][a-z0-9]*(_[a-z0-9]+)*$');
});

test('the menu refuses a record with too many fields as one error', () => {
  const item = { ...menuData.items[0] };
  for (let index = 0; index < 40; index++) item['extra_' + index] = 'Extra text';
  assert.deepEqual(validateFill(fill('menu', { ...menuData, items: [item] })),
    ['data.items[0]: more than 40 keys']);
});

test('the menu moves focus in order and sends one selection with its name', async () => {
  const element = make('menu', menuData);
  const events = watch(element, ['mu-menu-open', 'mu-menu-close', 'mu-menu-select', 'mu-action']);
  const trigger = find(element.shadowRoot, 'trigger');
  const menu = find(element.shadowRoot, 'menu');
  const [first, last] = menu.children;
  assert.equal(trigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.getAttribute('role'), 'menu');
  assert.equal(menu.getAttribute('aria-labelledby'), trigger.getAttribute('id'));
  assert.equal(first.getAttribute('role'), 'menuitem');
  assert.equal(first.textContent, 'Export <CSV>');
  trigger.focus();

  press(trigger, 'ArrowUp');
  await nextTask();
  assert.equal(element.dataset.state, 'open');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, last);
  for (const [from, key, to] of [[last, 'ArrowDown', first], [first, 'ArrowUp', last],
    [last, 'Home', first], [first, 'End', last]]) {
    press(from, key);
    assert.equal(document.activeElement, to);
  }
  // Escape closes the auto popover. The menu returns focus to its trigger.
  assert.equal(menu.popover, 'auto');
  menu.escape();
  await nextTask();
  assert.equal(element.dataset.state, 'default');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, trigger);
  assert.deepEqual(events.splice(0).map(([type]) => type), ['mu-menu-open', 'mu-menu-close']);

  press(trigger, 'ArrowDown');
  await nextTask();
  const tab = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Tab' });
  menu.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, false);
  assert.equal(document.activeElement, trigger);
  assert.equal(menu.matches(':popover-open'), false);
  await nextTask();
  assert.deepEqual(events.splice(0).map(([type]) => type), ['mu-menu-open', 'mu-menu-close']);

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    press(trigger, key);
    await nextTask();
    assert.equal(document.activeElement, first);
    press(first, key === 'Enter' ? ' ' : 'Enter');
    first.click();
    await nextTask();
    assert.equal(document.activeElement, trigger);
    assert.deepEqual(events.splice(0).map(([type, detail]) => [type, detail ?? null]), [
      ['mu-menu-open', null], ['mu-menu-select', { name: 'export_csv' }], ['mu-menu-close', null],
    ]);
  }
});

test('closing the menu returns focus from an item and keeps focus outside the menu', () => {
  const element = make('menu', menuData);
  const trigger = find(element.shadowRoot, 'trigger');
  const menu = find(element.shadowRoot, 'menu');
  const [first] = menu.children;
  press(trigger, 'Enter');
  assert.equal(document.activeElement, first);
  menu.hidePopover();
  assert.equal(menu.matches(':popover-open'), false);
  assert.equal(document.activeElement, trigger);

  const other = new TestNode('button');
  press(trigger, 'Enter');
  other.focus();
  menu.hidePopover();
  assert.equal(document.activeElement, other);
});

test('a menu item click returns focus to the button before the selection event', () => {
  const element = make('menu', menuData);
  const trigger = find(element.shadowRoot, 'trigger');
  const menu = find(element.shadowRoot, 'menu');
  const [first] = menu.children;
  let selection;
  element.addEventListener('mu-menu-select', (event) => {
    selection = { detail: event.detail, focus: document.activeElement, open: menu.matches(':popover-open') };
  });

  trigger.click();
  assert.equal(document.activeElement, first);
  document.body.focus();
  first.click();

  assert.equal(document.activeElement, trigger);
  assert.deepEqual(selection, { detail: { name: 'export_csv' }, focus: trigger, open: false });
});

test('the tooltip describes its target and opens on hover or focus without moving focus', async () => {
  const element = make('tooltip', tooltipData);
  const target = new TestNode('button');
  target.setAttribute('aria-describedby', 'existing');
  element.append(target);
  const slot = find(element.shadowRoot, 'slot');
  slot.assignedElements = () => [target];
  element.connectedCallback();
  const popup = find(element.shadowRoot, 'tooltip');
  const anchor = slot.parentNode;
  const events = watch(element, ['mu-tooltip-open', 'mu-tooltip-close']);
  const description = element.children[1];
  const descriptionSlot = element.shadowRoot.children.find((node) => node.tag === 'slot');
  assert.equal(descriptionSlot?.getAttribute('name'), description.slot);
  assert.equal(description.hidden, true);
  assert.equal(description.textContent, tooltipData.text);
  assert.equal(target.getAttribute('aria-describedby'), 'existing ' + description.getAttribute('id'));
  assert.equal(popup.getAttribute('role'), 'tooltip');
  assert.equal(popup.textContent, tooltipData.text);

  target.focus();
  const pointer = (type) => anchor.dispatchEvent(Object.assign(new Event(type), { pointerType: 'mouse' }));
  pointer('pointerenter');
  await nextTask();
  assert.equal(popup.matches(':popover-open'), true);
  pointer('pointerleave');
  await nextTask();
  assert.equal(popup.matches(':popover-open'), false);
  target.dispatchEvent(new Event('focus'));
  await nextTask();
  assert.equal(popup.matches(':popover-open'), true);
  popup.escape();
  await nextTask();
  assert.equal(document.activeElement, target);
  assert.equal(popup.matches(':popover-open'), false);
  assert.deepEqual(events.map(([type]) => type), ['mu-tooltip-open', 'mu-tooltip-close', 'mu-tooltip-open', 'mu-tooltip-close']);

  element.fill = fill('tooltip', { text: ' ' });
  assert.equal(target.getAttribute('aria-describedby'), 'existing');
  assert.deepEqual(element.children, [target]);
  assert.equal(element.dataset.state, 'refused');
});

test('Escape keeps the tooltip closed until focus returns or the pointer enters', () => {
  const element = make('tooltip', tooltipData);
  const target = new TestNode('button');
  const other = new TestNode('button');
  const slot = find(element.shadowRoot, 'slot');
  slot.assignedElements = () => [target];
  element.connectedCallback();
  const popup = find(element.shadowRoot, 'tooltip');
  const focusEvent = (type, relatedTarget) => target.dispatchEvent(Object.assign(new Event(type), { relatedTarget }));

  target.focus();
  focusEvent('focus', other);
  assert.equal(popup.matches(':popover-open'), true);
  popup.escape();
  focusEvent('blur', null);
  focusEvent('focus', null);
  assert.equal(document.activeElement, target);
  assert.equal(popup.matches(':popover-open'), false);

  other.focus();
  focusEvent('blur', other);
  target.focus();
  focusEvent('focus', other);
  assert.equal(popup.matches(':popover-open'), true);

  popup.escape();
  slot.parentNode.dispatchEvent(Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }));
  assert.equal(popup.matches(':popover-open'), true);
  assert.equal(document.activeElement, target);
});

test('a toast stays open for eight seconds or until the person closes it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const origin = new TestNode('button');
  origin.focus();
  const element = make('toast', toastData);
  const events = watch(element, ['mu-toast-open', 'mu-toast-close']);
  const toast = find(element.shadowRoot, 'toast');
  const status = element.shadowRoot.children.find((node) => node.getAttribute('role') === 'status');
  assert.equal(toast.popover, 'manual');
  assert.equal(find(toast, 'close'), undefined);
  assert.equal(status.textContent, '');
  element.show();
  element.show();
  await nextTask();
  t.mock.timers.tick(7999);
  assert.equal(status.textContent, toastData.message);
  assert.equal(toast.matches(':popover-open'), true);
  assert.equal(document.activeElement, origin);
  t.mock.timers.tick(1);
  await nextTask();
  assert.equal(toast.matches(':popover-open'), false);
  assert.equal(status.textContent, '');
  assert.deepEqual(events.splice(0).map(([type]) => type), ['mu-toast-open', 'mu-toast-close']);

  element.fill = fill('toast', { message: 'Tray note did not save.', kind: 'error', close_label: 'Close message' });
  const alert = element.shadowRoot.children.find((node) => node.getAttribute('role') === 'alert');
  const error = find(element.shadowRoot, 'toast');
  const close = find(error, 'close');
  element.show();
  await nextTask();
  t.mock.timers.tick(16000);
  error.escape();
  assert.equal(alert.textContent, 'Tray note did not save.');
  assert.equal(error.matches(':popover-open'), true);
  assert.equal(document.activeElement, origin);
  close.focus();
  press(close, ' ');
  await nextTask();
  assert.equal(error.matches(':popover-open'), false);
  assert.equal(document.activeElement, origin);
  assert.deepEqual(events.splice(0).map(([type]) => type), ['mu-toast-open', 'mu-toast-close']);

  element.show();
  element.fill = fill('toast', { message: ' ' });
  t.mock.timers.tick(16000);
  assert.equal(error.matches(':popover-open'), false);
  assert.equal(alert.textContent, '');
  assert.equal(element.dataset.state, 'refused');
});
