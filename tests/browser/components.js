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
  'form-card': { title: 'Membership form', submit_label: 'Send changes', sections: [fill('form-section', { title: 'Member',
    lines: [fill('form-line', { line: '1.1', field: field('member_name', 'Name', 'Robin Vale') })] })] },
};
const TAGS = { card: 'mu-card', 'action-button': 'mu-action-button', 'editable-form': 'mu-editable-form', 'card-grid': 'mu-card-grid',
  'form-card': 'mu-form-card' };

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
  'form-card': { title: MARKUP, submit_label: MARKUP.slice(0, 40), sections: [fill('form-section', { title: MARKUP.slice(0, 80), lines: [
    fill('form-line', { line: MARKUP.slice(0, 12), field: fill('field', { name: 'note', label: MARKUP.slice(0, 80), value: MARKUP.slice(0, 200), hint: MARKUP }) }),
    fill('form-line', { read_only: true, field: fill('long-text-field', { name: 'summary', label: MARKUP.slice(0, 80), value: MARKUP }) }),
    fill('form-line', { field: fill('choice-field', { name: 'plan', label: MARKUP.slice(0, 80), value: MARKUP.slice(0, 80), choices: [MARKUP.slice(0, 80)] }) }),
  ] })] },
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

// The citation component (catalog/citation.json). The source and the locator come from the citation slot, so
// the locator rule of the slot applies. The locator shows as text and opens only after a click.
const citation = (slots, data = { quote: 'A short loan can get one renewal.' }, actor = AUTHOR) => {
  const node = document.createElement('mu-citation');
  stage.append(node);
  node.actor = actor;
  node.fill = { ...fill('citation', data), slots };
  return node;
};
const source = citation(CITED);
const sourceText = deepText(source);
const sourceOpen = source.shadowRoot.querySelector('[part="open"]');
const sourceAsks = [];
source.addEventListener('mu-open', (event) => sourceAsks.push(event.detail.locator));
check('citation: renders a valid fill', source.dataset.state === 'default' && source.fill !== null, source.dataset.state);
check('citation: shows the source, the locator, the author and the quote as text', sourceText.includes('Source: Synthetic loan rules')
  && sourceText.includes('https://example.org/rules/loans') && sourceText.includes('Author: agent agent-check (Checker)')
  && sourceText.includes('A short loan can get one renewal.'), sourceText.slice(0, 240));
check('citation: is a group named Citation', source.shadowRoot.querySelector('[role="group"]')?.getAttribute('aria-label') === 'Citation');
check('citation: the locator makes no link', deepQuery(source, 'a, link, iframe, img').length === 0);
check('citation: the open button is a native button that names the source', sourceOpen?.localName === 'button' && sourceOpen.tabIndex === 0
  && sourceOpen.getAttribute('aria-label') === 'Open source: Synthetic loan rules');
const citationOpened = [];
window.open = (...args) => { citationOpened.push(args); return null; };
check('citation: the locator does not open before a click', sourceAsks.length === 0 && citationOpened.length === 0);
sourceOpen?.click();
window.open = realOpen;
check('citation: a click opens the locator with no opener', sourceAsks.length === 1 && sourceAsks[0] === 'https://example.org/rules/loans'
  && citationOpened.length === 1 && citationOpened[0][0] === 'https://example.org/rules/loans' && citationOpened[0][1] === '_blank'
  && citationOpened[0][2] === 'noopener,noreferrer', JSON.stringify(citationOpened));
const unsourced = citation({ authorship: AUTHOR });
check('citation: no citation slot shows the empty state', unsourced.dataset.state === 'empty'
  && unsourced.shadowRoot.textContent.includes('No source given.') && !unsourced.shadowRoot.querySelector('button'), unsourced.shadowRoot.textContent);
check('citation: the empty state still shows the author and the quote', unsourced.shadowRoot.textContent.includes('Author: agent agent-check')
  && unsourced.shadowRoot.textContent.includes('A short loan can get one renewal.'), unsourced.shadowRoot.textContent);
const refusals = [];
const noLocator = document.createElement('mu-citation');
noLocator.addEventListener('mu-refused', (event) => refusals.push(...event.detail.errors));
stage.append(noLocator);
noLocator.actor = AUTHOR;
noLocator.fill = { ...fill('citation', {}), slots: { authorship: AUTHOR, citation: { source: 'Synthetic loan rules' } } };
check('citation: a missing locator shows a clear refusal', noLocator.dataset.state === 'refused' && noLocator.fill === null
  && noLocator.shadowRoot.textContent === 'Refused citation: the locator is missing.'
  && noLocator.shadowRoot.querySelector('[role="status"]') !== null, noLocator.shadowRoot.textContent);
check('citation: the refusal event keeps the error of the validator', refusals.includes('slots.citation: missing key locator'), refusals.join('; '));
for (const locator of ['http://example.org/rules', 'javascript:alert(1)', 'https://person@example.org/rules', 'https://example.org/‮gnp.exe']) {
  const bad = citation({ authorship: AUTHOR, citation: { source: 'Synthetic loan rules', locator } });
  check(`citation: refuses the locator ${JSON.stringify(locator)} with a clear text`, bad.dataset.state === 'refused' && bad.fill === null
    && bad.shadowRoot.textContent === 'Refused citation: the locator is not a safe https: address.', bad.shadowRoot.textContent);
}
const unauthored = citation({ citation: CITED.citation });
check('citation: refuses a fill with no authorship slot', unauthored.dataset.state === 'refused'
  && unauthored.shadowRoot.textContent.includes('slots.authorship: a required slot is missing'), unauthored.shadowRoot.textContent);
const markedCitation = citation({ authorship: { type: 'agent', id: MARKUP.slice(0, 128), name: MARKUP.slice(0, 80) },
  citation: { source: MARKUP.slice(0, 120), locator: 'https://example.org/a?q=<script>x</script>' } }, { quote: MARKUP }, { type: 'agent', id: MARKUP.slice(0, 128), name: MARKUP.slice(0, 80) });
const markedCitationText = deepText(markedCitation);
check('citation: markup in each text field shows as text', markedCitation.dataset.state === 'default'
  && deepQuery(markedCitation, 'img, script, a').length === 0 && window.muUnsafe === undefined
  && markedCitationText.includes('Source: ' + MARKUP.slice(0, 40)) && markedCitationText.includes('Author: agent ' + MARKUP.slice(0, 40))
  && markedCitationText.includes('https://example.org/a?q=<script>x</script>'), markedCitationText.slice(0, 240));
