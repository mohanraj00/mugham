// In-page checks of the catalog components. Each expected result comes from the contracts in catalog/
// and from the constitution: an action shows as done only after its receipt comes back.
import { define } from '../../src/components/index.js';
import { CATALOG } from '../../src/render/catalog.js';

define();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const fill = (component, data) => ({ component, version: '0.1.0', data });
// An outer fill. Only the outer fill has slots, and a contract with ai_content requires the authorship slot.
const AUTHOR = { type: 'agent', id: 'agent-check', name: 'Checker' };
const outer = (component, data) => ({ ...fill(component, data), ...(CATALOG[component].slots?.authorship ? { slots: { authorship: AUTHOR } } : {}) });
const fact = (label, value) => fill('fact', { label, value });
const field = (name, label, value) => fill('field', { name, label, value });
const stage = document.getElementById('stage');
const LOAN = { title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', date: '2026-12-01',
  date_label: 'Due', facts: [fact('Shelf', 'B-14'), fact('Renewals', '1 of 3')] };
const FORM = { title: 'Loan details', submit_label: 'Save', fields: [field('shelf', 'Shelf code', 'B-14'), field('branch', 'Branch', 'North')] };
const EDITABLE = { shelf: 'Shelf code', branch: 'Branch' };
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
  node.actor = AUTHOR;
  node.fill = outer(name, data);
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
  node.fill = outer(name, { ...VALID[name], style: 'color: red' });
  check(`${name}: refuses an undeclared field`, node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes('data.style: the contract does not declare this field'), node.shadowRoot.textContent);
  const required = Object.keys(VALID[name])[0];
  const missing = { ...VALID[name] };
  delete missing[required];
  node.fill = outer(name, missing);
  check(`${name}: refuses a fill without ${required}`, node.dataset.state === 'refused', node.shadowRoot.textContent);
}
const nested = mount('card-grid', { label: 'Loans', cards: [fill('card', { ...LOAN, facts: [fact('Shelf', 7)] })] });
check('card-grid: refuses a bad nested fact', nested.dataset.state === 'refused'
  && nested.shadowRoot.textContent.includes('data.cards[0].data.facts[0].data.value: must be a string'), nested.shadowRoot.textContent);
const unnamed = mount('editable-form', { ...FORM, fields: [fill('field', { label: 'Shelf code' })] });
check('editable-form: refuses a field without a name', unnamed.dataset.state === 'refused', unnamed.shadowRoot.textContent);
const blankSubmit = mount('editable-form', { ...FORM, submit_label: '' });
check('editable-form: refuses a blank submit label', blankSubmit.dataset.state === 'refused'
  && blankSubmit.shadowRoot.textContent.includes('data.submit_label: fewer than 1 characters'), blankSubmit.shadowRoot.textContent);
// A form with no field has no application label that tells what the request does.
const noFields = mount('editable-form', { ...FORM, submit_label: 'View details', fields: [] });
check('editable-form: refuses a form with no field', noFields.dataset.state === 'refused'
  && noFields.shadowRoot.textContent.includes('data.fields: the form needs at least one field that a person can edit'), noFields.shadowRoot.textContent);
