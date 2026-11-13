// In-page checks of the registration of an application contract and element. tools/browser_check.mjs loads
// this page in each media mode and reads window.muChecks. Each expected result comes from issue #27 and
// catalog/README.md#application-contracts: the catalog does not change, an undeclared component stays
// refused, a registered component gets only a fill that its contract accepts, and a text value stays text.
import { MuElement, define, register } from '../../src/components/index.js';
import { define as defineThread } from '../../src/thread/index.js';
import { CATALOG } from '../../src/render/catalog.js';
import { CONTRACTS } from '../../src/render/registry.js';
import { el } from '../../src/render/dom.js';

define();
defineThread();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const stage = document.getElementById('stage');
const settle = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
const AGENT = { type: 'agent', id: 'a-garden', name: 'Garden agent' };
const CONTRACT = {
  format: 2, name: 'plot-note', version: '0.1.0', kind: 'component', description: 'A note about one garden plot.',
  ai_content: true, slots: { authorship: { required: true } },
  data: {
    title: { type: 'text', label: 'Title', required: true, max_length: 80 },
    rows: { type: 'integer', label: 'Rows', required: true, minimum: 1, maximum: 12 },
    body: { type: 'text', label: 'Body', required: false, max_length: 200 },
  },
  states: ['default', 'refused'], tokens: ['color.text', 'type.body'],
  accessibility: { role: 'article', name: { field: 'title' }, keyboard: [], forced_colors: true, reduced_motion: true },
};
const note = (data) => ({ component: 'plot-note', version: '0.1.0', data, slots: { authorship: AGENT } });
const throws = (call) => {
  try {
    call();
  } catch (error) {
    return `${error.name}: ${error.message}`;
  }
  return '';
};

class PlotNote extends MuElement {
  static component = 'plot-note';

  render(data) {
    return [el('article', { 'aria-label': data.title }, el('p', {}, data.title), el('p', {}, `Rows: ${data.rows}`),
      data.body ? el('p', { part: 'body' }, data.body) : null)];
  }
}

function mount(fill) {
  const node = document.createElement('mu-app-plot-note');
  node.actor = AGENT;
  stage.append(node);
  node.fill = fill;
  return node;
}

