import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the DOM updates and the native button click. The browser check sends real keys.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};
  hidden = false;
  isConnected = true;
  direction = 'ltr';
  content = [];

  constructor(tag) { super(); this.tag = tag; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) {
    const before = this.getAttribute(name);
    this.attributes.set(name, value);
    if (this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, before, value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) {
    const before = this.getAttribute(name);
    if (this.attributes.delete(name) && this.constructor.observedAttributes?.includes(name)) {
      this.attributeChangedCallback(name, before, null);
    }
  }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: value }); }
  get tabIndex() { return Number(this.getAttribute('tabindex') ?? (this.tag === 'button' ? 0 : -1)); }
  set tabIndex(value) { this.setAttribute('tabindex', String(value)); }
  get localName() { return this.tag; }
  getRootNode() { return document; }
  contains(node) { return this === node || this.children.some((child) => child.contains?.(node)); }
  assignedElements() { return this.content; }
  matches(selector) {
    if (selector === ':dir(rtl)') return this.direction === 'rtl';
    return selector.includes('button') && this.tag === 'button';
  }
  getClientRects() { return this.hidden ? [] : [{}]; }
  focus() {
    document.activeElement = this.host ?? this;
    if (this.host) this.host.shadowRoot.activeElement = this;
    this.dispatchEvent(new Event('focus'));
  }
  click() { this.dispatchEvent(new Event('click')); }
}

const elements = new Map();
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = new TestNode()); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.getComputedStyle = () => ({ visibility: 'visible' });
globalThis.document = {
  createElement: (tag) => new TestNode(tag),
  createTextNode: (textContent) => ({ textContent }),
};
globalThis.customElements = {
  define: (name, constructor) => elements.set(name, constructor),
  get: (name) => elements.get(name),
};

const { define } = await import('../src/components/index.js');
define();

const ITEMS = [
  { label: 'General <settings>', name: 'general' },
  { label: 'Notifications', name: 'notifications' },
  { label: 'Access rules', name: 'access_rules' },
];
const TABS = { label: 'Settings', tabs: ITEMS };
const ACCORDION = { label: 'Settings sections', sections: ITEMS };

function eventLog(element, type) {
  const events = [];
  element.addEventListener(type, (event) => {
    assert.ok(event.bubbles && event.composed);
    events.push(event.detail);
  });
  return events;
}

function press(node, key) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key });
  node.dispatchEvent(event);
  return event.defaultPrevented;
}

function makeTabs() {
  const tabs = new (elements.get('mu-tabs'))();
  const events = eventLog(tabs, 'mu-tabs-change');
  tabs.fill = fill('tabs', TABS);
  const [list, ...panels] = tabs.shadowRoot.children;
  for (const node of [...list.children, ...panels]) node.host = tabs;
  return { tabs, list, buttons: list.children, panels, events };
}

for (const [name, key, data] of [['tabs', 'tabs', TABS], ['accordion', 'sections', ACCORDION]]) {
  test(name + ' exports a tool schema with named scalar records', () => {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    assert.deepEqual(schema.properties.data.required, ['label', key]);
    const list = schema.properties.data.properties[key];
    assert.equal(list.minItems, 1);
    assert.equal(list.maxItems, 20);
    assert.equal(list.items.additionalProperties, false);
    assert.deepEqual(list.items.required, ['label', 'name']);
    assert.ok(new RegExp(list.items.properties.name.pattern).test('access_rules'));
    assert.ok(!new RegExp(list.items.properties.name.pattern).test('Access-rules'));
    assert.deepEqual(validateFill(fill(name, data)), []);
  });

  test(name + ' refuses invalid names, nested fills, blank labels and duplicate names', () => {
    const element = new (elements.get('mu-' + name))();
    const refusals = eventLog(element, 'mu-refused');
    for (const [change, path] of [
      [{ [key]: [{ ...ITEMS[0], name: 'Tab-1' }] }, key + '[0].name'],
      [{ [key]: [{ ...ITEMS[0], panel: fill('text', { text: 'Sample' }) }] }, key + '[0].panel'],
      [{ label: ' ' }, 'label'],
      [{ [key]: [{ ...ITEMS[0], label: ' ' }] }, key + '[0].label'],
      [{ [key]: [ITEMS[0], { ...ITEMS[0], label: 'Other' }] }, key + '[1].name'],
    ]) {
      element.fill = fill(name, data);
      assert.ok(element.fill);
      element.fill = fill(name, { ...data, ...change });
      assert.equal(element.fill, null);
      assert.equal(element.dataset.state, 'refused');
      assert.ok(refusals.at(-1).errors[0].startsWith('data.' + path + ':'));
      assert.equal(name === 'tabs' ? element.select('general') : element.setExpanded('general', true), false);
    }
    assert.equal(refusals.length, 5);
  });
}

