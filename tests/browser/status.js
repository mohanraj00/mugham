// Expected labels, border styles and text limits come from catalog/status.json.
import { MuStatus } from '../../src/components/status.js';
import { define } from '../../src/thread/index.js';
import { CATALOG } from '../../src/render/catalog.js';

define();

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const AUTHOR = { type: 'agent', id: 'agent-check', name: 'Checker' };
const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const STATES = [
  ['pending', 'Pending', 'dashed', 'Synthetic check A.'],
  ['passed', 'Passed', 'solid', 'Synthetic check B.'],
  ['failed', 'Failed', 'double', 'Synthetic check C.'],
  ['unknown', 'Unknown', 'dotted', 'Synthetic check D.'],
];
const fill = (state, text) => ({ component: 'status', version: '0.1.0', data: { state, text }, slots: { authorship: AUTHOR } });
const stage = document.getElementById('stage');
function mount(state, text) {
  const node = new MuStatus();
  node.actor = AUTHOR;
  stage.append(node);
  node.fill = fill(state, text);
  return node;
}

const probe = document.createElement('span');
stage.append(probe);
const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
for (const [state, label, border, text] of STATES) {
  const node = mount(state, text);
  const group = node.shadowRoot.querySelector('[role="group"]');
  const badge = node.shadowRoot.querySelector('[part="label"]');
  const style = badge && getComputedStyle(badge);
  check(`${state}: the fill is valid`, node.dataset.state === 'default' && node.fill !== null, node.shadowRoot.textContent);
  check(`${state}: the group has the short text as its name`, group?.getAttribute('aria-label') === text);
  check(`${state}: the state has its fixed text label`, badge?.textContent === label);
  check(`${state}: the short text shows as text`, node.shadowRoot.querySelector('[part="text"]')?.textContent === text);
  check(`${state}: the label has its border style and strong weight`, style?.borderTopStyle === border
    && parseFloat(style.borderTopWidth) >= 3 && Number(style.fontWeight) >= 600, style && `${style.borderTopStyle} ${style.borderTopWidth} ${style.fontWeight}`);
  check(`${state}: the author shows as text`, node.shadowRoot.querySelector('[part="authorship"]')?.textContent === 'Author: agent agent-check (Checker)');
  check(`${state}: the status has no keyboard control`, !node.shadowRoot.querySelector('button, input, a, [tabindex]'));
  check(`${state}: the status has no action`, typeof node.receipt === 'undefined' && typeof node.action === 'undefined');
  if (mode === 'forced-colors') {
    check(`${state}: forced colors keeps the label and border style`, badge?.textContent === label && style?.borderTopStyle === border);
    check(`${state}: forced colors uses CanvasText and Canvas`, style?.color === resolved('CanvasText')
      && style?.borderTopColor === resolved('CanvasText') && style?.backgroundColor === resolved('Canvas'), style && `${style.color} ${style.borderTopColor} ${style.backgroundColor}`);
  }
  if (mode === 'reduced-motion') {
    check(`${state}: reduced motion has no animation or transition`, style?.animationName === 'none' && style?.transitionDuration === '0s');
  }
  const marked = mount(state, MARKUP);
  check(`${state}: markup is text and makes no element`, marked.shadowRoot.querySelector('[part="text"]')?.textContent === MARKUP
    && marked.shadowRoot.querySelector('[role="group"]')?.getAttribute('aria-label') === MARKUP
    && !marked.shadowRoot.querySelector('img, script, a') && window.muUnsafe === undefined);
}

// A bad value replaces a valid fill with a visible refusal. It is not the valid state unknown.
const refused = mount('passed', 'Synthetic check E.');
const errors = [];
refused.addEventListener('mu-refused', (event) => errors.push(...event.detail.errors));
refused.fill = fill('complete', 'Synthetic check E.');
check('an undeclared state is refused and its reason shows', refused.dataset.state === 'refused' && refused.fill === null
  && errors.join('|') === 'data.state: must be one of pending, passed, failed, unknown'
  && refused.shadowRoot.querySelector('[role="status"]')?.textContent === 'Refused status: data.state: must be one of pending, passed, failed, unknown'
  && !refused.shadowRoot.querySelector('[part="label"]'), refused.shadowRoot.textContent);
if (mode === 'forced-colors') {
  check('forced colors keeps the refusal visible', getComputedStyle(refused.shadowRoot.querySelector('[role="status"]')).color === resolved('CanvasText'));
}
refused.fill = fill('unknown', 'Synthetic check E.');
check('the declared state unknown is valid after a refusal', refused.dataset.state === 'default'
  && refused.shadowRoot.querySelector('[part="label"]')?.textContent === 'Unknown');
const unbound = document.createElement('mu-status');
stage.append(unbound);
unbound.fill = fill('passed', 'Synthetic check F.');
check('an author with no bound actor is refused', unbound.dataset.state === 'refused');
const spoof = mount('pending', 'Synthetic check G.');
spoof.fill = { ...fill('passed', 'Synthetic check G.'), slots: { authorship: { type: 'human', id: 'person-check' } } };
check('a different author is refused', spoof.dataset.state === 'refused');
const sheets = MuStatus.styles;
const css = sheets.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ');
const declared = new Set(CATALOG.status.tokens.map((token) => '--mu-' + token.replaceAll('.', '-')));
const extra = [...new Set(css.match(/--mu-[a-z0-9-]+/g) ?? [])].filter((token) => !declared.has(token));
check('the styles use only declared tokens', extra.length === 0, extra.join(' '));
check('the styles have a forced colors rule', css.includes('forced-colors'));

// A thread shows each status as its element and binds the actor of its envelope.
const thread = document.createElement('mu-thread');
stage.append(thread);
for (const [state, , , text] of STATES) {
  thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: state, activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill(state, text) } });
}
await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
const parts = [...thread.shadowRoot.querySelectorAll('mu-status')];
check('the thread shows each status part', parts.length === 4, parts.length);
for (const [index, [state, label]] of STATES.entries()) {
  check(`thread ${state}: the label and author show`, parts[index]?.dataset.state === 'default'
    && parts[index].shadowRoot.querySelector('[part="label"]')?.textContent === label
    && parts[index].shadowRoot.textContent.includes('Author: agent agent-check (Checker)'));
}

// The status has no keyboard action. The shared runner checks this button.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
window.muPresses = () => presses;
window.muChecks = { mode, results };