// A form with only disabled fields sends no value that a person can edit. It is the same as a form with no field.
const allLocked = mount('editable-form', { ...FORM, submit_label: 'View details',
  fields: [fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', disabled: true })] });
check('editable-form: refuses a form with only disabled fields', allLocked.dataset.state === 'refused'
  && allLocked.shadowRoot.textContent.includes('at least one field that a person can edit'), allLocked.shadowRoot.textContent);
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

// The authorship and citation slots (catalog/schema/README.md). Each filled slot shows as text. The locator
// opens only after a person clicks the button. Markup in a slot shows as text and makes no element.
const CITED = { authorship: { ...AUTHOR, name: 'Checker' }, citation: { source: 'Synthetic loan rules', locator: 'https://example.org/rules/loans' } };
const slotted = (name, data, slots, actor = AUTHOR) => {
  const node = document.createElement(TAGS[name]);
  stage.append(node);
  node.actor = actor;
  node.fill = slots === undefined ? fill(name, data) : { ...fill(name, data), slots };
  return node;
};
const opened = [];
const realOpen = window.open;
window.open = (...args) => { opened.push(args); return null; };
const cited = slotted('card', LOAN, CITED);
const citedText = deepText(cited);
const openButton = cited.shadowRoot.querySelector('[part="open"]');
const openAsks = [];
cited.addEventListener('mu-open', (event) => openAsks.push(event.detail.locator));
check('card: shows the authorship slot as text', citedText.includes('Author: agent agent-check (Checker)'), citedText.slice(0, 200));
check('card: shows the citation slot as text', citedText.includes('Source: Synthetic loan rules')
  && citedText.includes('https://example.org/rules/loans'), citedText.slice(0, 200));
check('card: the locator makes no link', deepQuery(cited, 'a, link, iframe, img').length === 0);
check('card: the locator does not open before a click', opened.length === 0 && openAsks.length === 0);
check('card: the open button names the source', openButton?.getAttribute('aria-label') === 'Open source: Synthetic loan rules');
openButton.click();
check('card: a click opens the locator with no opener', openAsks.length === 1 && openAsks[0] === 'https://example.org/rules/loans'
  && opened.length === 1 && opened[0][0] === 'https://example.org/rules/loans' && opened[0][2] === 'noopener,noreferrer', JSON.stringify(opened));
const handled = (event) => event.preventDefault();
cited.addEventListener('mu-open', handled);
openButton.click();
check('card: the application can open the locator itself', openAsks.length === 2 && opened.length === 1, JSON.stringify(opened));
cited.removeEventListener('mu-open', handled);
window.open = realOpen;
const authorOnly = deepText(slotted('card', LOAN, { authorship: AUTHOR }));
check('card: an empty citation slot shows no source', authorOnly.includes('Author: agent agent-check') && !authorOnly.includes('Source:'), authorOnly.slice(0, 200));
for (const name of ['card', 'editable-form', 'card-grid']) {
  const node = slotted(name, VALID[name], undefined);
  check(`${name}: refuses a fill with no authorship slot`, node.dataset.state === 'refused'
    && node.shadowRoot.textContent.includes('slots.authorship: a required slot is missing'), node.shadowRoot.textContent);
}
const formText = deepText(slotted('editable-form', FORM, { authorship: AUTHOR }));
check('editable-form: shows the authorship slot as text', formText.includes('Author: agent agent-check'), formText.slice(0, 200));
const gridCards = deepQuery(slotted('card-grid', VALID['card-grid'], CITED), 'mu-card');
check('card-grid: each card takes the slots of the grid', gridCards.length === 2
  && gridCards.every((card) => deepText(card).includes('Author: agent agent-check (Checker)') && deepText(card).includes('Source: Synthetic loan rules')));
const nestedSlots = slotted('card-grid', { label: 'Loans', cards: [{ ...fill('card', LOAN), slots: { authorship: AUTHOR } }] }, { authorship: AUTHOR });
check('card-grid: refuses a nested card with its own slots', nestedSlots.dataset.state === 'refused'
  && nestedSlots.shadowRoot.textContent.includes('data.cards[0].slots: a nested fill takes the slots of its outer fill'), nestedSlots.shadowRoot.textContent);
const markedSlots = slotted('card', LOAN, { authorship: { type: 'agent', id: MARKUP.slice(0, 128), name: MARKUP.slice(0, 80) },
  citation: { source: MARKUP.slice(0, 120), locator: 'https://example.org/a?q=<script>x</script>' } }, { type: 'agent', id: MARKUP.slice(0, 128), name: MARKUP.slice(0, 80) });
const markedText = deepText(markedSlots);
check('card: markup in a slot shows as text', markedSlots.dataset.state !== 'refused' && deepQuery(markedSlots, 'img, script, a').length === 0
  && markedText.includes(MARKUP.slice(0, 40)) && markedText.includes('<script>x</script>') && !window.muUnsafe, markedText.slice(0, 200));
const insecure = slotted('card', LOAN, { authorship: AUTHOR, citation: { source: 'Rules', locator: 'javascript:alert(1)' } });
check('card: refuses a locator that is not https', insecure.dataset.state === 'refused'
  && insecure.shadowRoot.textContent.includes('slots.citation.locator'), insecure.shadowRoot.textContent.slice(0, 120));

// The author in a fill is a claim. The element shows it only if it is the actor that the application gives.
const PERSON = { type: 'human', id: 'person-check' };
const unbound = slotted('card', LOAN, { authorship: AUTHOR }, null);
check('card: refuses an authorship slot with no bound actor', unbound.dataset.state === 'refused'
  && unbound.shadowRoot.textContent.includes('slots.authorship: no actor is bound'), unbound.shadowRoot.textContent);
const posing = slotted('card', LOAN, { authorship: PERSON });
check('card: refuses an agent fill that names a person as the author', posing.dataset.state === 'refused'
  && posing.shadowRoot.textContent.includes('slots.authorship: the author is not the bound actor') && !deepText(posing).includes('person-check|'),
  posing.shadowRoot.textContent);
const otherAgent = slotted('card', LOAN, { authorship: { type: 'agent', id: 'agent-other' } });
check('card: refuses an author with a different id', otherAgent.dataset.state === 'refused', otherAgent.shadowRoot.textContent);
// A fill cannot show a name that is not the name of the bound actor.
const otherName = slotted('card', LOAN, { authorship: { ...AUTHOR, name: 'Robin' } });
check('card: refuses an author with a different name', otherName.dataset.state === 'refused'
  && otherName.shadowRoot.textContent.includes('slots.authorship: the author is not the bound actor')
  && !deepText(otherName).includes('Robin'), otherName.shadowRoot.textContent);
const boundName = slotted('card', LOAN, { authorship: { ...AUTHOR, name: 'Checker' } });
check('card: shows the name of the bound actor', boundName.dataset.state === 'default' && boundName.actor.name === 'Checker'
  && deepText(boundName).includes('Checker'), boundName.shadowRoot.textContent);
const rebind = slotted('card', LOAN, { authorship: AUTHOR });
rebind.actor = PERSON;
check('card: a new actor checks the fill again', rebind.dataset.state === 'refused' && rebind.fill === null, rebind.dataset.state);
const gridPosing = slotted('card-grid', VALID['card-grid'], { authorship: PERSON });
check('card-grid: refuses an author that is not the bound actor', gridPosing.dataset.state === 'refused', gridPosing.shadowRoot.textContent);
const gridBound = slotted('card-grid', VALID['card-grid'], { authorship: AUTHOR });
check('card-grid: each card takes the actor of the grid', deepQuery(gridBound, 'mu-card').every((card) => card.actor?.id === 'agent-check'
  && card.dataset.state !== 'refused'));
let badActor = '';
try { rebind.actor = { type: 'person', id: 'x' }; } catch (error) { badActor = error.message; }
check('card: refuses an actor of an unknown type', badActor === 'actor: type: must be human, agent or system', badActor);

// The action path. The button is pending after a press, and done only after the receipt.
const button = mount('action-button', VALID['action-button']);
const events = [];
button.addEventListener('mu-action', (event) => events.push(event.detail));
const control = button.shadowRoot.querySelector('button');
const status = () => button.shadowRoot.querySelector('[role="status"]').textContent;
control.click();
check('action-button: no description shows no text', !deepText(button).includes('null'), deepText(button));
check('action-button: no action without a binding', events.length === 0 && button.dataset.state === 'disabled', button.dataset.state);
let thrown = false;
try { button.action = { tool: 'Run Anything' }; } catch { thrown = true; }
check('action-button: refuses a tool name that is not valid', thrown && button.dataset.state === 'disabled');
button.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
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
button.action = { tool: 'library.renew', label: 'Renew' };
button.fill = outer('action-button', { label: 'Renew', style: 'x' });
const before = events.length;
button.send();
check('action-button: a refused button sends no request', button.dataset.state === 'refused' && events.length === before);

// The application gives the label of the action. A fill cannot show a different meaning for the bound tool.
const misnamed = mount('action-button', { label: 'View details' });
misnamed.action = { tool: 'library.renew', label: 'Renew' };
check('action-button: a label that is not the label of the application is refused', misnamed.dataset.state === 'refused'
  && misnamed.shadowRoot.textContent.includes('data.label: the label is not the label of the application'), misnamed.shadowRoot.textContent);
const nameless = mount('action-button', { label: 'Renew' });
nameless.action = { tool: 'library.renew' };
check('action-button: a binding with no label accepts no fill', nameless.dataset.state === 'refused'
  && nameless.shadowRoot.textContent.includes('data.label: the label is not the label of the application'), nameless.shadowRoot.textContent);
// The application gives the description of the action. A fill cannot describe a different target for the bound arguments.
const BOUND = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' }, description: 'Renews Rivers and deltas.' };
const redescribed = mount('action-button', { label: 'Renew', description: 'Renews Weather at sea.' });
redescribed.action = BOUND;
check('action-button: a description that is not the description of the application is refused', redescribed.dataset.state === 'refused'
  && redescribed.shadowRoot.textContent.includes('data.description: the description is not the description of the application'),
  redescribed.shadowRoot.textContent);
const undescribed = mount('action-button', { label: 'Renew', description: 'Renews Weather at sea.' });
undescribed.action = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
check('action-button: a binding with no description accepts no fill with a description', undescribed.dataset.state === 'refused'
  && undescribed.shadowRoot.textContent.includes('data.description: the description is not the description of the application'),
  undescribed.shadowRoot.textContent);
const described = mount('action-button', { label: 'Renew', description: 'Renews Rivers and deltas.' });
described.action = BOUND;
check('action-button: the description of the application shows', described.dataset.state === 'default'
  && described.shadowRoot.textContent.includes('Renews Rivers and deltas.'), `${described.dataset.state} ${described.shadowRoot.textContent}`);
const misnamedForm = mount('editable-form', { ...FORM, submit_label: 'View details' });
misnamedForm.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
check('editable-form: a submit label that is not the label of the application is refused', misnamedForm.dataset.state === 'refused'
  && misnamedForm.shadowRoot.textContent.includes('data.submit_label: the label is not the label of the application'),
  misnamedForm.shadowRoot.textContent);
// The application gives the title of the form. A fill cannot show a different target for the bound arguments.
const retitled = mount('editable-form', { ...FORM, title: 'Loan L-0002' });
retitled.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', arguments: { loan_id: 'L-0001' }, editable: EDITABLE };
check('editable-form: a title that is not the title of the application is refused', retitled.dataset.state === 'refused'
  && retitled.shadowRoot.textContent.includes('data.title: the title is not the title of the application'), retitled.shadowRoot.textContent);
// The contract accepts a title of 120 characters. A bound form with such a title works.
const longTitle = 'T'.repeat(120);
const longForm = mount('editable-form', { ...FORM, title: longTitle });
longForm.action = { tool: 'library.update_loan', label: 'Save', title: longTitle, arguments: { loan_id: 'L-0001' }, editable: EDITABLE };
check('editable-form: a bound form with a title of 120 characters is not refused', longForm.dataset.state === 'default',
  `${longForm.dataset.state} ${longForm.shadowRoot.textContent.slice(0, 200)}`);
const untitled = mount('editable-form', FORM);
untitled.action = { tool: 'library.update_loan', label: 'Save', arguments: { loan_id: 'L-0001' }, editable: EDITABLE };
check('editable-form: a binding with no title accepts no fill', untitled.dataset.state === 'refused'
  && untitled.shadowRoot.textContent.includes('data.title: the title is not the title of the application'), untitled.shadowRoot.textContent);

// The editable form submits the edited values as one action.
const form = mount('editable-form', FORM);
const submits = [];
form.addEventListener('mu-action', (event) => submits.push(event.detail));
form.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', arguments: { loan_id: 'L-0001' }, editable: EDITABLE };
const shelf = form.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
shelf.value = 'C-2';
shelf.dispatchEvent(new Event('input'));
form.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: submit sends the values', submits.length === 1 && submits[0].arguments.shelf === 'C-2'
  && submits[0].arguments.branch === 'North' && submits[0].arguments.loan_id === 'L-0001', JSON.stringify(submits));
check('editable-form: pending until the receipt', form.dataset.state === 'pending');
form.receipt({ id: submits[0].id, ok: true });
check('editable-form: done after the receipt', form.dataset.state === 'done');
// An edit while the request is pending: the receipt confirms only the old values.
const stale = mount('editable-form', FORM);
const staleSubmits = [];
stale.addEventListener('mu-action', (event) => staleSubmits.push(event.detail));
stale.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
const staleInput = stale.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
const staleStatus = () => stale.shadowRoot.querySelector('[role="status"]').textContent;
stale.shadowRoot.querySelector('form').requestSubmit();
staleInput.value = 'C-2';
staleInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
stale.receipt({ id: staleSubmits[0].id, ok: true });
check('editable-form: an edit while pending does not show done', stale.dataset.state === 'default'
  && staleStatus().includes('Save again'), `${stale.dataset.state} ${staleStatus()}`);
stale.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: the next save sends the edit', staleSubmits.length === 2 && staleSubmits[1].arguments.shelf === 'C-2',
  JSON.stringify(staleSubmits));
stale.receipt({ id: staleSubmits[1]?.id, ok: true });
check('editable-form: done after the receipt of the edit', stale.dataset.state === 'done', stale.dataset.state);
staleInput.value = 'D-3';
staleInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
check('editable-form: an edit after done lets the form save again', stale.dataset.state === 'default'
  && !staleStatus().startsWith('Done'), `${stale.dataset.state} ${staleStatus()}`);

// A bound argument cannot also be editable: the form would show one value and send a different value.
const pinned = mount('editable-form', { ...FORM, fields: [field('loan_id', 'Loan', 'L-9999')] });
let pinnedError = '';
try {
  pinned.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', arguments: { loan_id: 'L-0001' }, editable: { loan_id: 'Loan' } };
} catch (error) {
  pinnedError = error.message;
}
check('editable-form: a binding with a bound argument that is also editable is refused',
  pinnedError.includes('a bound argument cannot be editable: loan_id'), pinnedError);

// A second submit while the request is pending is refused. It does not change the values of the request.
const second = mount('editable-form', FORM);
const secondSubmits = [];
second.addEventListener('mu-action', (event) => secondSubmits.push(event.detail));
second.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
const secondInput = second.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
second.shadowRoot.querySelector('form').requestSubmit();
secondInput.value = 'C-2';
secondInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
second.shadowRoot.querySelector('form').requestSubmit();
second.receipt({ id: secondSubmits[0]?.id, ok: true });
check('editable-form: a refused second submit does not make the old receipt done', secondSubmits.length === 1
  && secondSubmits[0].arguments.shelf === 'B-14' && second.dataset.state === 'default', `${second.dataset.state} ${JSON.stringify(secondSubmits)}`);

// The application lists the field names that a request can carry. A fill cannot add a different argument.
const SNEAKY = { ...FORM, fields: [...FORM.fields, field('approved', 'Shelf note', 'true')] };
const refusedText = (node) => node.shadowRoot.textContent;
const sneaky = mount('editable-form', SNEAKY);
const sneakySubmits = [];
sneaky.addEventListener('mu-action', (event) => sneakySubmits.push(event.detail));
sneaky.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
sneaky.shadowRoot.querySelector('form')?.requestSubmit();
check('editable-form: a fill before the binding with an unlisted field is refused', sneaky.dataset.state === 'refused'
  && refusedText(sneaky).includes('data.fields: the application does not accept the field approved') && sneakySubmits.length === 0,
  `${sneaky.dataset.state} ${refusedText(sneaky)}`);
const late = document.createElement('mu-editable-form');
late.actor = AUTHOR;
stage.append(late);
late.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
late.fill = outer('editable-form', SNEAKY);
check('editable-form: a fill after the binding with an unlisted field is refused', late.dataset.state === 'refused'
  && refusedText(late).includes('the field approved'), `${late.dataset.state} ${refusedText(late)}`);
const unlisted = document.createElement('mu-editable-form');
unlisted.actor = AUTHOR;
stage.append(unlisted);
unlisted.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details' };
unlisted.fill = outer('editable-form', FORM);
check('editable-form: a binding with no editable map accepts no field', unlisted.dataset.state === 'refused'
  && refusedText(unlisted).includes('the field shelf'), `${unlisted.dataset.state} ${refusedText(unlisted)}`);

// The application gives the label of each field. A fill cannot show a different meaning for a name.
const relabeled = document.createElement('mu-editable-form');
relabeled.actor = AUTHOR;
stage.append(relabeled);
relabeled.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
relabeled.fill = outer('editable-form', { ...FORM, fields: [field('shelf', 'Approve the loan', 'B-14')] });
check('editable-form: a field label that is not the label of the application is refused', relabeled.dataset.state === 'refused'
  && refusedText(relabeled).includes('the label of the field shelf'), `${relabeled.dataset.state} ${refusedText(relabeled)}`);
// A person cannot edit a disabled field, so the form does not send its value.
const locked = mount('editable-form', { ...FORM, fields: [field('shelf', 'Shelf code', 'B-14'),
  fill('field', { name: 'branch', label: 'Branch', value: 'South', disabled: true })] });
const lockedSubmits = [];
locked.addEventListener('mu-action', (event) => lockedSubmits.push(event.detail));
locked.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
locked.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: a disabled field sends no value', lockedSubmits.length === 1
  && !Object.hasOwn(lockedSubmits[0].arguments, 'branch'), JSON.stringify(lockedSubmits));