async function run() {
  const catalogNames = Object.keys(CATALOG).join(',');
  // A registration with an error changes nothing.
  check('no contract: fails with a clear error', throws(() => register(undefined, PlotNote)) === 'TypeError: register: a contract is necessary',
    throws(() => register(undefined, PlotNote)));
  const invalid = throws(() => register({ ...CONTRACT, states: ['empty'] }, PlotNote));
  check('an invalid contract: fails with the error of the validator',
    invalid === 'TypeError: register: the contract plot-note is not valid: states: must include default', invalid);
  check('an invalid contract: the registry does not have it', CONTRACTS['plot-note'] === undefined);
  const catalogName = throws(() => register({ ...structuredClone(CATALOG.card) }, PlotNote));
  check('a catalog name: fails with a clear error', catalogName === 'TypeError: register: card is the name of a catalog contract', catalogName);
  const plain = throws(() => register(CONTRACT, class extends HTMLElement {}));
  check('an element that does not extend MuElement: fails',
    plain === 'TypeError: register: the element of plot-note must be a class that extends MuElement', plain);
  const replaced = throws(() => register(CONTRACT, class extends PlotNote { set fill(value) { this.value = value; } }));
  check('an element that replaces fill: fails', replaced === 'TypeError: register: the element of plot-note must not replace fill', replaced);
  const other = throws(() => register(CONTRACT, class extends MuElement { static component = 'card'; }));
  check('an element of a different component: fails',
    other === 'TypeError: register: the element of plot-note must have the static component plot-note', other);
  check('a failed registration defines no element', customElements.get('mu-app-plot-note') === undefined);

  // A valid registration.
  const contract = structuredClone(CONTRACT);
  const tag = register(contract, PlotNote);
  check('a valid registration gives the element name', tag === 'mu-app-plot-note' && customElements.get(tag) === PlotNote, tag);
  check('the catalog does not change', Object.isFrozen(CATALOG) && Object.keys(CATALOG).join(',') === catalogNames
    && !Object.hasOwn(CATALOG, 'plot-note'), Object.keys(CATALOG));
  check('the registry has the contract', Object.hasOwn(CONTRACTS, 'plot-note') && Object.isFrozen(CONTRACTS['plot-note'].data.rows));
  contract.data.rows.maximum = 500;
  check('a later change to the contract object has no effect', CONTRACTS['plot-note'].data.rows.maximum === 12);
  const again = throws(() => register(CONTRACT, class extends PlotNote {}));
  check('a duplicate name: fails with a clear error', again === 'TypeError: register: plot-note is already registered', again);
  check('a script cannot write the registry', throws(() => { CONTRACTS['plot-note'] = CATALOG.card; }).startsWith('TypeError')
    && CONTRACTS['plot-note'].name === 'plot-note');

  // The fills of a registered component.
  const node = mount(note({ title: 'Plot 4', rows: 6 }));
  check('a valid fill: renders', node.dataset.state === 'default' && node.shadowRoot.textContent.includes('Rows: 6'), node.shadowRoot.textContent);
  node.fill = note({ title: 'Plot 4', rows: 40 });
  check('an invalid fill: refused', node.dataset.state === 'refused' && node.fill === null
    && node.shadowRoot.textContent.includes('data.rows: more than the maximum 12'), node.shadowRoot.textContent);
  node.fill = note({ title: 'Plot 4', rows: 6, script: 'x' });
  check('an undeclared field: refused', node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes('data.script: the contract does not declare this field'), node.shadowRoot.textContent);
  node.fill = { component: 'plot-note', version: '0.1.0', data: { title: 'Plot 4', rows: 6 } };
  check('a fill with no authorship: refused', node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes('slots.authorship: a required slot is missing'), node.shadowRoot.textContent);
  node.fill = { component: 'banner', version: '0.1.0', data: {} };
  check('an undeclared component: refused', node.dataset.state === 'refused', node.shadowRoot.textContent);
  node.fill = note({ title: 'Plot 4', rows: 6, body: MARKUP.slice(0, 200) });
  const body = node.shadowRoot.querySelector('[part="body"]');
  check('a markup string in a text field: shows as text', node.dataset.state === 'default' && body?.textContent === MARKUP.slice(0, 200)
    && body.children.length === 0 && !node.shadowRoot.querySelector('img, script'), body?.innerHTML);
  node.fill = note({ title: 'Plot 4', rows: 6 });

  // The thread reads the registry for a registered part. An undeclared component stays refused.
  const thread = document.createElement('mu-thread');
  stage.append(thread);
  const metadata = { mugham: { actor: AGENT } };
  const snapshot = (messageId, fill) => ({ type: 'ACTIVITY_SNAPSHOT', messageId, activityType: 'mugham.fill', metadata, content: { format: 2, fill } });
  thread.push({ type: 'RUN_STARTED', threadId: 't1', runId: 'r1' });
  thread.push(snapshot('p1', note({ title: 'Plot 7', rows: 3, body: MARKUP.slice(0, 120) })));
  thread.push(snapshot('p2', note({ title: 'Plot 8', rows: 99 })));
  thread.push(snapshot('p3', { component: 'banner', version: '0.1.0', data: { text: 'Sale' } }));
  thread.push({ type: 'RUN_FINISHED', threadId: 't1', runId: 'r1' });
  await settle();
  const messages = [...thread.shadowRoot.querySelectorAll('li.message')];
  const shown = messages[0]?.querySelector('mu-app-plot-note');
  check('thread: a registered part shows in its element', shown?.dataset.state === 'default'
    && shown.shadowRoot.textContent.includes('Plot 7') && shown.actor?.id === AGENT.id, messages[0]?.textContent);
  check('thread: a markup string stays text', shown?.shadowRoot.querySelector('[part="body"]')?.textContent === MARKUP.slice(0, 120)
    && !shown?.shadowRoot.querySelector('img, script'));
  check('thread: an invalid registered fill is refused', messages[1]?.querySelector('.refusal')?.textContent.includes('data.rows: more than the maximum 12')
    && !messages[1]?.querySelector('mu-app-plot-note'), messages[1]?.textContent);
  check('thread: an undeclared component is refused', messages[2]?.querySelector('.refusal')?.textContent.includes('component: no contract has the name banner'),
    messages[2]?.textContent);
  check('no markup ran', window.muUnsafe === undefined);
  return new URLSearchParams(location.search).get('mode') || 'light';
}

// The keyboard part of the check: the runner sends real key events to this target.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
window.muPresses = () => presses;

run().then((mode) => { window.muChecks = { mode, results }; }, (error) => {
  check('the checks ran with no error', false, error && error.stack);
  window.muChecks = { mode: 'error', results };
});
