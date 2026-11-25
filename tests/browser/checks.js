// In-page checks of the primitives. tools/browser_check.mjs loads this page in each media mode
// and reads window.muChecks. Each expected result comes from the contracts in catalog/.
import { define } from '../../src/primitives/index.js';
import { CATALOG } from '../../src/render/catalog.js';

define();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const refusedText = (node) => node.shadowRoot.querySelector('[part="details"] > div')?.textContent ?? '';
const fill = (component, data) => ({ component, version: '0.1.0', data });
const VALID = {
  text: { text: 'Weather at sea' },
  button: { label: 'Renew' },
  field: { label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.', error: 'Give a code.' },
  'long-text-field': { label: 'Note', value: 'Line one.\nLine two.', hint: 'Two lines at most.' },
  'number-field': { label: 'Copies', value: 3, minimum: 1, maximum: 12, hint: 'From 1 to 12.' },
  'date-field': { label: 'Due date', value: '2026-12-01', earliest: '2026-11-01', latest: '2027-01-31' },
  'choice-field': { label: 'Branch', value: 'North', choices: ['North', 'South', 'Harbor'] },
  'toggle-field': { label: 'Email notices', value: true },
  stack: { label: 'Loan details' },
  grid: { label: 'Reading list' },
};
const TAGS = { text: 'mu-text', button: 'mu-button', field: 'mu-field', 'long-text-field': 'mu-long-text-field',
  'number-field': 'mu-number-field', 'date-field': 'mu-date-field', 'choice-field': 'mu-choice-field',
  'toggle-field': 'mu-toggle-field', stack: 'mu-stack', grid: 'mu-grid' };
const INPUTS = ['field', 'long-text-field', 'number-field', 'date-field', 'choice-field', 'toggle-field'];
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
    && refusedText(node).includes('data.script: the contract does not declare this field'), node.shadowRoot.textContent);
  node.fill = fill('banner', {});
  check(`${name}: refuses an undeclared component`, node.dataset.state === 'refused', node.dataset.state);
  node.fill = fill(name === 'text' ? 'button' : 'text', name === 'text' ? VALID.button : VALID.text);
  check(`${name}: refuses a fill of a different component`, node.dataset.state === 'refused'
    && refusedText(node).includes(`component: must be ${name}`), node.shadowRoot.textContent);
  node.fill = fill(name === 'text' ? 'button' : 'text', { label: 7, text: 7 });
  check(`${name}: names the component first for a bad fill of a different component`,
    refusedText(node).includes(`component: must be ${name}`), node.shadowRoot.textContent);
}