// A new fill after done has new values. The old receipt does not confirm them.
const refill = mount('editable-form', FORM);
const refillSubmits = [];
refill.addEventListener('mu-action', (event) => refillSubmits.push(event.detail));
refill.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
refill.shadowRoot.querySelector('form').requestSubmit();
refill.receipt({ id: refillSubmits[0]?.id, ok: true });
refill.fill = outer('editable-form', { ...FORM, fields: [field('shelf', 'Shelf code', 'C-2'), field('branch', 'Branch', 'North')] });
refill.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: a new fill after done lets the form save again', refillSubmits.length === 2
  && refillSubmits[1].arguments.shelf === 'C-2', `${refill.dataset.state} ${JSON.stringify(refillSubmits)}`);

const formStyle = getComputedStyle(pinned.shadowRoot.querySelector('form'));
check('editable-form: the form has the card border', formStyle.borderTopStyle === 'solid'
  && parseFloat(formStyle.borderTopWidth) >= 1, `${formStyle.borderTopStyle} ${formStyle.borderTopWidth}`);

// The confirm step and the receipt reference. The expected results come from catalog/README.md#actions.
const CANCEL_LOAN = { tool: 'library.cancel', label: 'Cancel loan', arguments: { loan_id: 'L-0001' },
  confirm: { message: 'Cancel the loan L-0001? You cannot undo this.', label: 'Yes, cancel the loan' } };
