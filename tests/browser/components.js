// In-page checks of the catalog components. Each expected result comes from the contracts in catalog/
// and from the constitution: an action shows as done only after its receipt comes back.
import { define } from '../../src/components/index.js';
import { CATALOG } from '../../src/render/catalog.js';

define();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const fill = (component, data) => ({ component, version: '0.1.0', data });
const fact = (label, value) => fill('fact', { label, value });
const field = (name, label, value) => fill('field', { name, label, value });
const stage = document.getElementById('stage');
const LOAN = { title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01',
  date_label: 'Due', facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')] };
const FORM = { title: 'Loan details', submit_label: 'Save', fields: [field('shelf', 'Shelf code', 'B-14'), field('branch', 'Branch', 'North')] };
const VALID = {
  card: LOAN,
  'action-button': { label: 'Renew' },
  'editable-form': FORM,
  'card-grid': { label: 'Loans', cards: [fill('card', LOAN), fill('card', { title: 'Weather at sea' })] },
};
const TAGS = { card: 'mu-card', 'action-button': 'mu-action-button', 'editable-form': 'mu-editable-form', 'card-grid': 'mu-card-grid' };

function mount(name, data) {
  const node = document.createElement(TAGS[name]);
  stage.append(node);
  node.fill = fill(name, data);
  return node;
}

function deepText(node) {
  const parts = [];
  const walk = (item) => {
    if (item.nodeType === Node.TEXT_NODE) parts.push(item.data);
    if (item.getAttribute?.('aria-label')) parts.push(item.getAttribute('aria-label'));
    if (item.value !== undefined && item.tagName === 'INPUT') parts.push(item.value);
    for (const child of item.shadowRoot ? [...item.shadowRoot.childNodes, ...item.childNodes] : item.childNodes) walk(child);
  };
  walk(node);
  return parts.join('|');
}

function deepQuery(node, selector) {
  const found = [...(node.shadowRoot ?? node).querySelectorAll(selector)];
  for (const child of (node.shadowRoot ?? node).querySelectorAll('*')) if (child.shadowRoot) found.push(...deepQuery(child, selector));
  return found;
}

// Valid and invalid fills.
for (const name of Object.keys(TAGS)) {
  const node = mount(name, VALID[name]);
  check(`${name}: renders a valid fill`, node.dataset.state !== 'refused' && node.fill !== null, node.dataset.state);
  node.fill = fill(name, { ...VALID[name], style: 'color: red' });
  check(`${name}: refuses an undeclared field`, node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes('data.style: the contract does not declare this field'), node.shadowRoot.textContent);
  const required = Object.keys(VALID[name])[0];
  const missing = { ...VALID[name] };
  delete missing[required];
  node.fill = fill(name, missing);
  check(`${name}: refuses a fill without ${required}`, node.dataset.state === 'refused', node.shadowRoot.textContent);
}
const nested = mount('card-grid', { label: 'Loans', cards: [fill('card', { ...LOAN, facts: [fact('Shelf', 7)] })] });
check('card-grid: refuses a bad nested fact', nested.dataset.state === 'refused'
  && nested.shadowRoot.textContent.includes('data.cards[0].data.facts[0].data.value: must be a string'), nested.shadowRoot.textContent);
const unnamed = mount('editable-form', { ...FORM, fields: [fill('field', { label: 'Shelf code' })] });
check('editable-form: refuses a field without a name', unnamed.dataset.state === 'refused', unnamed.shadowRoot.textContent);
const twice = mount('editable-form', { ...FORM, fields: [field('shelf', 'A', ''), field('shelf', 'B', '')] });
check('editable-form: refuses two fields with one name', twice.dataset.state === 'refused', twice.shadowRoot.textContent);
const empty = mount('card-grid', { label: 'Loans', cards: [] });
check('card-grid: empty state', empty.dataset.state === 'empty' && empty.shadowRoot.textContent.includes('No cards.')
  && !empty.shadowRoot.querySelector('ul'), empty.shadowRoot.innerHTML.slice(0, 160));

// The styles use only the tokens that the contract declares. The shared base sheet gives the focus ring.
const declared = (name) => new Set(CATALOG[name].tokens.map((token) => '--mu-' + token.replace('.', '-')));
for (const name of Object.keys(TAGS)) {
  const node = mount(name, VALID[name]);
  const [base, ...own] = node.shadowRoot.adoptedStyleSheets;
  const used = new Set(own.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText))
    .join(' ').match(/--mu-[a-z0-9-]+/g) ?? []);
  const extra = [...used].filter((token) => !declared(name).has(token));
  check(`${name}: the styles use only declared tokens`, extra.length === 0, extra.join(' '));
  if (CATALOG[name].tokens.includes('color.focus')) {
    const ring = [...base.cssRules].some((rule) => rule.cssText.includes(':focus-visible') && rule.cssText.includes('--mu-color-focus'));
    check(`${name}: the focus ring uses color.focus`, ring);
  }
}

