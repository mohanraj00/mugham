import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the render tree. The browser checks cover the slot, keyboard and themes.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};

  constructor(tag) { super(); this.tag = tag; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(textContent) { this.replaceChildren({ textContent }); }
}

const elements = new Map();
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = new TestNode()); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.document = {
  createElement: (tag) => new TestNode(tag),
  createTextNode: (textContent) => ({ textContent }),
};
globalThis.customElements = {
  define: (tag, constructor) => elements.set(tag, constructor),
  get: (tag) => elements.get(tag),
};

const { define } = await import('../src/components/index.js');
define();

const EMPTY = { title: 'No loans <found>', text: 'Try <another> search.' };
const SKELETON = { label: 'Loading loans', lines: 3 };
const BADGE = { text: 'On loan <today>', tone: 'info' };
const AVATAR = { name: 'Sample Reader' };

function make(name, data) {
  const element = new (elements.get('mu-' + name))();
  element.fill = fill(name, data);
  return element;
}

test('empty state shows scalar text and a named slot for a page control', () => {
  const empty = make('empty-state', EMPTY);
  const [group] = empty.shadowRoot.children;
  const [title, text, action] = group.children;
  assert.equal(empty.dataset.state, 'empty');
  assert.equal(group.getAttribute('role'), 'group');
  assert.equal(group.getAttribute('aria-labelledby'), title.getAttribute('id'));
  assert.equal(group.getAttribute('aria-live'), null);
  assert.equal(title.tag, 'h2');
  assert.deepEqual(title.children, [{ textContent: EMPTY.title }]);
  assert.deepEqual(text.children, [{ textContent: EMPTY.text }]);
  assert.equal(action.tag, 'slot');
  assert.equal(action.getAttribute('name'), 'action');
  assert.deepEqual(action.children, []);
});

test('skeleton exposes one name and keeps each placeholder out of the accessibility tree', () => {
  const skeleton = make('skeleton', SKELETON);
  for (const lines of [3, 1, 6]) {
    skeleton.fill = fill('skeleton', { ...SKELETON, lines });
    const [status] = skeleton.shadowRoot.children;
    assert.equal(skeleton.dataset.state, 'loading');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-label'), SKELETON.label);
    assert.equal(status.textContent, '');
    assert.equal(status.children.length, lines);
    for (const line of status.children) {
      assert.equal(line.getAttribute('aria-hidden'), 'true');
      assert.equal(line.getAttribute('part'), 'line');
    }
  }
});

test('a badge shows its text for each tone without a control', () => {
  const badge = make('badge', BADGE);
  for (const tone of ['neutral', 'info', 'success', 'warning', 'danger']) {
    badge.fill = fill('badge', { ...BADGE, tone });
    const [label] = badge.shadowRoot.children;
    assert.equal(badge.dataset.state, 'default');
    assert.equal(label.tag, 'span');
    assert.equal(label.getAttribute('class'), tone);
    assert.equal(label.getAttribute('role'), null);
    assert.equal(label.getAttribute('tabindex'), null);
    assert.deepEqual(label.children, [{ textContent: BADGE.text }]);
  }
});

test('an avatar shows up to two initials and gives the full name to assistive technology', () => {
  const avatar = make('avatar', AVATAR);
  for (const [name, expected] of [
    [AVATAR.name, 'SR'], ['  sample  desk\treader  ', 'SR'], ['sample', 'S'],
    ['e\u0301chantillon 案内', 'É案'], ['𐐷 test', '𐐏T'], ['ß test', 'ßT'], ['123 ...', '?'],
    ['<Sample> #42 Reader', 'SR'],
  ]) {
    avatar.fill = fill('avatar', { name });
    const [initials] = avatar.shadowRoot.children;
    assert.equal(avatar.dataset.state, 'default');
    assert.equal(initials.tag, 'span');
    assert.equal(initials.getAttribute('role'), 'img');
    assert.equal(initials.getAttribute('aria-label'), name);
    assert.equal(initials.getAttribute('src'), null);
    assert.equal(initials.getAttribute('href'), null);
    assert.equal(initials.getAttribute('style'), null);
    assert.deepEqual(initials.children, [{ textContent: expected }]);
  }
});

for (const [name, data, changes] of [
  ['empty-state', EMPTY, [{ title: ' ' }, { text: ['Try again.'] }, { action: 'library.search' }]],
  ['skeleton', SKELETON, [{ label: ' ' }, { lines: 0 }, { lines: 7 }, { lines: 1.5 }, { lines: '3' }]],
  ['badge', BADGE, [{ text: ' ' }, { text: 'x'.repeat(41) }, { tone: 'urgent' }]],
  ['avatar', AVATAR, [{ name: ' ' }, { name: null }, { url: 'https://example.org/sample' }, { image: '/reader.png' }]],
]) {
  test(name + ' exports its tool schema and refuses invalid fills', () => {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    assert.deepEqual(schema.properties.data.required, Object.keys(data));
    assert.equal(schema.properties.data.additionalProperties, false);
    assert.deepEqual(validateFill(fill(name, data)), []);
    if (name === 'skeleton') {
      const { type, minimum, maximum } = schema.properties.data.properties.lines;
      assert.deepEqual([type, minimum, maximum], ['integer', 1, 6]);
    }
    const element = make(name, data);
    const refused = [];
    element.addEventListener('mu-refused', (event) => refused.push(event.detail.errors));
    for (const change of changes) {
      const value = fill(name, { ...data, ...change });
      const errors = validateFill(value);
      assert.ok(errors[0]?.startsWith('data.' + Object.keys(change)[0] + ':'), JSON.stringify(change));
      element.fill = value;
      assert.equal(element.fill, null);
      assert.equal(element.dataset.state, 'refused');
      assert.deepEqual(refused.at(-1), errors);
    }
    assert.equal(refused.length, changes.length);
  });
}