const asked = mount('action-button', { label: 'Cancel loan' });
const askedEvents = [];
asked.addEventListener('mu-action', (event) => askedEvents.push(event.detail));
asked.action = CANCEL_LOAN;
const askedControl = asked.shadowRoot.querySelector('button[part="button"]');
const step = (node) => node.shadowRoot.querySelector('[part="confirm"]');
const stepButtons = (node) => [...step(node).querySelectorAll('button')].map((item) => item.textContent);
check('action-button: no confirm step before a press', step(asked) === null && asked.dataset.state === 'default', asked.dataset.state);
askedControl.click();
check('action-button: a press shows the confirm step and sends no action', askedEvents.length === 0
  && asked.dataset.state === 'confirm' && step(asked)?.getAttribute('role') === 'group'
  && step(asked).getAttribute('aria-label') === CANCEL_LOAN.confirm.message
  && askedControl.getAttribute('aria-disabled') === 'true', `${asked.dataset.state} ${askedEvents.length}`);
check('action-button: the confirm step has Cancel and the confirm label', step(asked)
  && JSON.stringify(stepButtons(asked)) === JSON.stringify(['Cancel', 'Yes, cancel the loan']), step(asked) && stepButtons(asked));
check('action-button: the focus goes to Cancel', asked.shadowRoot.activeElement?.textContent === 'Cancel',
  asked.shadowRoot.activeElement?.textContent);
