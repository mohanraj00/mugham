// Expected results come from catalog/table.json, catalog/table-row.json and docs/table.md.
import { define, MuTable } from '../../src/components/index.js';
import { define as defineThread } from '../../src/thread/index.js';

define();
defineThread();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const AUTHOR = { type: 'agent', id: 'agent-check' };
const row = (cells, status) => ({ component: 'table-row', version: '0.1.0',
  data: { cells, ...(status === undefined ? {} : { status }) } });
const DATA = { label: 'Sample rows', columns: ['Name', 'Area'],
  rows: [row(['Plot B', 'West'], 'Waiting'), row(['Plot A', 'North'], 'Ready'), row(['Plot A', 'East'])],
  status_values: ['Ready', 'Waiting'] };
const fill = (data) => ({ component: 'table', version: '0.1.0', data, slots: { authorship: AUTHOR } });
function mount(data = DATA) {
  const node = document.createElement('mu-table');
  node.actor = AUTHOR;
  document.getElementById('stage').append(node);
  node.fill = fill(data);
  return node;
}
const cells = (node) => [...node.shadowRoot.querySelectorAll('tbody tr')].map((tr) => [...tr.cells].map((td) => td.textContent));
const node = mount();
const root = node.shadowRoot;
check('table: the exported class creates the registered element', node instanceof MuTable);
check('table: native table sections and column headers', root.querySelectorAll('table > thead > tr > th[scope="col"]').length === 3
  && root.querySelectorAll('table > tbody > tr > td').length === 9 && root.querySelector('caption').textContent === DATA.label);
check('table: the group has its contract name', root.querySelector('[role="group"]').getAttribute('aria-label') === DATA.label);
check('table: default rows keep input order and include optional status text', node.dataset.state === 'default'
  && JSON.stringify(cells(node)) === JSON.stringify([['Plot B', 'West', 'Waiting'], ['Plot A', 'North', 'Ready'], ['Plot A', 'East', '']]));
check('table: author text shows', root.querySelector('[part="authorship"]').textContent === 'Author: agent agent-check');
const button = root.querySelector('th button');
const beforeSort = JSON.stringify(node.fill);
button.focus();
button.click();
check('table: ascending sort is stable and keeps focus', cells(node).map((r) => r[1]).join('|') === 'North|East|West'
  && root.activeElement === button && root.querySelector('th').getAttribute('aria-sort') === 'ascending');
button.click();
check('table: descending sort is stable and keeps row status with its cells', cells(node).map((r) => r[1]).join('|') === 'West|North|East'
  && cells(node)[0][2] === 'Waiting' && root.querySelector('th').getAttribute('aria-sort') === 'descending');
root.querySelectorAll('th button')[1].click();
check('table: a different key starts ascending and clears the old aria-sort', cells(node)[0][1] === 'East'
  && root.querySelectorAll('th[aria-sort]').length === 1 && root.querySelectorAll('th')[1].getAttribute('aria-sort') === 'ascending');
check('table: sorting does not change fill data', JSON.stringify(node.fill) === beforeSort);
node.fill = fill(DATA);
check('table: a new fill resets the sort', cells(node)[0][0] === 'Plot B' && !root.querySelector('[aria-sort]'));
for (const direction of ['ascending', 'descending']) {
  const sorted = mount({ ...DATA, sort_key: 0, sort_direction: direction });
  check(`table: initial ${direction} sort`, cells(sorted)[0][0] === (direction === 'ascending' ? 'Plot A' : 'Plot B')
    && sorted.shadowRoot.querySelector('th').getAttribute('aria-sort') === direction);
}
check('table: sort direction defaults to ascending', cells(mount({ ...DATA, sort_key: 0 }))[0][0] === 'Plot A');
const empty = mount({ ...DATA, rows: [] });
check('table: empty state retains the name, headers and author', empty.dataset.state === 'empty'
  && empty.shadowRoot.querySelector('[part="empty"]').textContent === 'No rows.'
  && empty.shadowRoot.querySelector('caption').textContent === DATA.label
  && empty.shadowRoot.querySelectorAll('th[scope="col"]').length === 3
  && empty.shadowRoot.querySelector('tbody').children.length === 0
  && empty.shadowRoot.querySelector('[part="authorship"]'));
empty.shadowRoot.querySelector('button').click();
check('table: sorting an empty table keeps its empty state', empty.dataset.state === 'empty');
const plain = mount({ label: 'Plain rows', columns: ['Name'], rows: [row([''])] });
check('table: no status values gives no status column and blank cells stay blank', plain.shadowRoot.querySelectorAll('th').length === 1
  && cells(plain)[0][0] === '');