// Markup in each text field, also in nested fills, shows as text and makes no element.
const MARKED = {
  card: { ...LOAN, title: MARKUP, summary: MARKUP, date_label: MARKUP.slice(0, 40), facts: [fact(MARKUP.slice(0, 40), MARKUP)] },
  'action-button': { label: MARKUP.slice(0, 40), description: MARKUP },
  'editable-form': { title: MARKUP, submit_label: MARKUP.slice(0, 40), fields: [field('shelf', MARKUP.slice(0, 80), MARKUP)] },
  'card-grid': { label: MARKUP.slice(0, 80), cards: [fill('card', { title: MARKUP })] },
};
for (const [name, data] of Object.entries(MARKED)) {
  const node = mount(name, data);
  const shown = deepText(node);
  const unsafe = deepQuery(node, 'img, script');
  check(`${name}: markup in each text field shows as text`, node.dataset.state !== 'refused' && unsafe.length === 0
    && shown.includes(MARKUP.slice(0, 40)), shown.slice(0, 160));
}

// The action path. The button is pending after a press, and done only after the receipt.
const button = mount('action-button', VALID['action-button']);
const events = [];
button.addEventListener('mu-action', (event) => events.push(event.detail));
const control = button.shadowRoot.querySelector('button');
const status = () => button.shadowRoot.querySelector('[role="status"]').textContent;
control.click();
check('action-button: no action without a binding', events.length === 0 && button.dataset.state === 'disabled', button.dataset.state);
let thrown = false;
try { button.action = { tool: 'Run Anything' }; } catch { thrown = true; }
check('action-button: refuses a tool name that is not valid', thrown && button.dataset.state === 'disabled');
button.action = { tool: 'library.renew', arguments: { loan_id: 'L-0001' } };
control.click();
check('action-button: a press sends one request', events.length === 1 && events[0].tool === 'library.renew'
  && events[0].arguments.loan_id === 'L-0001' && typeof events[0].id === 'string', JSON.stringify(events));
check('action-button: pending after a press', button.dataset.state === 'pending' && status() === 'Pending'
  && control.getAttribute('aria-disabled') === 'true', `${button.dataset.state} ${status()}`);
control.click();
check('action-button: no second request while pending', events.length === 1);
check('action-button: a receipt with a different id does nothing', !button.receipt({ id: 'other', ok: true }) && button.dataset.state === 'pending');
check('action-button: a receipt that is not valid does nothing', !button.receipt({ id: events[0].id, ok: 'yes' }) && button.dataset.state === 'pending');
check('action-button: an error receipt shows the error', button.receipt({ id: events[0].id, ok: false, message: MARKUP.slice(0, 200) })
  && button.dataset.state === 'error' && status() === 'Not done: ' + MARKUP.slice(0, 200)
  && deepQuery(button, 'img, script').length === 0, status());
control.click();
check('action-button: a retry after an error sends a new request', events.length === 2 && events[1].id !== events[0].id);
check('action-button: done only after the receipt', button.dataset.state === 'pending'
  && button.receipt({ id: events[1].id, ok: true, message: 'Renewed to 15 December 2026.' })
  && button.dataset.state === 'done' && status() === 'Done: Renewed to 15 December 2026.', status());
check('action-button: a late receipt does nothing', !button.receipt({ id: events[1].id, ok: false }) && button.dataset.state === 'done');
let written = false;
try { button.action.state = 'default'; written = true; } catch { written = false; }
check('action-button: a script cannot write the state', !written && button.action.state === 'done' && button.dataset.state === 'done');
button.action = null;
check('action-button: a binding of null disables the button', button.dataset.state === 'disabled'
  && control.getAttribute('aria-disabled') === 'true' && status() === '', `${button.dataset.state} ${status()}`);