askedControl.click();
check('action-button: a second press while the step shows sends no action', askedEvents.length === 0
  && asked.shadowRoot.querySelectorAll('[part="confirm"]').length === 1);
step(asked).querySelector('button').click();
check('action-button: Cancel closes the step and sends no action', askedEvents.length === 0 && step(asked) === null
  && asked.dataset.state === 'default' && askedControl.getAttribute('aria-disabled') === 'false'
  && asked.shadowRoot.activeElement === askedControl, `${asked.dataset.state} ${askedEvents.length}`);
askedControl.click();
step(asked).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('action-button: Escape closes the step and sends no action', askedEvents.length === 0 && step(asked) === null
  && asked.dataset.state === 'default', asked.dataset.state);
askedControl.click();
step(asked).querySelectorAll('button')[1].click();
check('action-button: confirm sends the action', askedEvents.length === 1 && askedEvents[0].tool === 'library.cancel'
  && askedEvents[0].arguments.loan_id === 'L-0001' && step(asked) === null && asked.dataset.state === 'pending'
  && asked.shadowRoot.activeElement === askedControl, `${asked.dataset.state} ${JSON.stringify(askedEvents)}`);
const reference = () => asked.shadowRoot.querySelector('[part="reference"]')?.textContent ?? null;
check('action-button: an overlong reference is refused and the action stays pending',
  !asked.receipt({ id: askedEvents[0].id, ok: true, reference: 'R'.repeat(81) }) && asked.dataset.state === 'pending'
  && reference() === null, `${asked.dataset.state} ${reference()}`);