// The element checks rules that the contract format cannot express.
for (const [data, reason] of [
  [{ ...DATA, columns: [] }, 'data.columns: at least one column is required'],
  [{ ...DATA, rows: [row(['Only one'])] }, 'data.rows[0].data.cells: the cell count must equal the column count'],
  [{ ...DATA, rows: [row([])] }, 'data.rows[0].data.cells: the cell count must equal the column count'],
  [{ ...DATA, rows: [row(['A', 'B', 'C'])] }, 'data.rows[0].data.cells: the cell count must equal the column count'],
  [{ ...DATA, sort_key: 2 }, 'data.sort_key: the column does not exist'],
  [{ ...DATA, sort_direction: 'ascending' }, 'data.sort_direction: a sort key is required'],
  [{ ...DATA, rows: [row(['A', 'B'], 'Unknown')] }, 'data.rows[0].data.status: the status is not in status_values'],
  [{ ...DATA, status_values: [] }, 'data.rows[0].data.status: the status is not in status_values'],
  [{ ...DATA, html: '<b>x</b>' }, 'data.html: the contract does not declare this field'],
]) {
  const refused = mount(data);
  check(`table: refuses ${reason}`, refused.dataset.state === 'refused' && refused.fill === null
    && refused.shadowRoot.querySelector('[role="status"]').textContent.includes(reason)
    && !refused.shadowRoot.querySelector('table'));
}
const unbound = document.createElement('mu-table');
unbound.fill = fill(DATA);
check('table: an unbound author is refused', unbound.dataset.state === 'refused');
const spoof = mount();
spoof.fill = { ...fill(DATA), slots: { authorship: { type: 'human', id: 'person-check' } } };
check('table: a different author is refused', spoof.dataset.state === 'refused');

// Every header, cell and status contains markup. None of the strings makes an element, even after sorting.
const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const unsafe = mount({ label: MARKUP, columns: [MARKUP, MARKUP],
  rows: [row([MARKUP, MARKUP], MARKUP), row([MARKUP, MARKUP], MARKUP)], status_values: [MARKUP] });
for (const sorted of [false, true]) {
  if (sorted) unsafe.shadowRoot.querySelector('button').click();
  check(`table: markup stays text in every cell and header, sorted=${sorted}`, unsafe.dataset.state === 'default'
    && !unsafe.shadowRoot.querySelector('img, script')
    && [...unsafe.shadowRoot.querySelectorAll('td')].every((td) => td.textContent === MARKUP && td.childElementCount === 0)
    && [...unsafe.shadowRoot.querySelectorAll('th button')].every((b) => b.textContent === MARKUP && b.childElementCount === 0)
    && unsafe.shadowRoot.querySelector('caption').textContent === MARKUP && window.muUnsafe === undefined);
}

// Media checks use all four modes of the browser runner.
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const style = getComputedStyle(root.querySelector('td'));
check('table: cell boundaries stay visible', style.borderBottomStyle === 'solid' && parseFloat(style.borderBottomWidth) >= 1);
if (mode === 'forced-colors') {
  const probe = document.createElement('span');
  probe.style.color = 'CanvasText';
  root.append(probe);
  check('table: forced colors use CanvasText', style.color === getComputedStyle(probe).color);
}
if (mode === 'reduced-motion') check('table: reduced motion has no transition', parseFloat(style.transitionDuration) === 0);

// A table part uses the actor of its envelope.
const thread = document.createElement('mu-thread');
document.getElementById('stage').append(thread);
thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 't1', activityType: 'mugham.fill',
  metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill(DATA) } });
await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
const nested = thread.shadowRoot.querySelector('mu-table');
check('table: a thread shows the table with the envelope actor', nested?.dataset.state === 'default'
  && nested.actor.id === AUTHOR.id && nested.shadowRoot.querySelector('table'));

// These checks moved the focus. Move the start point of Tab to the top of the page, before the keyboard targets.
const top = document.createElement('span');
top.tabIndex = -1;
document.getElementById('keyboard').before(top);
top.focus();
top.blur();

// The runner sends real Tab, Enter and Space keys to these targets.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
const keys = mount();
keyboard.append(keys);
window.muPresses = () => presses;
window.muFocusTable = () => { keys.shadowRoot.querySelector('button').focus(); return true; };
window.muTableSort = () => ({ sort: keys.shadowRoot.querySelector('th').getAttribute('aria-sort'),
  first: cells(keys)[0][0], focused: keys.shadowRoot.activeElement?.textContent });
window.muChecks = { mode, results };