const citationSheets = source.shadowRoot.adoptedStyleSheets.slice(1);
const citationTokens = new Set(citationSheets.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ').match(/--mu-[a-z0-9-]+/g) ?? []);
const citationExtra = [...citationTokens].filter((token) => !declared('citation').has(token));
check('citation: the styles use only declared tokens', citationExtra.length === 0, citationExtra.join(' '));
check('citation: the styles have a forced colors rule', citationSheets.some((item) => [...item.cssRules].some((rule) => rule.cssText.includes('forced-colors'))));

// The excerpt component (catalog/excerpt.json). The passage shows as text. The span shows in a mark element with
// a style that is not color only, and again as text. Span positions count code points of the passage.
const PASSAGE = 'A short loan can get one renewal of seven days.';
const excerpt = (data, slots = CITED, actor = AUTHOR) => {
  const node = document.createElement('mu-excerpt');
  stage.append(node);
  node.actor = actor;
  node.fill = { ...fill('excerpt', data), slots };
  return node;
};
const passage = excerpt({ passage: PASSAGE, span_start: 13, span_end: 32 });
const passageText = deepText(passage);
const passageMark = passage.shadowRoot.querySelectorAll('mark');
check('excerpt: renders a valid fill', passage.dataset.state === 'default' && passage.fill !== null, passage.dataset.state);
check('excerpt: is a group named Source excerpt', passage.shadowRoot.querySelector('[role="group"]')?.getAttribute('aria-label') === 'Source excerpt');
check('excerpt: the passage shows in full as text', passage.shadowRoot.querySelector('[part="passage"]')?.textContent === PASSAGE,
  passage.shadowRoot.querySelector('[part="passage"]')?.textContent);
check('excerpt: one mark element holds the span', passageMark.length === 1 && passageMark[0].textContent === 'can get one renewal',
  passageMark[0]?.textContent);
const markStyle = passageMark[0] ? getComputedStyle(passageMark[0]) : null;
check('excerpt: the mark has a style that is not color only', markStyle !== null && markStyle.textDecorationLine.includes('underline')
  && Number(markStyle.fontWeight) >= 600, markStyle && `${markStyle.textDecorationLine} ${markStyle.fontWeight}`);
check('excerpt: the span also shows as text', passage.shadowRoot.querySelector('[part="span"]')?.textContent === 'Marked text: can get one renewal',
  passage.shadowRoot.querySelector('[part="span"]')?.textContent);
check('excerpt: shows the source, the locator and the author as text', passageText.includes('Source: Synthetic loan rules')
  && passageText.includes('https://example.org/rules/loans') && passageText.includes('Author: agent agent-check (Checker)'), passageText.slice(0, 240));
check('excerpt: the locator makes no link', deepQuery(passage, 'a, link, iframe, img').length === 0);
const excerptAsks = [];
passage.addEventListener('mu-open', (event) => { excerptAsks.push(event.detail.locator); event.preventDefault(); });
passage.shadowRoot.querySelector('[part="open"]')?.click();
check('excerpt: a click on the open button asks to open the locator', excerptAsks.length === 1 && excerptAsks[0] === 'https://example.org/rules/loans',
  excerptAsks.join(' '));
const edges = excerpt({ passage: PASSAGE, span_start: 0, span_end: [...PASSAGE].length });
check('excerpt: a span can hold the full passage', edges.dataset.state === 'default' && edges.shadowRoot.querySelector('mark')?.textContent === PASSAGE);
// A supplementary character is one code point and two UTF-16 units. The span counts code points.
const wide = excerpt({ passage: 'Shelf 𝔸 holds the maps.', span_start: 6, span_end: 7 });
check('excerpt: span positions count code points', wide.dataset.state === 'default' && wide.shadowRoot.querySelector('mark')?.textContent === '𝔸',
  wide.shadowRoot.querySelector('mark')?.textContent ?? wide.shadowRoot.textContent);
const wideEnd = excerpt({ passage: 'Shelf 𝔸', span_start: 6, span_end: 7 });
check('excerpt: a span to the last code point is in the passage', wideEnd.dataset.state === 'default', wideEnd.shadowRoot.textContent);
for (const [data, error, words] of [
  [{ passage: PASSAGE, span_start: 13, span_end: 48 }, 'data.span_end: outside the passage', 'the span is outside the passage.'],
  [{ passage: 'Shelf 𝔸', span_start: 6, span_end: 8 }, 'data.span_end: outside the passage', 'the span is outside the passage.'],
  [{ passage: PASSAGE, span_start: 47, span_end: 48 }, 'data.span_end: outside the passage', 'the span is outside the passage.'],
  [{ passage: PASSAGE, span_start: 20, span_end: 20 }, 'data.span_start: must be less than span_end', 'the span is empty.'],
  [{ passage: PASSAGE, span_start: 20, span_end: 10 }, 'data.span_start: must be less than span_end', 'the span is empty.'],
]) {
  const node = document.createElement('mu-excerpt');
  const errors = [];
  node.addEventListener('mu-refused', (event) => errors.push(...event.detail.errors));
  stage.append(node);
  node.actor = AUTHOR;
  node.fill = { ...fill('excerpt', data), slots: CITED };
  check(`excerpt: refuses the span ${data.span_start} to ${data.span_end} of ${JSON.stringify(data.passage.slice(0, 12))}`,
    node.dataset.state === 'refused' && node.fill === null && errors.includes(error)
    && node.shadowRoot.textContent === `Refused excerpt: ${words}` && node.shadowRoot.querySelector('[role="status"]') !== null
    && !node.shadowRoot.querySelector('mark'), `${errors.join('; ')} | ${node.shadowRoot.textContent}`);
}
const unlocated = excerpt({ passage: PASSAGE, span_start: 0, span_end: 7 }, { authorship: AUTHOR });
check('excerpt: refuses a fill with no citation slot', unlocated.dataset.state === 'refused'
  && unlocated.shadowRoot.textContent === 'Refused excerpt: the source and the locator are missing.', unlocated.shadowRoot.textContent);
const badLocator = excerpt({ passage: PASSAGE, span_start: 0, span_end: 7 }, { authorship: AUTHOR, citation: { ...CITED.citation, locator: 'javascript:alert(1)' } });
check('excerpt: refuses a locator that is not a safe https: address', badLocator.dataset.state === 'refused'
  && badLocator.shadowRoot.textContent === 'Refused excerpt: the locator is not a safe https: address.', badLocator.shadowRoot.textContent);
const unauthoredExcerpt = excerpt({ passage: PASSAGE, span_start: 0, span_end: 7 }, { citation: CITED.citation });
check('excerpt: refuses a fill with no authorship slot', unauthoredExcerpt.dataset.state === 'refused'
  && unauthoredExcerpt.shadowRoot.textContent.includes('slots.authorship: a required slot is missing'), unauthoredExcerpt.shadowRoot.textContent);
// Markup in the passage, in the span and around the span shows as text. No element of the markup appears.
const marked = excerpt({ passage: `Before ${MARKUP} after.`, span_start: 7, span_end: 7 + [...MARKUP].length });
check('excerpt: markup in the passage shows as text and makes no element', marked.dataset.state === 'default'
  && deepQuery(marked, 'img, script, a, b').length === 0 && window.muUnsafe === undefined
  && marked.shadowRoot.querySelector('mark')?.textContent === MARKUP
  && marked.shadowRoot.querySelector('[part="passage"]')?.textContent === `Before ${MARKUP} after.`
  && marked.shadowRoot.querySelector('[part="passage"]').children.length === 1, marked.shadowRoot.textContent.slice(0, 240));
const halfMarked = excerpt({ passage: '<b>bold</b> text', span_start: 1, span_end: 9 });
check('excerpt: a span that cuts a tag shows the tag as text', halfMarked.dataset.state === 'default' && deepQuery(halfMarked, 'b').length === 0
  && halfMarked.shadowRoot.querySelector('mark')?.textContent === 'b>bold</', halfMarked.shadowRoot.textContent);
const excerptSheets = passage.shadowRoot.adoptedStyleSheets.slice(1);
const excerptTokens = new Set(excerptSheets.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ').match(/--mu-[a-z0-9-]+/g) ?? []);
const excerptExtra = [...excerptTokens].filter((token) => !declared('excerpt').has(token));
check('excerpt: the styles use only declared tokens', excerptExtra.length === 0, excerptExtra.join(' '));
check('excerpt: the styles have a forced colors rule for the mark', excerptSheets.some((item) => [...item.cssRules]
  .some((rule) => rule.cssText.includes('forced-colors') && rule.cssText.includes('mark'))));
if (matchMedia('(forced-colors: active)').matches) {
  const forced = getComputedStyle(passageMark[0]);
  check('excerpt: in forced colors the mark keeps its underline', forced.textDecorationLine.includes('underline'), forced.textDecorationLine);
}

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
// Typed edits (catalog/README.md, "Typed edits"). Principle 4: each form edit records its type.
const EDITOR = { type: 'human', id: 'person-ana' };
const TYPED_FORM = { ...FORM, fields: [fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', typed: true }),
  field('branch', 'Branch', 'North')] };
const TYPED_BINDING = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE,
  typed: ['shelf'], editor: EDITOR };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const typedParts = (node) => {
  const inner = node.shadowRoot.querySelector('mu-field').shadowRoot;
  return { input: inner.querySelector('input'), group: inner.querySelector('fieldset'), radios: [...inner.querySelectorAll('input[type="radio"]')],
    text: inner.textContent };
};
const typeIn = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};
const choose = (radio) => radio.click();
function typedForm(binding = TYPED_BINDING, data = TYPED_FORM) {
  const node = mount('editable-form', data);
  const sent = [];
  node.addEventListener('mu-action', (event) => sent.push(event.detail));
  node.action = binding;
  return { node, sent, ...typedParts(node) };
}