check('action-button: a reference with markup shows as text', asked.receipt({ id: askedEvents[0].id, ok: true,
  message: 'Cancelled.', reference: MARKUP.slice(0, 80) }) && asked.dataset.state === 'done'
  && reference() === 'Reference: ' + MARKUP.slice(0, 80) && deepQuery(asked, 'img, script').length === 0, reference());
const plainReceipt = mount('action-button', { label: 'Renew' });
const plainEvents = [];
plainReceipt.addEventListener('mu-action', (event) => plainEvents.push(event.detail));
plainReceipt.action = { tool: 'library.renew', label: 'Renew' };
plainReceipt.shadowRoot.querySelector('button').click();
check('action-button: no confirm step without confirm in the binding', plainEvents.length === 1 && step(plainReceipt) === null);
plainReceipt.receipt({ id: plainEvents[0].id, ok: true, reference: 'R'.repeat(80) });
check('action-button: a reference of 80 characters shows', plainReceipt.shadowRoot.querySelector('[part="reference"]')?.textContent
  === 'Reference: ' + 'R'.repeat(80));
const noReference = mount('action-button', { label: 'Renew' });
const noReferenceEvents = [];
noReference.addEventListener('mu-action', (event) => noReferenceEvents.push(event.detail));
noReference.action = { tool: 'library.renew', label: 'Renew' };
noReference.shadowRoot.querySelector('button').click();
noReference.receipt({ id: noReferenceEvents[0].id, ok: true, message: 'Renewed.' });
check('action-button: a receipt with no reference shows no reference', noReference.dataset.state === 'done'
  && noReference.shadowRoot.querySelector('[part="reference"]') === null
  && noReference.shadowRoot.querySelector('[role="status"]').textContent === 'Done: Renewed.');
