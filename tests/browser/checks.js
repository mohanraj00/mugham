// In-page checks of the primitives. tools/browser_check.mjs loads this page in each media mode
// and reads window.muChecks. Each expected result comes from the contracts in catalog/.
import { define } from '../../src/primitives/index.js';
import { CATALOG } from '../../src/render/catalog.js';

define();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const fill = (component, data) => ({ component, version: '0.1.0', data });
const VALID = {
  text: { text: 'Weather at sea' },
  button: { label: 'Renew' },
  field: { label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.', error: 'Give a code.' },
  stack: { label: 'Loan details' },
  grid: { label: 'Reading list' },
};
const TAGS = { text: 'mu-text', button: 'mu-button', field: 'mu-field', stack: 'mu-stack', grid: 'mu-grid' };
const media = (query) => matchMedia(query).matches;
const stage = document.getElementById('stage');

function mount(name, data) {
  const node = document.createElement(TAGS[name]);
  stage.append(node);
  node.fill = fill(name, data);
  return node;
}

// Each primitive renders a valid fill and refuses an invalid fill.
for (const name of Object.keys(TAGS)) {
  const node = mount(name, VALID[name]);
  check(`${name}: renders a valid fill`, node.dataset.state !== 'refused' && node.fill !== null, node.dataset.state);
  node.fill = fill(name, { ...VALID[name], script: 'x' });
  check(`${name}: refuses an undeclared field`, node.dataset.state === 'refused' && node.fill === null
    && node.shadowRoot.textContent.includes('data.script: the contract does not declare this field'), node.shadowRoot.textContent);
  node.fill = fill('banner', {});
  check(`${name}: refuses an undeclared component`, node.dataset.state === 'refused', node.dataset.state);
  node.fill = fill(name === 'text' ? 'button' : 'text', name === 'text' ? VALID.button : VALID.text);
  check(`${name}: refuses a fill of a different component`, node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes(`component: must be ${name}`), node.shadowRoot.textContent);
  node.fill = fill(name === 'text' ? 'button' : 'text', { label: 7, text: 7 });
  check(`${name}: names the component first for a bad fill of a different component`,
    node.shadowRoot.textContent.includes(`component: must be ${name}`), node.shadowRoot.textContent);
}

// Markup in each text field shows as text and makes no element.
for (const [name, contract] of Object.entries(CATALOG)) {
  for (const [key, field] of Object.entries(contract.data)) {
    if (field.type !== 'text') continue;
    const value = MARKUP.slice(0, field.max_length);
    const node = mount(name, { ...VALID[name], [key]: value });
    const root = node.shadowRoot;
    const shown = [root.textContent, root.querySelector('input')?.value ?? '',
      ...[...root.querySelectorAll('[aria-label]')].map((item) => item.getAttribute('aria-label'))];
    const unsafe = root.querySelector('img, script, b');
    check(`${name}.${key}: markup shows as text`, node.dataset.state !== 'refused' && !unsafe
      && shown.some((item) => item.includes(value)), shown.join('|').slice(0, 160));
  }
}

// The field label names the input. The hint and the error describe it.
const field = mount('field', VALID.field);
const input = field.shadowRoot.querySelector('input');
check('field: the label names the input', input.labels.length === 1 && input.labels[0].textContent === 'Shelf code');
const described = (input.getAttribute('aria-describedby') || '').split(' ').map((id) => field.shadowRoot.getElementById(id)?.textContent);
check('field: the hint and the error describe the input', described.join('|') === 'A letter and a number.|Give a code.', described);
check('field: an error sets aria-invalid', input.getAttribute('aria-invalid') === 'true' && field.dataset.state === 'error');
let edits = 0;
field.addEventListener('mu-edit', () => { edits += 1; });
input.value = 'C-2';
input.dispatchEvent(new Event('input'));
check('field: an edit sends one mu-edit event', edits === 1 && field.value === 'C-2');
const limit = CATALOG.field.data.value.max_length;
input.value = 'x'.repeat(limit + 500);
input.dispatchEvent(new Event('input'));
check('field: an edit stays in the contract limit', input.maxLength === limit && field.value.length === limit
  && edits === 2, `${input.maxLength} ${field.value.length} ${edits}`);
const refusedField = mount('field', VALID.field);
refusedField.fill = fill('field', { label: 7 });
check('field: a refused field gives no value', refusedField.value === null, refusedField.value);

// A blank label gives no accessible name, so the contract refuses it.
for (const name of ['button', 'field', 'stack', 'grid']) {
  const blank = mount(name, { ...VALID[name], label: '' });
  check(`${name}: refuses a blank label`, blank.dataset.state === 'refused'
    && blank.shadowRoot.textContent.includes('data.label: fewer than 1 characters'), blank.shadowRoot.textContent);
}

const disabled = mount('button', { label: 'Return', disabled: true });
check('button: disabled state', disabled.dataset.state === 'disabled' && disabled.shadowRoot.querySelector('button').disabled);

// Media modes. The runner gives the mode in the URL.
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const button = mount('button', VALID.button).shadowRoot.querySelector('button');
const style = getComputedStyle(button);
const fieldStyle = getComputedStyle(mount('field', VALID.field).shadowRoot.querySelector('input'));
const zero = (value) => value.split(',').every((d) => parseFloat(d) === 0);
if (mode === 'reduced-motion') check('reduced motion: no transition on the field', zero(fieldStyle.transitionDuration), fieldStyle.transitionDuration);
const probe = document.createElement('span');
stage.append(probe);
const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
if (mode === 'reduced-motion') {
  check('reduced motion: the media query matches', media('(prefers-reduced-motion: reduce)'));
  check('reduced motion: no transition on the button', style.transitionDuration.split(',').every((d) => parseFloat(d) === 0), style.transitionDuration);
} else {
  check('motion: the button has a short transition', style.transitionDuration.split(',').some((d) => parseFloat(d) > 0), style.transitionDuration);
}
if (mode === 'forced-colors') {
  check('forced colors: the media query matches', media('(forced-colors: active)'));
  check('forced colors: the button uses ButtonText', style.color === resolved('ButtonText') && style.borderTopColor === resolved('ButtonText'),
    `${style.color} ${style.borderTopColor}`);
  check('forced colors: the field border is visible', fieldStyle.borderTopStyle === 'solid' && parseFloat(fieldStyle.borderTopWidth) >= 1,
    `${fieldStyle.borderTopStyle} ${fieldStyle.borderTopWidth}`);
}
if (mode === 'dark') {
  check('dark: the media query matches', media('(prefers-color-scheme: dark)'));
  check('dark: the button uses the dark accent', style.backgroundColor === 'rgb(140, 180, 245)', style.backgroundColor);
}
if (mode === 'light') {
  check('light: the button uses the light accent', style.backgroundColor === 'rgb(31, 95, 191)', style.backgroundColor);
}
check('no markup ran', window.muUnsafe === undefined);

// The keyboard part of the check: the runner sends real key events to this target.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = fill('button', { label: 'Keyboard target' });
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
window.muPresses = () => presses;
window.muChecks = { mode, results };
