import assert from 'node:assert/strict';
import { setImmediate as nextTask } from 'node:timers/promises';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the native dialog calls. The browser check sends real keys and reads the focus order.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};
  isConnected = true;

  constructor(tag) { super(); this.tag = tag; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: value }); }
  focus() { document.activeElement = this; }
}

class TestDialog extends TestNode {
  open = false;
  showCount = 0;
  closeCount = 0;
  #previousFocus;

  showModal() {
    this.showCount += 1;
    this.open = true;
    this.#previousFocus = document.activeElement;
    findPart(this, 'close').focus();
  }

  close() {
    if (!this.open) return;
    this.closeCount += 1;
    this.open = false;
    this.#previousFocus?.focus();
    setImmediate(() => this.dispatchEvent(new Event('close')));
  }

  escape() {
    if (this.dispatchEvent(new Event('cancel', { cancelable: true }))) this.close();
  }
}

function findPart(root, name) {
  if (root.getAttribute?.('part') === name) return root;
  return root.children?.map((child) => findPart(child, name)).find(Boolean);
}

const elements = new Map();
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = new TestNode()); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.document = {
  createElement: (tag) => tag === 'dialog' ? new TestDialog(tag) : new TestNode(tag),
  // The kit draws each icon as an SVG element.
  createElementNS: (namespace, tag) => new TestNode(tag),
  createTextNode: (textContent) => ({ textContent }),
};
globalThis.customElements = {
  define: (name, constructor) => elements.set(name, constructor),
  get: (name) => elements.get(name),
};

const { define } = await import('../src/components/index.js');
define();

const DATA = { title: 'Tray <A3>', close_label: 'Close' };
for (const name of ['dialog', 'drawer']) {
  const Element = elements.get('mu-' + name);

  test(name + ' exports a tool schema with two required text fields', () => {
    const schema = toolSchema(name);
    assert.equal(schema.properties.component.const, name);
    assert.deepEqual(schema.properties.data.required, ['title', 'close_label']);
    assert.equal(schema.properties.data.additionalProperties, false);
    assert.deepEqual(Object.values(schema.properties.data.properties).map((field) => field.type), ['string', 'string']);
    assert.deepEqual(validateFill(fill(name, DATA)), []);
  });

  test(name + ' opens and closes once and lets the browser return focus', async () => {
    const modal = new Element();
    const trigger = new TestNode('button');
    const events = [];
    for (const type of ['mu-dialog-open', 'mu-dialog-close']) {
      modal.addEventListener(type, (event) => {
        assert.ok(event.bubbles && event.composed);
        events.push([event.type, document.activeElement]);
      });
    }
    modal.open();
    modal.fill = fill(name, DATA);
    const dialog = modal.shadowRoot.children[0];
    const close = findPart(dialog, 'close');
    const title = findPart(dialog, 'title');
    assert.equal(dialog.tag, 'dialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-labelledby'), title.getAttribute('id'));
    assert.equal(title.textContent, DATA.title);
    assert.equal(close.tag, 'button');
    // Decision 0009, section 3: the close control shows an x. The close label is its name and its tooltip.
    assert.equal(close.getAttribute('aria-label'), DATA.close_label);
    assert.equal(close.getAttribute('data-control-display'), 'icon');
    assert.deepEqual(close.children.map((child) => child.tag), ['svg']);
    assert.equal(findPart(dialog, 'body').children[0].tag, 'slot');
    assert.equal(modal.dataset.state, 'default');
    modal.isConnected = false;
    modal.open();
    assert.equal(dialog.showCount, 0);
    modal.isConnected = true;

    for (const dismiss of [() => modal.close(), () => close.dispatchEvent(new Event('click')), () => dialog.escape()]) {
      trigger.focus();
      modal.open();
      modal.open();
      assert.equal(dialog.open, true);
      assert.equal(modal.dataset.state, 'open');
      assert.equal(document.activeElement, close);
      dismiss();
      modal.close();
      assert.equal(dialog.open, false);
      assert.equal(document.activeElement, trigger);
      await nextTask();
      assert.equal(modal.dataset.state, 'default');
      assert.deepEqual(events.splice(0), [['mu-dialog-open', close], ['mu-dialog-close', trigger]]);
    }
    assert.equal(dialog.showCount, 3);
    assert.equal(dialog.closeCount, 3);
  });

  test(name + ' refuses a nested fill and closes the active modal', async () => {
    const modal = new Element();
    const trigger = new TestNode('button');
    const closeEvents = [];
    const refusals = [];
    modal.addEventListener('mu-dialog-close', (event) => closeEvents.push(event));
    modal.addEventListener('mu-refused', (event) => refusals.push(event.detail.errors));
    modal.fill = fill(name, DATA);
    const dialog = modal.shadowRoot.children[0];
    trigger.focus();
    modal.open();
    modal.fill = fill(name, { ...DATA, body: [fill('button', { label: 'Save' })] });
    modal.open();
    await nextTask();
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, trigger);
    assert.equal(closeEvents.length, 1);
    assert.equal(modal.fill, null);
    assert.equal(modal.dataset.state, 'refused');
    assert.ok(findPart(modal.shadowRoot, 'reason').textContent.includes('did not match'));
    assert.deepEqual(refusals, [['data.body: the contract does not declare this field']]);

    for (const key of ['title', 'close_label']) {
      modal.fill = fill(name, { ...DATA, [key]: '  ' });
      assert.equal(modal.fill, null);
      assert.deepEqual(refusals.at(-1), ['data.' + key + ': give text']);
    }
  });
}