const markedStep = mount('action-button', { label: 'Cancel loan' });
markedStep.action = { ...CANCEL_LOAN, confirm: { message: MARKUP.slice(0, 200), label: MARKUP.slice(0, 40) } };
markedStep.shadowRoot.querySelector('button').click();
check('action-button: markup in the confirm step shows as text', step(markedStep)?.textContent.includes(MARKUP.slice(0, 40))
  && deepQuery(markedStep, 'img, script').length === 0, step(markedStep)?.textContent);

// The editable form shows the confirm step before it sends the values.
const askedForm = mount('editable-form', FORM);
const askedSubmits = [];
askedForm.addEventListener('mu-action', (event) => askedSubmits.push(event.detail));
askedForm.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', arguments: { loan_id: 'L-0001' },
  editable: EDITABLE, confirm: { message: 'Move the loan L-0001 to a new shelf?', label: 'Yes, move it' } };
const askedInput = askedForm.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
askedInput.value = 'C-2';
askedInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
askedForm.shadowRoot.querySelector('form').requestSubmit();
check('editable-form: a submit shows the confirm step and sends no action', askedSubmits.length === 0
  && askedForm.dataset.state === 'confirm' && step(askedForm)?.getAttribute('aria-label') === 'Move the loan L-0001 to a new shelf?'
  && JSON.stringify(stepButtons(askedForm)) === JSON.stringify(['Cancel', 'Yes, move it']), askedForm.dataset.state);
askedInput.value = 'C-3';
askedInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
check('editable-form: an edit closes the confirm step and sends no action', askedSubmits.length === 0
  && step(askedForm) === null && askedForm.dataset.state === 'default', askedForm.dataset.state);
askedForm.shadowRoot.querySelector('form').requestSubmit();
step(askedForm).querySelector('button').click();
check('editable-form: Cancel sends no action', askedSubmits.length === 0 && askedForm.dataset.state === 'default');
askedForm.shadowRoot.querySelector('form').requestSubmit();
step(askedForm).querySelectorAll('button')[1].click();
check('editable-form: confirm sends the values', askedSubmits.length === 1 && askedSubmits[0].arguments.shelf === 'C-3'
  && askedSubmits[0].arguments.loan_id === 'L-0001' && askedForm.dataset.state === 'pending', JSON.stringify(askedSubmits));
askedForm.receipt({ id: askedSubmits[0].id, ok: true, reference: 'MOVE-0001' });
check('editable-form: the receipt reference shows', askedForm.dataset.state === 'done'
  && askedForm.shadowRoot.querySelector('[part="reference"]')?.textContent === 'Reference: MOVE-0001', askedForm.dataset.state);
// These checks moved the focus. Move the start point of Tab to the top of the page, before the keyboard targets.
const top = document.createElement('span');
top.tabIndex = -1;
document.getElementById('keyboard').before(top);
top.focus();
top.blur();