button.action = { tool: 'library.renew' };
button.fill = fill('action-button', { label: 'Renew', style: 'x' });
const before = events.length;
button.send();
check('action-button: a refused button sends no request', button.dataset.state === 'refused' && events.length === before);

// The editable form submits the edited values as one action.
const form = mount('editable-form', FORM);
const submits = [];
form.addEventListener('mu-action', (event) => submits.push(event.detail));
form.action = { tool: 'library.update_loan', arguments: { loan_id: 'L-0001' } };
const shelf = form.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
shelf.value = 'C-2';
shelf.dispatchEvent(new Event('input'));
form.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: submit sends the values', submits.length === 1 && submits[0].arguments.shelf === 'C-2'
  && submits[0].arguments.branch === 'North' && submits[0].arguments.loan_id === 'L-0001', JSON.stringify(submits));
check('editable-form: pending until the receipt', form.dataset.state === 'pending');
form.receipt({ id: submits[0].id, ok: true });
check('editable-form: done after the receipt', form.dataset.state === 'done');
const pinned = mount('editable-form', { ...FORM, fields: [field('loan_id', 'Loan', 'L-9999')] });
const pinnedSubmits = [];
pinned.addEventListener('mu-action', (event) => pinnedSubmits.push(event.detail));
pinned.action = { tool: 'library.update_loan', arguments: { loan_id: 'L-0001' } };
pinned.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: a field cannot change a bound argument', pinnedSubmits.length === 1
  && pinnedSubmits[0].arguments.loan_id === 'L-0001', JSON.stringify(pinnedSubmits));
const formStyle = getComputedStyle(pinned.shadowRoot.querySelector('form'));
check('editable-form: the form has the card border', formStyle.borderTopStyle === 'solid'
  && parseFloat(formStyle.borderTopWidth) >= 1, `${formStyle.borderTopStyle} ${formStyle.borderTopWidth}`);

// Media modes.
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const article = mount('card', LOAN).shadowRoot.querySelector('article');
const cardStyle = getComputedStyle(article);
const fresh = mount('action-button', VALID['action-button']);
fresh.action = { tool: 'library.renew' };
const actionStyle = getComputedStyle(fresh.shadowRoot.querySelector('button'));
const probe = document.createElement('span');
stage.append(probe);
const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
if (mode === 'forced-colors') {
  check('forced colors: the card border uses CanvasText', cardStyle.borderTopColor === resolved('CanvasText'), cardStyle.borderTopColor);
  check('forced colors: the action button uses ButtonText', actionStyle.color === resolved('ButtonText'), actionStyle.color);
}
if (mode === 'reduced-motion') {
  check('reduced motion: no transition on the action button', actionStyle.transitionDuration.split(',').every((d) => parseFloat(d) === 0), actionStyle.transitionDuration);
}
if (mode === 'dark') check('dark: the card uses the dark surface', cardStyle.backgroundColor === 'rgb(27, 29, 33)', cardStyle.backgroundColor);
if (mode === 'light') check('light: the card uses the light surface', cardStyle.backgroundColor === 'rgb(255, 255, 255)', cardStyle.backgroundColor);
check('no markup ran', window.muUnsafe === undefined);

// The keyboard target for the runner.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-action-button');
target.fill = fill('action-button', { label: 'Keyboard target' });
target.action = { tool: 'library.renew' };
let presses = 0;
target.addEventListener('mu-action', (event) => { presses += 1; target.receipt({ id: event.detail.id, ok: false }); });
keyboard.append(target);
// The runner presses Enter in a field of this form. The form must submit one time.
const enterForm = document.createElement('mu-editable-form');
enterForm.fill = fill('editable-form', FORM);
enterForm.action = { tool: 'library.update_loan' };
let formSubmits = 0;
enterForm.addEventListener('mu-action', () => { formSubmits += 1; });
keyboard.append(enterForm);
window.muFocusField = () => { enterForm.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input').focus(); return true; };
window.muFormSubmits = () => formSubmits;
window.muPresses = () => presses;
window.muChecks = { mode, results };
