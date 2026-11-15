// Expected results come from catalog/chart.json and catalog/chart-series.json.
import { define, MuChart, MuTable } from '../../src/components/index.js';
import { define as defineThread } from '../../src/thread/index.js';

define();
defineThread();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const AUTHOR = { type: 'agent', id: 'agent-check' };
const series = (label, values) => ({ component: 'chart-series', version: '0.1.0', data: { label, values } });
const DATA = { title: 'Weekly tickets', type: 'bar', units: 'tickets', x_label: 'Week', y_label: 'Count',
  categories: ['Week 1', 'Week 2', 'Week 3'], series: [series('Received', [12, 8, 0]), series('Closed', [4, -2, 6])] };
const fill = (data) => ({ component: 'chart', version: '0.1.0', data, slots: { authorship: AUTHOR } });
function mount(data = DATA) {
  const node = document.createElement('mu-chart');
  node.actor = AUTHOR;
  document.getElementById('stage').append(node);
  node.fill = fill(data);
  return node;
}
const points = (root) => [...root.querySelectorAll('[part="point"]')];
const numeric = ['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'width', 'height'];
const finite = (root) => [...root.querySelectorAll('svg *')].every((node) => numeric.every((name) =>
  !node.hasAttribute(name) || Number.isFinite(Number(node.getAttribute(name)))));
for (const type of ['bar', 'line', 'stacked_bar']) {
  const node = mount({ ...DATA, type });
  const root = node.shadowRoot;
  check(`${type}: exported chart class and named group`, node instanceof MuChart && node.dataset.state === 'default'
    && root.querySelector('[role="group"]').getAttribute('aria-labelledby') === 'chart-title'
    && root.querySelector('#chart-title').textContent === DATA.title);
  check(`${type}: SVG points and finite geometry`, root.querySelector('svg')?.namespaceURI === 'http://www.w3.org/2000/svg'
    && points(root).length === 6 && finite(root));
  check(`${type}: native text title, axis labels, units and series labels`, root.querySelector('h3').textContent === DATA.title
    && root.textContent.includes('Count (tickets)') && root.textContent.includes('Week')
    && root.textContent.includes('1. Received') && root.textContent.includes('2. Closed'));
  check(`${type}: points have text values and names`, points(root).every((point) => point.querySelector('text')
    && point.querySelector('title').textContent.includes('tickets')));
  check(`${type}: line segments or bars`, type === 'line' ? root.querySelectorAll('[part="segment"]').length === 4
    : root.querySelectorAll('[part="bar"]').length === 6);
  check(`${type}: one point in Tab order`, points(root).filter((p) => p.getAttribute('tabindex') === '0').length === 1);
  const first = points(root)[0];
  first.focus();
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  check(`${type}: left wraps to last point and shows its full value`, root.activeElement === points(root)[5]
    && root.querySelector('[part="value"]').textContent === 'Closed, Week 3: 6 tickets');
  points(root)[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  check(`${type}: down wraps to first point`, root.activeElement === first);
  const table = root.querySelector('mu-table');
  const before = JSON.stringify(node.fill);
  check(`${type}: table starts hidden and uses MuTable with the same actor`, table instanceof MuTable && table.hidden
    && table.actor.id === AUTHOR.id && table.dataset.state === 'default');
  root.querySelector('button').click();
  check(`${type}: toggle exposes a screen reader table`, !table.hidden && root.querySelector('button').getAttribute('aria-expanded') === 'true'
    && table.shadowRoot.querySelector('caption').textContent === DATA.title
    && JSON.stringify(table.fill.data.columns) === JSON.stringify(['Week', 'Received', 'Closed'])
    && JSON.stringify(table.fill.data.rows.map((row) => row.data.cells)) === JSON.stringify([
      ['Week 1', '12 tickets', '4 tickets'], ['Week 2', '8 tickets', '-2 tickets'], ['Week 3', '0 tickets', '6 tickets']]));
  root.querySelector('button').click();
  check(`${type}: toggle closes the table without changing the fill`, table.hidden && JSON.stringify(node.fill) === before);
  root.querySelector('button').click();
  node.fill = fill({ ...DATA, type });
  check(`${type}: new fill resets focus order and table`, node.shadowRoot.querySelector('mu-table').hidden
    && points(node.shadowRoot)[0].getAttribute('tabindex') === '0');

  const bars = [...root.querySelectorAll('[part="bar"]')];
  if (type === 'stacked_bar') check('stacked_bar: positive values stack and negative values have a separate base',
    Math.abs(Number(bars[3].getAttribute('y')) + Number(bars[3].getAttribute('height')) - Number(bars[0].getAttribute('y'))) < 0.001
    && Number(bars[4].getAttribute('y')) > Number(bars[1].getAttribute('y')));
}

for (const [change, reason] of [
  [{ categories: [] }, 'data.categories: at least one category is required'],
  [{ series: [] }, 'data.series: at least one series is required'],
  [{ series: [series('Received', [1])] }, 'data.series[0].data.values: the value count must equal the category count'],
  [{ series: [series('Received', Array(51).fill(1))] }, 'more than 50 items'],
  [{ categories: Array(51).fill('Week') }, 'more than 50 items'],
  [{ series: Array(7).fill(series('Received', [1, 2, 3])) }, 'more than 6 items'],
  [{ type: 'pie' }, 'must be one of bar, line, stacked_bar'],
  [{ html: '<b>x</b>' }, 'the contract does not declare this field'],
  ...['1', true, null, NaN, Infinity, -Infinity].map((value) => [{ series: [series('Received', [value, 1, 2])] }, 'must be a number']),
]) {
  const node = mount({ ...DATA, ...change });
  check(`chart refuses ${reason}`, node.dataset.state === 'refused' && node.fill === null
    && node.shadowRoot.querySelector('[role="status"]').textContent.includes(reason)
    && !node.shadowRoot.querySelector('svg, mu-table'));
}
for (const values of [[0, 0, 0], [-8, -4, -1], [-1e12, 1e12, 0], [Number.MIN_VALUE, 0, -Number.MIN_VALUE]]) {
  for (const type of ['bar', 'line', 'stacked_bar']) {
    const node = mount({ ...DATA, type, series: Array(6).fill(series('Count', values)) });
    check(`${type}: zero, negative, extreme and small values have finite geometry`, node.dataset.state === 'default' && finite(node.shadowRoot));
  }
}
const unbound = document.createElement('mu-chart');
unbound.fill = fill(DATA);
check('chart refuses an unbound author', unbound.dataset.state === 'refused');
const spoof = mount();
spoof.fill = { ...fill(DATA), slots: { authorship: { type: 'human', id: 'person-check' } } };
check('chart refuses a different author', spoof.dataset.state === 'refused');
const maximum = mount({ title: 'x'.repeat(120), type: 'stacked_bar', units: 'u'.repeat(40),
  x_label: 'x'.repeat(80), y_label: 'y'.repeat(80), categories: Array(50).fill('c'.repeat(80)),
  series: Array(6).fill(series('s'.repeat(80), Array(50).fill(1e12))) });
check('chart: maximum lists and text lengths also fit the table contract', maximum.dataset.state === 'default'
  && points(maximum.shadowRoot).length === 300 && finite(maximum.shadowRoot)
  && maximum.shadowRoot.querySelector('mu-table').dataset.state === 'default');

// Each label has markup, including the author name. No string makes an element.
const MARKUP = '<img src=x onerror="muUnsafe=1">';
for (const type of ['bar', 'line', 'stacked_bar']) {
  const data = { title: MARKUP, type, units: MARKUP, x_label: MARKUP, y_label: MARKUP,
    categories: [MARKUP], series: [series(MARKUP, [1])] };
  const node = mount(data);
  node.actor = { ...AUTHOR, name: MARKUP };
  node.fill = { ...fill(data), slots: { authorship: { ...AUTHOR, name: MARKUP } } };
  const root = node.shadowRoot;
  root.querySelector('button').click();
  const tableRoot = root.querySelector('mu-table').shadowRoot;
  check(`${type}: markup in every label stays text in chart and table`, !root.querySelector('img, script')
    && !tableRoot.querySelector('img, script') && window.muUnsafe === undefined
    && root.querySelector('h3').textContent === MARKUP && root.querySelector('[part="value"]').textContent.includes(MARKUP)
    && root.querySelector('mu-table').fill.data.columns.every((text) => text.includes(MARKUP))
    && tableRoot.querySelector('tbody td').textContent === MARKUP);
}
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const media = mount();
const root = media.shadowRoot;
const style = getComputedStyle(root.querySelector('[part="bar"]'));
check('chart: bar boundaries stay visible', style.stroke !== 'none' && parseFloat(style.strokeWidth) >= 1);
check('chart: SVG text and shapes use the theme text token', style.stroke === getComputedStyle(root.querySelector('figure')).color
  && getComputedStyle(root.querySelector('svg text')).fill === style.stroke);
check('chart: each series has a different line pattern', new Set([...root.querySelectorAll('[part="bar"]')]
  .map((bar) => getComputedStyle(bar).strokeDasharray)).size === 2);
if (mode === 'forced-colors') {
  const probe = document.createElement('span');
  probe.style.color = 'CanvasText';
  root.append(probe);
  check('chart: forced colors use CanvasText', style.stroke === getComputedStyle(probe).color);
}
if (mode === 'reduced-motion') check('chart: reduced motion has no transition', parseFloat(style.transitionDuration) === 0);
const thread = document.createElement('mu-thread');
document.getElementById('stage').append(thread);
thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'chart-1', activityType: 'mugham.fill',
  metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill(DATA) } });
await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
const nested = thread.shadowRoot.querySelector('mu-chart');
check('chart: the thread gives the envelope actor to the chart and its table', nested?.dataset.state === 'default'
  && nested.actor.id === AUTHOR.id && nested.shadowRoot.querySelector('mu-table').actor.id === AUTHOR.id);

// These checks moved the focus. Move the start point of Tab before the keyboard targets.
const top = document.createElement('span');
top.tabIndex = -1;
document.getElementById('keyboard').before(top);
top.focus();
top.blur();
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
const keys = mount();
keyboard.append(keys);
// Keep one table open for the accessibility tree check.
media.shadowRoot.querySelector('button').click();
window.muPresses = () => presses;
window.muChartKeys = () => ({ point: points(keys.shadowRoot).indexOf(keys.shadowRoot.activeElement),
  table: !keys.shadowRoot.querySelector('mu-table').hidden });
window.muChecks = { mode, results };