// Media modes.
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const article = mount('card', LOAN).shadowRoot.querySelector('article');
const cardStyle = getComputedStyle(article);
const fresh = mount('action-button', VALID['action-button']);
fresh.action = { tool: 'library.renew', label: 'Renew' };
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
if (mode === 'dark') check('dark: the card uses the dark surface', cardStyle.backgroundColor === 'rgb(23, 27, 33)', cardStyle.backgroundColor);
if (mode === 'light') check('light: the card uses the light surface', cardStyle.backgroundColor === 'rgb(255, 255, 255)', cardStyle.backgroundColor);
check('no markup ran', window.muUnsafe === undefined);

// Decision 0003. Each element has an open shadow root. A custom property that an application sets on a host
// reaches the styles inside. A rule of the page does not reach the elements inside.
for (const name of Object.keys(TAGS)) {
  check(`${name}: the shadow root is open`, mount(name, VALID[name]).shadowRoot?.mode === 'open');
}
if (mode === 'light') {
  const themed = mount('card', LOAN);
  themed.style.setProperty('--mu-color-surface', 'rgb(1, 2, 3)');
  check('card: a custom property on the host changes the style inside',
    getComputedStyle(themed.shadowRoot.querySelector('article')).backgroundColor === 'rgb(1, 2, 3)');
  const rule = new CSSStyleSheet();
  rule.replaceSync('article { background: rgb(9, 9, 9) !important; }');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, rule];
  const shielded = getComputedStyle(mount('card', LOAN).shadowRoot.querySelector('article')).backgroundColor;
  const hosted = mount('card', LOAN);
  rule.replaceSync('mu-card::part(card) { background: rgb(7, 7, 7); }');
  const parted = getComputedStyle(hosted.shadowRoot.querySelector('article')).backgroundColor;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== rule);
  check('card: a ::part rule of the page reaches the card part', parted === 'rgb(7, 7, 7)', parted);
  check('card: a rule of the page does not reach the shadow tree', shielded === 'rgb(255, 255, 255)', shielded);
}

// The keyboard target for the runner.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-action-button');
target.fill = outer('action-button', { label: 'Keyboard target' });
target.action = { tool: 'library.renew', label: 'Keyboard target' };
let presses = 0;
target.addEventListener('mu-action', (event) => { presses += 1; target.receipt({ id: event.detail.id, ok: false }); });
keyboard.append(target);
// The runner presses Enter in a field of this form. The form must submit one time.
const enterForm = document.createElement('mu-editable-form');
enterForm.actor = AUTHOR;
enterForm.fill = outer('editable-form', FORM);
enterForm.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
let formSubmits = 0;
enterForm.addEventListener('mu-action', () => { formSubmits += 1; });
keyboard.append(enterForm);
window.muFocusField = () => { enterForm.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input').focus(); return true; };
window.muFormSubmits = () => formSubmits;
// The runner opens the confirm step of this button and this form with the keyboard.
const confirmTarget = document.createElement('mu-action-button');
confirmTarget.fill = outer('action-button', { label: 'Confirm target' });
confirmTarget.action = { tool: 'library.cancel', label: 'Confirm target', confirm: { message: 'Cancel the loan? You cannot undo this.', label: 'Yes, cancel' } };
let confirmPresses = 0;
confirmTarget.addEventListener('mu-action', (event) => { confirmPresses += 1; confirmTarget.receipt({ id: event.detail.id, ok: false }); });
keyboard.append(confirmTarget);
const confirmForm = document.createElement('mu-editable-form');
confirmForm.actor = AUTHOR;
confirmForm.fill = outer('editable-form', { ...FORM, title: 'Confirm form' });
confirmForm.action = { tool: 'library.update_loan', label: 'Save', title: 'Confirm form', editable: EDITABLE,
  confirm: { message: 'Save the new shelf?', label: 'Yes, save' } };
let confirmFormSubmits = 0;
confirmForm.addEventListener('mu-action', (event) => { confirmFormSubmits += 1; confirmForm.receipt({ id: event.detail.id, ok: false }); });
keyboard.append(confirmForm);
window.muFocusConfirm = () => { confirmTarget.shadowRoot.querySelector('button').focus(); return true; };
window.muFocusConfirmField = () => { confirmForm.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input').focus(); return true; };
window.muConfirm = () => ({ presses: confirmPresses, state: confirmTarget.dataset.state, submits: confirmFormSubmits,
  formState: confirmForm.dataset.state });
window.muPresses = () => presses;
window.muChecks = { mode, results };