{
  const { node, sent, input, group, radios } = typedForm();
  check('typed edit: the form with a typed field renders', node.dataset.state === 'default', `${node.dataset.state} ${node.shadowRoot.textContent}`);
  check('typed edit: no edit type before a change', group && group.hidden, group?.hidden);
  typeIn(input, 'C-2');
  check('typed edit: a change asks for the edit type', !group.hidden && group.getAttribute('aria-label') === null
    && group.querySelector('legend')?.textContent === 'Edit type'
    && radios.map((radio) => radio.labels[0]?.textContent.split(':')[0]).join('|') === 'Judgment|Correction|Override',
  radios.map((radio) => radio.labels[0]?.textContent).join('|'));
  check('typed edit: the three types are one radio group', new Set(radios.map((radio) => radio.name)).size === 1
    && radios.map((radio) => radio.value).join('|') === 'judgment|correction|override', radios.map((radio) => radio.name + radio.value).join('|'));
  typeIn(input, 'B-14');
  check('typed edit: the old value again closes the group', group.hidden && radios.every((radio) => !radio.checked), group.hidden);
  node.shadowRoot.querySelector('form').requestSubmit();
  check('typed edit: an unchanged typed field sends no edit', sent.length === 1 && Array.isArray(sent[0].edits) && sent[0].edits.length === 0,
    JSON.stringify(sent));
}

// Each edit type goes in the request with the old value, the new value, the actor id and the time.
for (const [index, type] of ['judgment', 'correction', 'override'].entries()) {
  const { node, sent, input, radios } = typedForm();
  typeIn(input, 'C-2');
  choose(radios[index]);
  const before = Date.now();
  node.shadowRoot.querySelector('form').requestSubmit();
  const edit = sent[0]?.edits?.[0];
  check(`typed edit: ${type} goes in the request`, sent.length === 1 && sent[0].edits.length === 1 && edit.field === 'shelf'
    && edit.type === type && edit.old_value === 'B-14' && edit.new_value === 'C-2' && sent[0].arguments.shelf === 'C-2'
    && edit.actor.type === 'human' && edit.actor.id === 'person-ana' && ISO.test(edit.time)
    && Math.abs(Date.parse(edit.time) - before) < 60000, JSON.stringify(sent));
  check(`typed edit: ${type} is pending until the receipt`, node.dataset.state === 'pending', node.dataset.state);
  node.receipt({ id: sent[0].id, ok: true });
  check(`typed edit: ${type} is done after the receipt`, node.dataset.state === 'done', node.dataset.state);
}

