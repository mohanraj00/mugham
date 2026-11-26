import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, toolSchema, validateFill } from '../src/kit.js';

// Model the render tree. The browser checks cover the slot, keyboard and themes.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};

  constructor(tag) { super(); this.tag = tag; }
  append(...children) {
    for (const child of children) this.insertBefore(child, null);
  }
  insertBefore(child, before) {
    if (child instanceof TestNode) child.parentNode = this;
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index, 0, child);
  }
  remove() {
    const parent = this.parentNode;
    parent.children.splice(parent.children.indexOf(this), 1);
    this.parentNode = null;
  }
  replaceChildren(...children) {
    for (const child of this.children) if (child instanceof TestNode) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }
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
  createTextNode: (textContent) => Object.assign(new TestNode('#text'), { textContent }),
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
  assert.deepEqual(title.children.map((child) => child.textContent), [EMPTY.title]);
  assert.deepEqual(text.children.map((child) => child.textContent), [EMPTY.text]);
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
    assert.deepEqual(label.children.map((child) => child.textContent), [BADGE.text]);
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
    assert.deepEqual(initials.children.map((child) => child.textContent), [expected]);
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

const APPROVAL_TIME = '2026-11-26T10:00:00Z';
const APPROVER = 'Branch reviewer <north>';

function approvedDocument() {
  const actor = { type: 'agent', id: 'newsletter-agent' };
  const rich = new (elements.get('mu-rich-text'))();
  rich.actor = actor;
  const content = [fill('rich-span', { text: 'The branch opens at ten.' })];
  const paragraph = fill('rich-paragraph', { content });
  const blocks = [
    fill('rich-heading', { level: 1, content }),
    fill('rich-list', { items: [paragraph] }),
    fill('rich-code', { text: 'Branch hours' }),
    fill('rich-quote', { paragraphs: [paragraph] }),
    paragraph,
  ];
  rich.fill = { ...fill('rich-text', { blocks }), slots: { authorship: actor } };
  return rich;
}

function approvalMarks(node) {
  if (node.getAttribute?.('part') === 'approval-mark') return [node];
  return (node.children ?? []).flatMap(approvalMarks);
}

test('page code sets the text and accessible name of each approval mark', () => {
  const rich = approvedDocument();
  rich.setApprovals([
    { block: 2, state: 'rejected' },
    { block: 0, state: 'approved', by: APPROVER, at: APPROVAL_TIME },
    { block: 1, state: 'pending', at: '2028-02-29T10:00:00.123Z' },
  ]);
  assert.equal(rich.dataset.state, 'default');
  const [body] = rich.shadowRoot.children;
  const marks = approvalMarks(body);
  const expected = ['Approved', 'Pending approval', 'Rejected'];
  assert.deepEqual(marks.map((mark) => mark.children[0].textContent), expected);
  assert.deepEqual(marks.map((mark) => mark.getAttribute('aria-label')), expected.map((word) => 'Approval: ' + word));
  assert.ok(marks.every((mark) => mark.getAttribute('role') === 'group'));
  assert.equal(marks[0].textContent, 'Approved by ' + APPROVER + ' at ' + APPROVAL_TIME);
  assert.equal(marks[1].textContent, 'Pending approval at 2028-02-29T10:00:00.123Z');
  assert.deepEqual(body.children.slice(-3).map((node) => node.tag), ['blockquote', 'p', 'p']);
  assert.equal(body.children.at(-2).textContent, 'The branch opens at ten.');

  rich.setApprovals([]);
  assert.deepEqual(approvalMarks(rich.shadowRoot), []);
});

test('a rich text fill clears all approval marks until page code sets them again', () => {
  const rich = approvedDocument();
  const approvals = [{ block: 0, state: 'approved' }];
  rich.setApprovals(approvals);
  assert.equal(approvalMarks(rich.shadowRoot).length, 1);

  const next = structuredClone(rich.fill);
  next.data.blocks[0].data.content[0].data.text = 'The branch opens at noon.';
  rich.fill = next;
  assert.deepEqual(approvalMarks(rich.shadowRoot), []);
  assert.equal(rich.shadowRoot.children[0].children[0].textContent, 'The branch opens at noon.');
  rich.setApprovals(approvals);
  assert.equal(approvalMarks(rich.shadowRoot).length, 1);

  rich.fill = rich.fill;
  assert.deepEqual(approvalMarks(rich.shadowRoot), []);
  rich.setApprovals(approvals);
  rich.fill = { ...next, data: { ...next.data, approval: approvals } };
  assert.equal(rich.dataset.state, 'refused');
  assert.deepEqual(approvalMarks(rich.shadowRoot), []);
});

test('rich text refuses an invalid approval list and reports each error with its path', () => {
  const rich = approvedDocument();
  const refused = [];
  const mark = { block: 0, state: 'approved' };
  rich.addEventListener('mu-refused', (event) => {
    assert.equal(event.bubbles, true);
    assert.equal(event.composed, true);
    refused.push(event.detail.errors);
  });
  const atError = 'at: must be an ISO 8601 date and time in UTC';
  const stateError = 'state: must be approved, pending or rejected';
  for (const [changes, errors] of [
    [{ state: 'done' }, [stateError]],
    [{ by: 'x'.repeat(81) }, ['by: more than 80 characters']],
    [{ by: {} }, ['by: must be a string']],
    [{ note: 'Unknown' }, ['note: unknown key']],
    [{ block: 5 }, ['block: must be an index of a top-level block']],
    [{ at: '2026-11-26T10:00:00' }, [atError]],
    [{ at: '2026-11-26T10:00:00+01:00' }, [atError]],
    [{ at: '2026-11-26T10:00:00.1234Z' }, [atError]],
    [{ at: '2026-02-30T10:00:00Z' }, [atError]],
    [{ at: '2026-11-26T10:00:00Z\n' }, [atError]],
    [{ state: 'done', at: '2026-02-30T10:00:00Z' }, [stateError, atError]],
    [{ block: 1 }, ['block: must be unique']],
  ]) {
    rich.setApprovals([mark]);
    assert.equal(approvalMarks(rich.shadowRoot).length, 1);
    assert.doesNotThrow(() => rich.setApprovals([{ block: 1, state: 'pending' }, { ...mark, ...changes }]));
    assert.deepEqual(approvalMarks(rich.shadowRoot), []);
    assert.equal(rich.dataset.state, 'default');
    assert.deepEqual(refused.shift(), errors.map((error) => 'approvals[1].' + error));
    assert.deepEqual(refused, []);
  }

  rich.setApprovals(null);
  rich.setApprovals([null]);
  assert.deepEqual(refused, [['approvals: must be a list'], ['approvals[0]: must be an object']]);
});