test('tabs set roles, links and one tab stop and keep named slots', () => {
  const { tabs, list, buttons, panels, events } = makeTabs();
  assert.equal(list.getAttribute('role'), 'tablist');
  assert.equal(list.getAttribute('aria-label'), TABS.label);
  assert.equal(tabs.selected, 'general');
  assert.deepEqual(events, []);
  for (const [index, panel] of panels.entries()) {
    const button = buttons[index];
    assert.equal(button.tag, 'button');
    assert.equal(button.getAttribute('role'), 'tab');
    assert.equal(button.textContent, ITEMS[index].label);
    assert.equal(button.getAttribute('aria-controls'), panel.getAttribute('id'));
    assert.equal(button.getAttribute('aria-selected'), String(index === 0));
    assert.equal(button.tabIndex, index === 0 ? 0 : -1);
    assert.equal(panel.getAttribute('role'), 'tabpanel');
    assert.equal(panel.getAttribute('aria-labelledby'), button.getAttribute('id'));
    assert.equal(panel.hidden, index !== 0);
    assert.equal(panel.hasAttribute('tabindex'), index === 0);
    assert.equal(panel.children[0].tag, 'slot');
    assert.equal(panel.children[0].getAttribute('name'), ITEMS[index].name);
  }
  const control = new TestNode('button');
  const slot = panels[0].children[0];
  const box = new TestNode('mu-app-box');
  box.shadowRoot = new TestNode();
  box.shadowRoot.append(control);
  slot.content = [box];
  slot.dispatchEvent(new Event('slotchange'));
  assert.equal(panels[0].hasAttribute('tabindex'), false);
  control.hidden = true;
  assert.equal(press(buttons[0], 'Tab'), false);
  assert.equal(panels[0].tabIndex, 0);
});

test('tabs select by method, attribute and click and move focus before hiding it', () => {
  const { tabs, buttons, panels, events } = makeTabs();
  const content = new TestNode('button');
  panels[0].children[0].content = [content];
  content.focus();
  assert.equal(tabs.select('notifications'), true);
  assert.equal(tabs.shadowRoot.activeElement, buttons[1]);
  assert.equal(tabs.select('notifications'), false);
  assert.equal(tabs.select('unknown'), false);
  tabs.setAttribute('selected', 'access_rules');
  assert.equal(tabs.shadowRoot.activeElement, buttons[2]);
  assert.equal(tabs.selected, 'access_rules');
  tabs.setAttribute('selected', 'unknown');
  assert.equal(tabs.selected, 'access_rules');
  tabs.removeAttribute('selected');
  buttons[1].click();
  buttons[1].click();
  buttons[2].focus();
  assert.deepEqual(events, ['notifications', 'access_rules', 'general', 'notifications', 'access_rules'].map((name) => ({ name })));

  const initial = new (elements.get('mu-tabs'))();
  initial.setAttribute('selected', 'access_rules');
  const changes = eventLog(initial, 'mu-tabs-change');
  initial.fill = fill('tabs', TABS);
  assert.equal(initial.selected, 'access_rules');
  assert.deepEqual(changes, []);
  initial.select('notifications');
  initial.setAttribute('selected', 'access_rules');
  assert.equal(initial.selected, 'access_rules');
  initial.fill = fill('tabs', { ...TABS, tabs: ITEMS.slice(0, 2) });
  assert.equal(initial.selected, 'general');
  assert.deepEqual(changes, [{ name: 'notifications' }, { name: 'access_rules' }, { name: 'general' }]);
});