// A changed typed field with no type sends no action. The field tells why, and the focus goes to the group.
{
  const { node, sent, input, group, radios, } = typedForm();
  typeIn(input, 'C-2');
  node.shadowRoot.querySelector('form').requestSubmit();
  const inner = node.shadowRoot.querySelector('mu-field').shadowRoot;
  const reason = inner.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent;
  check('typed edit: a missing type sends no action', sent.length === 0 && node.dataset.state === 'default', `${sent.length} ${node.dataset.state}`);
  check('typed edit: a missing type shows the reason as text', reason === 'Choose an edit type.'
    && group.getAttribute('aria-invalid') === 'true', `${reason} ${group.getAttribute('aria-invalid')}`);
  check('typed edit: a missing type moves the focus to the group', inner.activeElement === radios[0], inner.activeElement?.value);
  choose(radios[1]);
  check('typed edit: a type removes the reason', !inner.textContent.includes('Choose an edit type.')
    && group.getAttribute('aria-invalid') !== 'true', inner.textContent);
  node.shadowRoot.querySelector('form').requestSubmit();
  check('typed edit: the submit after the type sends the edit', sent.length === 1 && sent[0].edits[0]?.type === 'correction', JSON.stringify(sent));
}

// A change of the type while the request is pending makes the values new, so the receipt does not show done.
{
  const { node, sent, input, radios } = typedForm();
  typeIn(input, 'C-2');
  choose(radios[0]);
  node.shadowRoot.querySelector('form').requestSubmit();
  choose(radios[2]);
  node.receipt({ id: sent[0].id, ok: true });
  check('typed edit: a new type while pending does not show done', node.dataset.state === 'default', node.dataset.state);
  node.shadowRoot.querySelector('form').requestSubmit();
  check('typed edit: the next save sends the new type', sent.length === 2 && sent[1].edits[0].type === 'override', JSON.stringify(sent));
}

// The application gives the typed names. A fill cannot remove the type of an edit or add one.
{
  const untyped = mount('editable-form', FORM);
  untyped.action = TYPED_BINDING;
  check('typed edit: a fill without the typed flag of the application is refused', untyped.dataset.state === 'refused'
    && refusedText(untyped).includes('data.fields: the edit type of the field shelf is not the rule of the application'), refusedText(untyped));
  const extra = mount('editable-form', TYPED_FORM);
  extra.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
  check('typed edit: a binding with no typed list accepts no typed field', extra.dataset.state === 'refused'
    && refusedText(extra).includes('the edit type of the field shelf'), refusedText(extra));
  const plain = mount('editable-form', FORM);
  const plainSent = [];
  plain.addEventListener('mu-action', (event) => plainSent.push(event.detail));
  plain.action = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: EDITABLE };
  plain.shadowRoot.querySelector('form').requestSubmit();
  check('typed edit: a form with no typed field sends no edits list', plainSent.length === 1 && !('edits' in plainSent[0]), JSON.stringify(plainSent));
}

// A disabled typed field has no editor, so it has no edit.
{
  const data = { ...FORM, fields: [field('branch', 'Branch', 'North'),
    fill('field', { name: 'shelf', label: 'Shelf code', value: 'B-14', typed: true, disabled: true })] };
  const { node, sent } = typedForm(TYPED_BINDING, data);
  node.shadowRoot.querySelector('form').requestSubmit();
  check('typed edit: a disabled typed field sends no edit', sent.length === 1 && sent[0].edits.length === 0
    && !Object.hasOwn(sent[0].arguments, 'shelf'), JSON.stringify(sent));
}

// A form with each input type (catalog/editable-form.json names each field contract).
const INPUT_FORM = { title: 'Loan details', submit_label: 'Save', fields: [
  field('shelf', 'Shelf code', 'B-14'),
  fill('long-text-field', { name: 'note', label: 'Note', value: 'Keep dry.' }),
  fill('number-field', { name: 'copies', label: 'Copies', value: 3, minimum: 1, maximum: 12, typed: true }),
  fill('date-field', { name: 'due', label: 'Due date', value: '2026-12-01', earliest: '2026-11-01', typed: true }),
  fill('choice-field', { name: 'branch', label: 'Branch', value: 'North', choices: ['North', 'South', 'Harbor'] }),
] };
const INPUT_EDITABLE = { shelf: 'Shelf code', note: 'Note', copies: 'Copies', due: 'Due date', branch: 'Branch' };
const INPUT_BINDING = { tool: 'library.update_loan', label: 'Save', title: 'Loan details', editable: INPUT_EDITABLE,
  typed: ['copies', 'due'], editor: EDITOR };