// Markup in each text field shows as text and makes no element.
for (const [name, contract] of Object.entries(CATALOG).filter(([key]) => key in TAGS)) {
  for (const [key, field] of Object.entries(contract.data)) {
    // The field name is a key for the form values. The kit does not show it.
    if (field.type !== 'text' || (INPUTS.includes(name) && key === 'name')) continue;
    const value = MARKUP.slice(0, field.max_length);
    // The value of a choice must be one of the choices, so the markup is a choice too.
    const extra = name === 'choice-field' && key === 'value' ? { choices: [value, 'South'] } : {};
    const node = mount(name, { ...VALID[name], ...extra, [key]: value });
    const root = node.shadowRoot;
    const shown = [root.textContent, root.querySelector('input:not([type="radio"]), textarea')?.value ?? '',
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

// A typed field asks for the edit type after a change (catalog/README.md, "Typed edits").
const typed = mount('field', { label: 'Due date', value: '2026-12-01', typed: true });
const typedInput = typed.shadowRoot.querySelector('input');
const typedGroup = typed.shadowRoot.querySelector('fieldset');
const typedEvents = [];
typed.addEventListener('mu-edit', (event) => typedEvents.push(event.detail));
check('field: a typed field shows no edit type before a change', typedGroup?.hidden === true && typed.editType === null && !typed.changed);
const untypedField = mount('field', VALID.field);
check('field: a field that is not typed has no edit type group', untypedField.shadowRoot.querySelector('fieldset') === null);
typedInput.value = '2026-12-08';
typedInput.dispatchEvent(new Event('input'));
const typeRadios = [...typedGroup.querySelectorAll('input[type="radio"]')];
check('field: a change of a typed field shows the edit type group', !typedGroup.hidden && typed.changed && typeRadios.length === 3
  && typeRadios.every((radio) => radio.labels.length === 1), typeRadios.length);
const meanings = typeRadios.map((radio) => typed.shadowRoot.getElementById(radio.getAttribute('aria-describedby') ?? '')?.textContent);
check('field: each edit type has a description as text', meanings.every((text) => typeof text === 'string' && text.length > 0), meanings.join('|'));
typeRadios[2].click();
check('field: a type sends a mu-edit event with the type', typed.editType === 'override'
  && typedEvents.at(-1)?.field === 'type' && typedEvents.at(-1)?.value === 'override', JSON.stringify(typedEvents));
check('field: the field gives the old value and the time of the change', typed.initial === '2026-12-01'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(typed.editedAt ?? ''), `${typed.initial} ${typed.editedAt}`);
typedInput.value = '2026-12-01';
typedInput.dispatchEvent(new Event('input'));
check('field: the old value again clears the type', typedGroup.hidden && typed.editType === null && !typed.changed);

// A choice shows each choice as text. Markup in a choice makes no element.
{
  const node = mount('choice-field', { label: 'Branch', choices: [MARKUP.slice(0, 80), 'South'] });
  const radio = node.shadowRoot.querySelector('input[type="radio"]');
  check('choice-field.choices: markup shows as text', !node.shadowRoot.querySelector('img, script, b')
    && radio.labels[0].textContent === MARKUP.slice(0, 80) && radio.value === MARKUP.slice(0, 80), radio.labels[0]?.textContent);
}

// Each input type has a visible label that names its control.
for (const name of INPUTS) {
  const node = mount(name, VALID[name]);
  const root = node.shadowRoot;
  const named = name === 'choice-field' ? root.querySelector('fieldset legend')?.textContent
    : root.querySelector('input, textarea').labels[0]?.textContent;
  check(`${name}: the label names the control`, named === VALID[name].label, named);
}

{
  for (const data of [{}, { display: 'checkbox' }]) {
    const node = mount('toggle-field', { label: 'Send a reminder', ...data });
    const control = node.shadowRoot.querySelector('input[type="checkbox"]');
    check('toggle-field: the checkbox starts unchecked if the fill gives no value', control && !control.hasAttribute('role')
      && !control.checked && node.initial === false && node.value === false && !node.shadowRoot.querySelector('[part="state"]'));
    control.labels[0].click();
    check('toggle-field: the checkbox label changes the value to true', control.checked && node.value === true);
    node.remove();
  }
  const node = mount('toggle-field', { label: 'Send a reminder', display: 'switch', value: true, typed: true,
    hint: 'Send the notice before the due date.', error: 'Check the notice settings.' });
  const root = node.shadowRoot;
  const control = root.querySelector('input[type="checkbox"]');
  const state = root.querySelector('[part="state"]');
  const group = root.querySelector('[part="edit-type"]');
  const edits = [];
  node.addEventListener('mu-edit', (event) => edits.push(event.detail));
  check('toggle-field: the switch starts on and a screen reader gets its state from the control', control.getAttribute('role') === 'switch'
    && control.checked && node.value === true && state.textContent === 'On' && state.getAttribute('aria-hidden') === 'true' && group.hidden);
  const description = control.getAttribute('aria-describedby').split(' ').map((id) => root.getElementById(id)?.textContent);
  check('toggle-field: the hint and error describe the switch', description.join('|') === 'Send the notice before the due date.|Check the notice settings.'
    && control.getAttribute('aria-invalid') === 'true' && node.dataset.state === 'error');
  control.click();
  check('toggle-field: a switch edit updates the state text and sends one boolean event', !control.checked && state.textContent === 'Off'
    && node.value === false && !group.hidden && JSON.stringify(edits) === '[{"field":"value","value":false}]');
  group.querySelector('input').click();
  control.click();
  check('toggle-field: the initial value clears the edit type', node.value === true && state.textContent === 'On'
    && !node.changed && group.hidden && node.editType === null);

  const disabled = mount('toggle-field', { label: 'Send a reminder', display: 'switch', value: false, disabled: true, typed: true });
  disabled.shadowRoot.querySelector('label').click();
  check('toggle-field: a disabled switch keeps its value and has no edit type', disabled.dataset.state === 'disabled'
    && disabled.shadowRoot.querySelector('input').disabled && disabled.value === false && !disabled.shadowRoot.querySelector('[part="edit-type"]'));
  const refused = mount('toggle-field', { label: 'Send a reminder', value: 'false' });
  check('toggle-field: refuses a value that is not a boolean', refused.dataset.state === 'refused' && refused.value === null
    && refusedText(refused).includes('data.value: must be true or false'), refusedText(refused));
}

const edit = (node, text) => {
  const control = node.shadowRoot.querySelector('input:not([type="radio"]), textarea');
  control.value = text;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change', { bubbles: true }));
  return control;
};
const reasonOf = (node) => {
  const control = node.shadowRoot.querySelector('input:not([type="radio"]), textarea');
  const ids = (control.getAttribute('aria-describedby') ?? '').split(' ');
  return { text: node.shadowRoot.querySelector('[part="problem"]').textContent, described: ids.includes(node.shadowRoot.querySelector('[part="problem"]').id),
    invalid: control.getAttribute('aria-invalid') === 'true' };
};

// A number field gives a number. It tells why a text is not a number or is outside the range.
{
  const node = mount('number-field', VALID['number-field']);
  check('number-field: the value is a number', node.value === 3 && node.problem === null, node.value);
  edit(node, '7.5');
  check('number-field: a number in the range is valid', node.value === 7.5 && node.problem === null && reasonOf(node).text === '', node.value);
  edit(node, 'seven');
  let reason = reasonOf(node);
  check('number-field: a text that is not a number shows the reason', node.problem === 'Give a number, for example 12 or 12.5.'
    && reason.text === node.problem && reason.described && reason.invalid, JSON.stringify(reason));
  edit(node, '40');
  check('number-field: a number outside the range shows the range', reasonOf(node).text === 'Give a number from 1 to 12.', reasonOf(node).text);
  edit(node, '12');
  reason = reasonOf(node);
  check('number-field: a valid number removes the reason', reason.text === '' && !reason.described && !reason.invalid, JSON.stringify(reason));
  const low = mount('number-field', { label: 'Copies', minimum: 1 });
  edit(low, '0');
  check('number-field: a minimum alone shows the minimum', reasonOf(low).text === 'Give a number of at least 1.', reasonOf(low).text);
  const outside = mount('number-field', { label: 'Copies', value: 30, maximum: 12 });
  check('number-field: refuses a value outside the range of the fill', outside.dataset.state === 'refused'
    && refusedText(outside).includes('data.value: the number is outside the range'), outside.shadowRoot.textContent);
  const wrong = mount('number-field', { label: 'Copies', value: '3' });
  check('number-field: refuses a value that is not a number', wrong.dataset.state === 'refused'
    && refusedText(wrong).includes('data.value: must be a number'), wrong.shadowRoot.textContent);
  const crossed = mount('number-field', { label: 'Copies', minimum: 5, maximum: 2 });
  check('number-field: refuses a minimum above the maximum', crossed.dataset.state === 'refused', crossed.shadowRoot.textContent);
}

// A date field gives a date as YYYY-MM-DD. It tells why a date does not exist or is outside the range.
{
  const node = mount('date-field', VALID['date-field']);
  check('date-field: the value is the date', node.value === '2026-12-01' && node.problem === null, node.value);
  edit(node, '2026-02-30');
  check('date-field: a date that does not exist shows the reason',
    reasonOf(node).text === 'Give a date that exists, as YYYY-MM-DD, for example 2026-12-01.' && reasonOf(node).invalid, reasonOf(node).text);
  edit(node, '2027-03-01');
  check('date-field: a date outside the range shows the range', reasonOf(node).text === 'Give a date from 2026-11-01 to 2027-01-31.', reasonOf(node).text);
  edit(node, '2026-12-24');
  check('date-field: a valid date removes the reason', reasonOf(node).text === '' && node.value === '2026-12-24', reasonOf(node).text);
  const wrong = mount('date-field', { label: 'Due date', value: '2026-13-01' });
  check('date-field: refuses a value that is not a date', wrong.dataset.state === 'refused'
    && refusedText(wrong).includes('data.value: must be a date as YYYY-MM-DD'), wrong.shadowRoot.textContent);
  const outside = mount('date-field', { label: 'Due date', value: '2026-10-01', earliest: '2026-11-01' });
  check('date-field: refuses a value outside the range of the fill', outside.dataset.state === 'refused'
    && refusedText(outside).includes('data.value: the date is outside the range'), outside.shadowRoot.textContent);
}

// A choice field gives one of its choices. It refuses a value that is not a choice.
{
  const node = mount('choice-field', VALID['choice-field']);
  const radios = [...node.shadowRoot.querySelectorAll('input[type="radio"]')];
  check('choice-field: the value is the checked choice', node.value === 'North' && radios[0].checked && radios.length === 3, node.value);
  radios[2].click();
  check('choice-field: a click selects a choice', node.value === 'Harbor' && node.changed, node.value);
  const empty = mount('choice-field', { label: 'Branch', choices: ['North', 'South'] });
  check('choice-field: no value checks no choice', empty.value === '' && !empty.changed, empty.value);
  const wrong = mount('choice-field', { label: 'Branch', value: 'East', choices: ['North', 'South'] });
  check('choice-field: refuses a value that is not a choice', wrong.dataset.state === 'refused'
    && refusedText(wrong).includes('data.value: the value is not one of the choices'), wrong.shadowRoot.textContent);
  const twice = mount('choice-field', { label: 'Branch', choices: ['North', 'North'] });
  check('choice-field: refuses two choices with one text', twice.dataset.state === 'refused', twice.shadowRoot.textContent);
  const none = mount('choice-field', { label: 'Branch', choices: [] });
  check('choice-field: refuses a field with no choice', none.dataset.state === 'refused', none.shadowRoot.textContent);
}

// A long text field keeps more than one line, to the limit of its contract.
{
  const node = mount('long-text-field', VALID['long-text-field']);
  const area = node.shadowRoot.querySelector('textarea');
  check('long-text-field: the value keeps its lines', node.value === 'Line one.\nLine two.' && area !== null, JSON.stringify(node.value));
  const limit = CATALOG['long-text-field'].data.value.max_length;
  edit(node, 'x'.repeat(limit + 10));
  check('long-text-field: an edit stays in the contract limit', node.value.length === limit && area.maxLength === limit, node.value.length);
}

// A typed edit works with each input type: the old value and the new value have the contract type.
for (const [name, data, change, before, after] of [
  ['long-text-field', VALID['long-text-field'], (node) => edit(node, 'Line three.'), 'Line one.\nLine two.', 'Line three.'],
  ['number-field', VALID['number-field'], (node) => edit(node, '4'), 3, 4],
  ['date-field', VALID['date-field'], (node) => edit(node, '2026-12-08'), '2026-12-01', '2026-12-08'],
  ['choice-field', VALID['choice-field'], (node) => node.shadowRoot.querySelectorAll('input[type="radio"]')[1].click(), 'North', 'South'],
]) {
  const node = mount(name, { ...data, typed: true });
  const group = node.shadowRoot.querySelector('[part="edit-type"]');
  check(`${name}: a typed field asks for no type before a change`, group?.hidden === true, group?.hidden);
  change(node);
  group.querySelectorAll('input')[1].click();
  check(`${name}: a typed edit has the type and the two values`, !group.hidden && node.editType === 'correction'
    && node.initial === before && node.value === after && typeof node.editedAt === 'string', `${node.initial} ${node.value} ${node.editType}`);
}

// The browser changes a value when the control shows it: a text area changes CRLF to LF, and an input removes
// line breaks. The value that the control shows is the old value, so such a change is not an edit of the person.
for (const [name, value, shown] of [['long-text-field', 'First\r\nSecond', 'First\nSecond'], ['field', 'First\nSecond', 'FirstSecond']]) {
  const node = mount(name, { ...VALID[name], value, typed: true });
  const group = node.shadowRoot.querySelector('[part="edit-type"]');
  check(`${name}: a value that the browser changes is not an edit`, node.changed === false && node.initial === shown
    && node.editType === null && group.hidden && node.needType() === false, JSON.stringify([node.initial, node.value, node.changed]));
}

// A blank label gives no accessible name, so the contract refuses it.
for (const name of ['button', ...INPUTS, 'stack', 'grid']) {
  const blank = mount(name, { ...VALID[name], label: '' });
  check(`${name}: refuses a blank label`, blank.dataset.state === 'refused'
    && refusedText(blank).includes('data.label: fewer than 1 characters'), blank.shadowRoot.textContent);
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
const areaStyle = getComputedStyle(mount('long-text-field', VALID['long-text-field']).shadowRoot.querySelector('textarea'));
const choicesStyle = getComputedStyle(mount('choice-field', VALID['choice-field']).shadowRoot.querySelector('[part="choices"]'));
if (mode === 'reduced-motion') check('reduced motion: no transition on the long text and the choices',
  zero(areaStyle.transitionDuration) && zero(choicesStyle.transitionDuration), `${areaStyle.transitionDuration} ${choicesStyle.transitionDuration}`);
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
  check('forced colors: the long text and the choices have a visible border', [areaStyle, choicesStyle].every((item) =>
    item.borderTopStyle === 'solid' && parseFloat(item.borderTopWidth) >= 1 && item.borderTopColor === resolved('FieldText')),
  `${areaStyle.borderTopColor} ${choicesStyle.borderTopColor}`);
  const groupStyle = getComputedStyle(typedGroup);
  typedInput.value = '2026-12-09';
  typedInput.dispatchEvent(new Event('input'));
  check('forced colors: the edit type group border is visible', groupStyle.borderTopStyle === 'solid'
    && parseFloat(groupStyle.borderTopWidth) >= 1 && groupStyle.borderTopColor === resolved('FieldText'),
  `${groupStyle.borderTopStyle} ${groupStyle.borderTopWidth} ${groupStyle.borderTopColor}`);
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
// The label checks moved the focus. Set the start point of Tab before the keyboard targets.
const top = document.createElement('span');
top.tabIndex = -1;
keyboard.before(top);
top.focus();
top.blur();
const target = document.createElement('mu-button');
target.fill = fill('button', { label: 'Keyboard target' });
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
const checkbox = document.createElement('mu-toggle-field');
checkbox.fill = fill('toggle-field', { label: 'Keyboard checkbox' });
keyboard.append(checkbox);
window.muPresses = () => presses;
window.muKeyboardCheckbox = () => {
  const control = checkbox.shadowRoot.querySelector('input');
  const style = getComputedStyle(control);
  return { focused: checkbox.shadowRoot.activeElement === control, checked: control.checked,
    ring: control.matches(':focus-visible') && style.outlineStyle === 'solid' && style.outlineWidth === '2px' };
};
window.muChecks = { mode, results };