test('tabs activate on arrow, Home and End keys and reverse the arrows in right to left text', () => {
  const { tabs, buttons, panels, events } = makeTabs();
  buttons[0].focus();
  for (const [direction, key, from, to] of [
    ['ltr', 'ArrowLeft', 0, 2], ['ltr', 'ArrowRight', 2, 0], ['ltr', 'ArrowRight', 0, 1],
    ['ltr', 'End', 1, 2], ['ltr', 'Home', 2, 0],
    ['rtl', 'ArrowRight', 0, 2], ['rtl', 'ArrowLeft', 2, 0],
  ]) {
    buttons[from].direction = direction;
    assert.equal(press(buttons[from], key), true);
    assert.equal(tabs.selected, ITEMS[to].name);
    assert.equal(tabs.shadowRoot.activeElement, buttons[to]);
    assert.deepEqual(buttons.map((button) => button.tabIndex), buttons.map((_, index) => index === to ? 0 : -1));
    assert.deepEqual(panels.map((panel) => panel.hidden), panels.map((_, index) => index !== to));
  }
  for (const key of ['Tab', 'ArrowUp', 'ArrowDown', 'Escape']) assert.equal(press(buttons[0], key), false);
  assert.deepEqual(events.map(({ name }) => name), ['access_rules', 'general', 'notifications', 'access_rules', 'general', 'access_rules', 'general']);
});

test('accordion headings contain native buttons and sections can expand independently', () => {
  const accordion = new (elements.get('mu-accordion'))();
  const events = eventLog(accordion, 'mu-accordion-toggle');
  accordion.setAttribute('heading-level', '3');
  accordion.fill = fill('accordion', ACCORDION);
  const [group] = accordion.shadowRoot.children;
  const [heading, panel, otherHeading, otherPanel] = group.children;
  const [button] = heading.children;
  const [otherButton] = otherHeading.children;
  button.host = accordion;
  assert.equal(group.getAttribute('role'), 'group');
  assert.equal(group.getAttribute('aria-label'), ACCORDION.label);
  assert.equal(heading.tag, 'h3');
  assert.equal(heading.children.length, 1);
  assert.equal(button.tag, 'button');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(button.textContent, ITEMS[0].label);
  assert.equal(button.getAttribute('aria-controls'), panel.getAttribute('id'));
  assert.equal(panel.children[0].tag, 'slot');
  assert.equal(panel.children[0].getAttribute('name'), 'general');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  assert.equal(accordion.dataset.state, 'collapsed');

  // The browser turns Enter and Space on a native button into one click.
  button.focus();
  for (const key of ['Enter', ' ']) {
    assert.equal(press(button, key), false);
    button.click();
    assert.equal(accordion.shadowRoot.activeElement, button);
  }
  assert.equal(panel.hidden, true);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(accordion.setExpanded('notifications', true), true);
  assert.equal(otherButton.getAttribute('aria-expanded'), 'true');
  assert.equal(accordion.setExpanded('notifications', true), false);
  assert.equal(accordion.setExpanded('unknown', true), false);
  assert.throws(() => accordion.setExpanded('general', 'yes'), TypeError);
  assert.ok(!panel.hidden && !otherPanel.hidden);
  const content = new TestNode('button');
  panel.children[0].content = [content];
  content.focus();
  assert.equal(accordion.setExpanded('general', false), true);
  assert.equal(accordion.shadowRoot.activeElement, button);
  assert.equal(panel.hidden, true);
  assert.equal(accordion.dataset.state, 'expanded');
  assert.equal(press(otherButton, 'Escape'), false);
  assert.equal(otherPanel.hidden, false);
  otherButton.click();
  assert.equal(accordion.dataset.state, 'collapsed');
  assert.deepEqual(events, [
    { name: 'general', expanded: true }, { name: 'general', expanded: false },
    { name: 'general', expanded: true }, { name: 'notifications', expanded: true },
    { name: 'general', expanded: false }, { name: 'notifications', expanded: false },
  ]);
});