const inputOf = (node, name) => {
  const inner = [...node.shadowRoot.querySelectorAll('[data-state]')].find((item) => item.fill?.data.name === name);
  return { node: inner, root: inner.shadowRoot, input: inner.shadowRoot.querySelector('input:not([type="radio"]), textarea'),
    radios: [...inner.shadowRoot.querySelectorAll('[part="choices"] input')],
    types: [...inner.shadowRoot.querySelectorAll('[part="edit-type"] input')] };
};
{
  const { node, sent } = typedForm(INPUT_BINDING, INPUT_FORM);
  check('input form: a form with each input type renders', node.dataset.state === 'default'
    && ['mu-field', 'mu-long-text-field', 'mu-number-field', 'mu-date-field', 'mu-choice-field'].every((tag) => node.shadowRoot.querySelector(tag)),
  `${node.dataset.state} ${node.shadowRoot.textContent.slice(0, 200)}`);
  node.shadowRoot.querySelector('form').requestSubmit();
  check('input form: the values have the type of each contract', sent.length === 1 && sent[0].arguments.copies === 3
    && sent[0].arguments.due === '2026-12-01' && sent[0].arguments.branch === 'North' && sent[0].arguments.note === 'Keep dry.'
    && sent[0].edits.length === 0, JSON.stringify(sent));
  node.receipt({ id: sent[0].id, ok: true });
  // A number that is not valid sends no action. The field tells why and takes the focus.
  const copies = inputOf(node, 'copies');
  typeIn(copies.input, 'seven');
  node.shadowRoot.querySelector('form').requestSubmit();
  const problem = copies.root.querySelector('[part="problem"]').textContent;
  check('input form: a value that is not a number sends no action', sent.length === 1, sent.length);
  check('input form: the reason shows as text and the focus goes to the field', problem === 'Give a number, for example 12 or 12.5.'
    && copies.root.activeElement === copies.input && copies.input.getAttribute('aria-invalid') === 'true', `${problem} ${copies.root.activeElement?.tagName}`);
  typeIn(copies.input, '40');
  node.shadowRoot.querySelector('form').requestSubmit();
  check('input form: a number outside the range sends no action', sent.length === 1
    && copies.root.querySelector('[part="problem"]').textContent === 'Give a number from 1 to 12.', copies.root.textContent);
  const due = inputOf(node, 'due');
  typeIn(copies.input, '4');
  typeIn(due.input, '2026-10-31');
  node.shadowRoot.querySelector('form').requestSubmit();
  check('input form: a date outside the range sends no action', sent.length === 1
    && due.root.querySelector('[part="problem"]').textContent === 'Give a date on or after 2026-11-01.', due.root.textContent);
  // Valid values of a typed number and a typed date need their edit types. Then the edits have the contract types.
  typeIn(due.input, '2026-12-08');
  node.shadowRoot.querySelector('form').requestSubmit();
  check('input form: a typed number with no edit type sends no action', sent.length === 1
    && copies.root.querySelector('[part="reason"]').textContent === 'Choose an edit type.', copies.root.textContent);
  copies.types[1].click();
  due.types[2].click();
  inputOf(node, 'branch').radios[1].click();
  const note = inputOf(node, 'note');
  typeIn(note.input, 'Keep dry.\nNo sun.');
  node.shadowRoot.querySelector('form').requestSubmit();
  const edits = Object.fromEntries((sent[1]?.edits ?? []).map((item) => [item.field, item]));
  check('input form: a typed edit of a number and of a date has the values of the contract types', sent.length === 2
    && edits.copies?.type === 'correction' && edits.copies.old_value === 3 && edits.copies.new_value === 4
    && edits.due?.type === 'override' && edits.due.old_value === '2026-12-01' && edits.due.new_value === '2026-12-08'
    && sent[1].arguments.branch === 'South' && sent[1].arguments.note === 'Keep dry.\nNo sun.' && Object.keys(edits).length === 2,
  JSON.stringify(sent[1]));
}
{
  // The form refuses a field that its own contract accepts but whose data do not agree, as the field does.
  const outside = mount('editable-form', { ...INPUT_FORM, fields: [INPUT_FORM.fields[0],
    fill('number-field', { name: 'copies', label: 'Copies', value: 30, maximum: 12 })] });
  check('input form: refuses a number outside the range of its field', outside.dataset.state === 'refused'
    && refusedText(outside).includes('data.fields[1].data.value: the number is outside the range'), refusedText(outside));
  const choice = mount('editable-form', { ...INPUT_FORM, fields: [fill('choice-field', { name: 'branch', label: 'Branch', value: 'East', choices: ['North'] })] });
  check('input form: refuses a value that is not one of the choices', choice.dataset.state === 'refused'
    && refusedText(choice).includes('data.fields[0].data.value: the value is not one of the choices'), refusedText(choice));
  const other = mount('editable-form', { ...INPUT_FORM, fields: [fill('button', { label: 'Shelf code' })] });
  check('input form: refuses a component that the form does not name', other.dataset.state === 'refused'
    && refusedText(other).includes('data.fields[0].component: must be field or long-text-field or number-field or date-field or choice-field'),
  refusedText(other));
}

// The form card (catalog/form-card.json). A person reads the form first and edits one field in place.
const line = (input, extra = {}) => fill('form-line', { ...extra, field: input });
const section = (title, lines) => fill('form-section', { title, lines });
const CARD_FORM = { title: 'Membership form', submit_label: 'Send changes', sections: [
  section('Member', [line(field('member_name', 'Name', 'Robin Vale'), { line: '1.1' }),
    line(fill('long-text-field', { name: 'address', label: 'Address', hint: 'The street and the town.' }), { line: '1.2' })]),
  section('Household', [
    line(fill('number-field', { name: 'adults', label: 'Adults', value: 2, minimum: 1, maximum: 8, typed: true }), { line: '2.1' }),
    line(fill('number-field', { name: 'children', label: 'Children', value: 1, minimum: 0, maximum: 8 }), { line: '2.2' }),
    line(fill('number-field', { name: 'household', label: 'Household size', value: 3 }), { line: '2.3', read_only: true }),
    line(fill('date-field', { name: 'start', label: 'Start date', value: '2026-12-01', typed: true })),
    line(fill('choice-field', { name: 'plan', label: 'Plan', value: 'Basic', choices: ['Basic', 'Family', 'Senior'] }))]),
] };
const CARD_EDITABLE = { member_name: 'Name', address: 'Address', adults: 'Adults', children: 'Children', start: 'Start date', plan: 'Plan' };
const CARD_BINDING = { tool: 'members.update_form', label: 'Send changes', title: 'Membership form', arguments: { form_id: 'F-0001' },
  editable: CARD_EDITABLE, typed: ['adults', 'start'], editor: EDITOR };
function formCard(binding = CARD_BINDING, data = CARD_FORM) {
  const node = mount('form-card', data);
  const sent = [];
  node.addEventListener('mu-action', (event) => sent.push(event.detail));
  node.action = binding;
  return { node, sent };
}
// The parts of one line, by the field name.
const lineOf = (node, name) => {
  const row = [...node.shadowRoot.querySelectorAll('[part="line"]')].find((item) => item.dataset.name === name);
  const editor = row?.querySelector('[part="editor"]');
  const inner = editor?.querySelector('[data-state]');
  return { row, value: row?.querySelector('[part="value"]'), changed: row?.querySelector('[part="changed"]'),
    editor, inner, root: inner?.shadowRoot, save: editor?.querySelector('[part="save"]'), cancel: editor?.querySelector('[part="cancel"]'),
    reason: editor?.querySelector('[part="reason"]') };
};
const cardSubmit = (node) => node.shadowRoot.querySelector('form').requestSubmit();
const cardStatus = (node) => node.shadowRoot.querySelector('[part="status"]').textContent;
{
  const { node, sent } = formCard();
  const rows = [...node.shadowRoot.querySelectorAll('[part="line"]')];
  check('form card: renders a valid fill in the default state', node.dataset.state === 'default' && rows.length === 7,
    `${node.dataset.state} ${rows.length} ${node.shadowRoot.textContent.slice(0, 200)}`);
  check('form card: each section is a named group', [...node.shadowRoot.querySelectorAll('[part="section"]')]
    .map((item) => `${item.getAttribute('role')}:${item.getAttribute('aria-label')}`).join('|') === 'group:Member|group:Household',
  [...node.shadowRoot.querySelectorAll('[part="section"]')].map((item) => item.outerHTML.slice(0, 80)).join('|'));
  const adults = lineOf(node, 'adults');
  check('form card: a field shows as a line number, a label and a value', adults.row.querySelector('[part="line-number"]')?.textContent === '2.1'
    && adults.row.querySelector('[part="label"]')?.textContent === 'Adults' && adults.value.textContent === '2', adults.row.textContent);
  check('form card: the read state has no input', deepQuery(node, 'input, textarea').length === 0, deepQuery(node, 'input, textarea').length);
  const address = lineOf(node, 'address');
  check('form card: a field with no value shows an empty marker as text', address.value.textContent === 'No value', address.value.textContent);
  check('form card: the help text shows in the read state', address.row.textContent.includes('The street and the town.'), address.row.textContent);
  const household = lineOf(node, 'household');
  check('form card: a read-only field has no editor button', household.value.tagName !== 'BUTTON' && household.value.textContent === '3'
    && household.row.querySelector('[part="read-only"]')?.textContent === 'Read-only', household.row.innerHTML.slice(0, 200));
  check('form card: an editable value is a button with the label in its name', adults.value.tagName === 'BUTTON'
    && adults.value.getAttribute('aria-label') === 'Edit Adults: 2', adults.value.getAttribute('aria-label'));
  check('form card: the plan shows its choice as text', lineOf(node, 'plan').value.textContent === 'Basic', lineOf(node, 'plan').value.textContent);

  // A click on a value opens its editor. Save keeps the new value, and the focus goes back to the value.
  let children = lineOf(node, 'children');
  children.value.click();
  children = lineOf(node, 'children');
  const input = children.root?.querySelector('input');
  check('form card: a click opens the editor of the field', children.editor && children.inner?.localName === 'mu-number-field'
    && input?.value === '1' && children.root.activeElement === input && children.editor.getAttribute('aria-label') === 'Edit Children',
  children.row.innerHTML.slice(0, 200));
  typeIn(input, '2');
  children.save.click();
  children = lineOf(node, 'children');
  check('form card: Save keeps the new value and closes the editor', !children.editor && children.value.textContent === '2', children.row.textContent);
  check('form card: a changed field shows a changed marker as text', children.changed?.textContent === 'Changed'
    && children.value.getAttribute('aria-label') === 'Edit Children: 2, changed', children.row.textContent);
  check('form card: the focus goes back to the value after Save', node.shadowRoot.activeElement === children.value,
    node.shadowRoot.activeElement?.outerHTML.slice(0, 80));

  // Cancel restores the old value. Escape cancels.
  let plan = lineOf(node, 'plan');
  plan.value.click();
  plan = lineOf(node, 'plan');
  plan.root.querySelectorAll('[part="choices"] input')[1].click();
  plan.cancel.click();
  plan = lineOf(node, 'plan');
  check('form card: Cancel restores the old value', !plan.editor && plan.value.textContent === 'Basic' && !plan.changed
    && node.shadowRoot.activeElement === plan.value, plan.row.textContent);
  let name = lineOf(node, 'member_name');
  name.value.click();
  name = lineOf(node, 'member_name');
  const nameInput = name.root.querySelector('input');
  typeIn(nameInput, 'Robin Vale-Ash');
  nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
  name = lineOf(node, 'member_name');
  check('form card: Escape cancels the edit', !name.editor && name.value.textContent === 'Robin Vale' && !name.changed
    && node.shadowRoot.activeElement === name.value, name.row.textContent);

  // A value that the field does not accept stays in the editor, and the field tells why.
  let adultsLine = lineOf(node, 'adults');
  adultsLine.value.click();
  adultsLine = lineOf(node, 'adults');
  typeIn(adultsLine.root.querySelector('input'), '9');
  adultsLine.save.click();
  adultsLine = lineOf(node, 'adults');
  check('form card: Save of a value outside the range keeps the editor and tells why', adultsLine.editor
    && adultsLine.root.querySelector('[part="problem"]').textContent === 'Give a number from 1 to 8.', adultsLine.row.textContent);
  // A typed field needs an edit type before Save.
  typeIn(adultsLine.root.querySelector('input'), '3');
  adultsLine.save.click();
  adultsLine = lineOf(node, 'adults');
  check('form card: Save of a typed field with no edit type keeps the editor', adultsLine.editor
    && adultsLine.root.querySelector('[part="reason"]').textContent === 'Choose an edit type.', adultsLine.row.textContent);
  adultsLine.root.querySelectorAll('[part="edit-type"] input')[1].click();
  adultsLine.save.click();
  adultsLine = lineOf(node, 'adults');
  check('form card: Save of a typed field with an edit type keeps the value', !adultsLine.editor && adultsLine.value.textContent === '3'
    && adultsLine.changed?.textContent === 'Changed', adultsLine.row.textContent);

  // A submit with an open editor sends no action. The editor tells why.
  let start = lineOf(node, 'start');
  start.value.click();
  start = lineOf(node, 'start');
  cardSubmit(node);
  start = lineOf(node, 'start');
  check('form card: a submit with an open editor sends no action', sent.length === 0
    && start.reason?.textContent === 'Save or cancel this field first.', `${sent.length} ${start.row.textContent}`);
  start.cancel.click();

  // The card sends the changes as one action. It shows Pending, and Done only after the receipt.
  cardSubmit(node);
  check('form card: the changes go as one action', sent.length === 1 && sent[0].tool === 'members.update_form'
    && JSON.stringify(sent[0].arguments) === JSON.stringify({ children: 2, adults: 3, form_id: 'F-0001' }), JSON.stringify(sent));
  const edit = sent[0]?.edits?.[0];
  check('form card: the request records the edit type of a typed field', sent[0]?.edits?.length === 1 && edit.field === 'adults'
    && edit.type === 'correction' && edit.old_value === 2 && edit.new_value === 3 && edit.actor.id === 'person-ana' && ISO.test(edit.time),
  JSON.stringify(sent[0]?.edits));
  check('form card: pending until the receipt', node.dataset.state === 'pending' && cardStatus(node) === 'Pending'
    && lineOf(node, 'children').changed?.textContent === 'Changed', `${node.dataset.state} ${cardStatus(node)}`);
  lineOf(node, 'plan').value.click();
  check('form card: no editor opens while the action is pending', !lineOf(node, 'plan').editor
    && lineOf(node, 'plan').value.getAttribute('aria-disabled') === 'true', lineOf(node, 'plan').row.innerHTML.slice(0, 160));
  check('form card: a receipt with a different id changes nothing', !node.receipt({ id: 'other', ok: true }) && node.dataset.state === 'pending');
  node.receipt({ id: sent[0].id, ok: true });
  check('form card: Done only after the receipt, and the markers go', node.dataset.state === 'done' && cardStatus(node) === 'Done'
    && !lineOf(node, 'children').changed && !lineOf(node, 'adults').changed && lineOf(node, 'children').value.textContent === '2',
  `${node.dataset.state} ${cardStatus(node)} ${lineOf(node, 'children').row.textContent}`);

  // After Done, the saved values are the old values of the next edit.
  adultsLine = lineOf(node, 'adults');
  adultsLine.value.click();
  adultsLine = lineOf(node, 'adults');
  typeIn(adultsLine.root.querySelector('input'), '4');
  adultsLine.root.querySelectorAll('[part="edit-type"] input')[2].click();
  adultsLine.save.click();
  cardSubmit(node);
  check('form card: after Done the next edit starts from the saved value', sent.length === 2
    && sent[1].edits?.[0]?.old_value === 3 && sent[1].edits[0].new_value === 4 && sent[1].edits[0].type === 'override'
    && JSON.stringify(sent[1].arguments) === JSON.stringify({ adults: 4, form_id: 'F-0001' }), JSON.stringify(sent[1]));
  node.receipt({ id: sent[1].id, ok: false, message: 'The service refused the change.' });
  check('form card: Not done with the reason, and the marker stays', node.dataset.state === 'error'
    && cardStatus(node) === 'Not done: The service refused the change.' && lineOf(node, 'adults').changed?.textContent === 'Changed',
  `${node.dataset.state} ${cardStatus(node)}`);

  // The application sends new computed values for a read-only field. The card checks each value against its field contract.
  check('form card: shows a new computed value', node.computed({ household: 4 }).length === 0
    && lineOf(node, 'household').value.textContent === '4', lineOf(node, 'household').row.textContent);
  const notReadOnly = node.computed({ children: 5 });
  check('form card: refuses a computed value for a field that a person edits', notReadOnly[0] === 'children: the field is not read-only'
    && lineOf(node, 'children').value.textContent === '2', notReadOnly.join('; '));
  const wrongType = node.computed({ household: 'many' });
  check('form card: refuses a computed value that the field contract does not accept', wrongType[0] === 'household: data.value: must be a number'
    && lineOf(node, 'household').value.textContent === '4', wrongType.join('; '));
  check('form card: refuses a computed value for a name that the card does not have', node.computed({ pets: 1 })[0] === 'pets: the card has no field with this name');
}
{
  // With no change, a submit sends no action, and the card tells why.
  const { node, sent } = formCard();
  cardSubmit(node);
  check('form card: a submit with no change sends no action', sent.length === 0
    && node.shadowRoot.querySelector('[part="note"]')?.textContent === 'No changes to send.', node.shadowRoot.textContent.slice(-120));
}
{
  // The application gives the title, the editable names, their labels and the typed names. The card refuses a fill that does not agree.
  const refused = (name, data, expected, binding = CARD_BINDING) => {
    const { node } = formCard(binding, data);
    check(`form card: refuses ${name}`, node.dataset.state === 'refused' && refusedText(node).includes(expected), refusedText(node));
  };
  const lines = (index, change) => CARD_FORM.sections.map((item, at) => (at === 1 ? section(item.data.title,
    item.data.lines.map((entry, place) => (place === index ? change(entry) : entry))) : item));
  const withField = (entry, data) => line(fill(entry.data.field.component, { ...entry.data.field.data, ...data }), { ...entry.data, field: undefined });
  refused('a different title', { ...CARD_FORM, title: 'Other form' }, 'data.title: the title is not the title of the application');
  refused('a different submit label', { ...CARD_FORM, submit_label: 'Send' }, 'data.submit_label: the label is not the label of the application');
  refused('a field that the application does not accept', { ...CARD_FORM, sections: lines(1, (entry) => withField(entry, { name: 'pets', label: 'Pets' })) },
    'data.sections: the application does not accept the field pets');
  refused('a field with a different label', { ...CARD_FORM, sections: lines(1, (entry) => withField(entry, { label: 'Kids' })) },
    'data.sections: the label of the field children is not the label of the application');
  refused('a typed flag that does not agree', { ...CARD_FORM, sections: lines(1, (entry) => withField(entry, { typed: true })) },
    'data.sections: the edit type of the field children is not the rule of the application');
  refused('a read-only field with an edit type', { ...CARD_FORM, sections: lines(2, (entry) => withField(entry, { typed: true })) },
    'data.sections: the read-only field household cannot have an edit type');
  refused('a disabled field', { ...CARD_FORM, sections: lines(1, (entry) => withField(entry, { disabled: true })) },
    'data.sections[1].data.lines[1].data.field.data.disabled: a form card uses read_only');
  refused('a value outside the range of its field', { ...CARD_FORM, sections: lines(0, (entry) => withField(entry, { value: 12 })) },
    'data.sections[1].data.lines[0].data.field.data.value: the number is outside the range');
  refused('two fields with one name', { ...CARD_FORM, sections: lines(1, (entry) => withField(entry, { name: 'adults', label: 'Adults' })) },
    'data.sections: the field names must be unique');
  const readOnly = { ...CARD_FORM, submit_label: 'Send changes', sections: [section('Household', [CARD_FORM.sections[1].data.lines[2]])] };
  refused('a card with no field that a person can edit', readOnly, 'data.sections: the card needs at least one field that a person can edit');
  // A read-only line with the name of a bound argument shows the value that the request sends, or the card refuses it.
  const bound = (value) => ({ ...CARD_FORM, sections: [...CARD_FORM.sections,
    section('Record', [line(field('form_id', 'Form', value), { read_only: true })])] });
  refused('a read-only field that shows a value other than its bound argument', bound('F-9999'),
    'data.sections: the read-only field form_id does not show the bound value');
  const agreed = formCard(CARD_BINDING, bound('F-0001')).node;
  check('form card: accepts a read-only field that shows its bound argument', agreed.dataset.state === 'default', refusedText(agreed));
  const moved = agreed.computed({ form_id: 'F-9999' });
  check('form card: refuses a computed value other than the bound argument', moved[0] === 'form_id: the value is not the bound value'
    && lineOf(agreed, 'form_id').row?.textContent.includes('F-0001'), JSON.stringify(moved));
}
{
  // A long card: 2 sections of 30 editable fields. The binding of the application gives each of the 60 names.
  const names = Array.from({ length: 60 }, (_, index) => `item_${index}`);
  const long = { ...CARD_FORM, sections: [0, 1].map((part) => section(`Part ${part + 1}`,
    names.slice(part * 30, part * 30 + 30).map((name) => line(field(name, `Item ${name.slice(5)}`, 'Yes'))))) };
  const { node } = formCard({ ...CARD_BINDING, editable: Object.fromEntries(names.map((name) => [name, `Item ${name.slice(5)}`])), typed: [] }, long);
  check('form card: a card with more than 50 editable fields accepts the binding of each field', node.dataset.state === 'default'
    && node.shadowRoot.querySelectorAll('[part="line"]').length === 60, refusedText(node));
}
{
  // Markup in the value of a field shows as text in the editor too, and makes no element.
  const marked = mount('form-card', { title: 'Membership form', submit_label: 'Send changes', sections: [section('Member', [
    line(fill('field', { name: 'note', label: MARKUP.slice(0, 80), value: MARKUP.slice(0, 200), hint: MARKUP })),
    line(fill('choice-field', { name: 'plan', label: 'Plan', value: MARKUP.slice(0, 80), choices: ['Basic', MARKUP.slice(0, 80)] }))])] });
  lineOf(marked, 'note').value.click();
  lineOf(marked, 'plan').value.click();
  const editorInput = lineOf(marked, 'note').root?.querySelector('input');
  check('form card: markup in the editor shows as text', editorInput?.value === MARKUP.slice(0, 200)
    && deepQuery(marked, 'img, script').length === 0 && deepText(marked).includes(MARKUP.slice(0, 80)), deepText(marked).slice(0, 200));
}

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
// The form card: the value buttons and the section line in each mode. These checks move no focus, because the
// keyboard steps of the runner start from the last focus.
const modeCard = formCard();
const modeValue = getComputedStyle(lineOf(modeCard.node, 'children').value);
const modeSection = getComputedStyle(modeCard.node.shadowRoot.querySelector('[part="section"]'));
if (mode === 'forced-colors') {
  check('forced colors: the value button of a form card uses ButtonText', modeValue.color === resolved('ButtonText')
    && modeValue.borderTopColor === resolved('ButtonText'), `${modeValue.color} ${modeValue.borderTopColor}`);
  check('forced colors: the section line of a form card uses CanvasText', modeSection.borderTopColor === resolved('CanvasText'), modeSection.borderTopColor);
}
if (mode === 'reduced-motion') {
  check('reduced motion: no transition on the value button of a form card',
    modeValue.transitionDuration.split(',').every((d) => parseFloat(d) === 0), modeValue.transitionDuration);
}
if (mode === 'light' || mode === 'dark') {
  check(`${mode}: the value button of a form card uses the text color of the theme`, modeValue.color === cardStyle.color, `${modeValue.color} ${cardStyle.color}`);
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
// The runner gives the type of a typed edit with the keyboard: Tab to the group, Space, then an arrow key.
const typedTarget = document.createElement('mu-editable-form');
typedTarget.actor = AUTHOR;
typedTarget.fill = outer('editable-form', { ...TYPED_FORM, title: 'Typed form' });
typedTarget.action = { ...TYPED_BINDING, title: 'Typed form' };
keyboard.append(typedTarget);
window.muFocusTyped = () => {
  const input = typedTarget.shadowRoot.querySelector('mu-field').shadowRoot.querySelector('input');
  input.focus();
  typeIn(input, 'C-3');
  return true;
};
window.muTyped = () => typedTarget.shadowRoot.querySelector('mu-field').editType;
// The runner presses Enter in long text and an arrow key in a choice. Enter adds a line and does not submit the form.
const inputTarget = document.createElement('mu-editable-form');
inputTarget.actor = AUTHOR;
inputTarget.fill = outer('editable-form', { ...INPUT_FORM, title: 'Input form' });
inputTarget.action = { ...INPUT_BINDING, title: 'Input form' };
let inputSubmits = 0;
inputTarget.addEventListener('mu-action', () => { inputSubmits += 1; });
keyboard.append(inputTarget);
window.muFocusLongText = () => {
  const area = inputOf(inputTarget, 'note').input;
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
  return true;
};
window.muFocusChoice = () => { inputOf(inputTarget, 'branch').radios[0].focus(); return true; };
window.muInputs = () => ({ submits: inputSubmits, note: inputOf(inputTarget, 'note').node.value,
  branch: inputOf(inputTarget, 'branch').node.value });
// The runner edits one field of this form card with the keyboard only: Enter or Space opens the editor,
// Escape cancels, Enter in the field saves, and Tab and Space on Save save.
const cardTarget = document.createElement('mu-form-card');
cardTarget.actor = AUTHOR;
cardTarget.fill = outer('form-card', { ...CARD_FORM, title: 'Keyboard card' });
cardTarget.action = { ...CARD_BINDING, title: 'Keyboard card' };
keyboard.append(cardTarget);
window.muFocusCardValue = () => { lineOf(cardTarget, 'children').value.focus(); return true; };
window.muCardType = (value) => { typeIn(lineOf(cardTarget, 'children').root.querySelector('input'), value); return true; };
window.muCard = () => {
  const parts = lineOf(cardTarget, 'children');
  const active = cardTarget.shadowRoot.activeElement;
  return { editing: Boolean(parts.editor), focus: active?.getAttribute('aria-label') ?? active?.localName ?? '',
    inner: parts.root?.activeElement?.localName ?? '', value: parts.value?.textContent ?? '' };
};
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
const keyboardCitation = document.createElement('mu-citation');
keyboardCitation.actor = AUTHOR;
keyboardCitation.fill = { ...fill('citation', {}), slots: { authorship: AUTHOR, citation: { source: 'Keyboard source', locator: 'https://example.org/keyboard' } } };
let citationOpens = 0;
// The page acts as the application. It cancels the event, so the check opens no tab.
keyboardCitation.addEventListener('mu-open', (event) => { citationOpens += 1; event.preventDefault(); });
keyboard.append(keyboardCitation);
window.muFocusCitation = () => { keyboardCitation.shadowRoot.querySelector('[part="open"]').focus(); return true; };
window.muCitationOpens = () => citationOpens;
const keyboardExcerpt = document.createElement('mu-excerpt');
keyboardExcerpt.actor = AUTHOR;
keyboardExcerpt.fill = { ...fill('excerpt', { passage: 'Keyboard passage with a mark.', span_start: 23, span_end: 28 }),
  slots: { authorship: AUTHOR, citation: { source: 'Keyboard excerpt source', locator: 'https://example.org/keyboard/excerpt' } } };
keyboardExcerpt.addEventListener('mu-open', (event) => event.preventDefault());
keyboard.append(keyboardExcerpt);
window.muPresses = () => presses;
window.muChecks = { mode, results };
