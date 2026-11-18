// Expected results come from catalog/card.json, catalog/card-grid.json and src/components/card.md.
export async function cardKeyboardChecks(session, sessionId, { evaluate, key }, page) {
  const results = [];
  const check = (step, ok, detail) => results.push({ page, step, ok: Boolean(ok), detail: JSON.stringify(detail) });
  await evaluate(session, sessionId, 'window.muFocusCollapse()');
  for (const [name, code, number, text, collapsed, count] of [
    ['Enter', 'Enter', 13, '\r', true, 1], [' ', 'Space', 32, ' ', false, 2],
  ]) {
    await key(session, sessionId, name, code, number, text);
    const state = await evaluate(session, sessionId, 'window.muCollapseState()');
    check(`${code} toggles the card, emits one event and keeps focus`, state.collapsed === collapsed
      && state.expanded === String(!collapsed) && state.focused && state.events.length === count
      && state.events.at(-1).collapsed === collapsed && state.hidden === collapsed, state);
  }
  await evaluate(session, sessionId, 'window.muStartCardAction()');
  await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  let state = await evaluate(session, sessionId, 'window.muCollapseState()');
  check('Enter cannot hide an action that waits for its receipt', !state.collapsed && !state.hidden
    && state.pending && state.events.length === 2 && state.focused, state);
  await evaluate(session, sessionId, 'window.muFinishCardAction()');
  await key(session, sessionId, ' ', 'Space', 32, ' ');
  state = await evaluate(session, sessionId, 'window.muCollapseState()');
  check('Space can collapse after the receipt and focus stays on the toggle', state.collapsed && state.focused
    && state.events.length === 3 && !state.pending, state);
  // Tab goes to a known control in the page, past the hidden action, and stays inside the page.
  await key(session, sessionId, 'Tab', 'Tab', 9);
  check('Tab skips the collapsed actions', await evaluate(session, sessionId, 'window.muAfterCardFocused()'));
  for (const [index, name, code, number, text, expected] of [
    [1, 'Enter', 'Enter', 13, '\r', [true, true, false]], [0, ' ', 'Space', 32, ' ', [false, false, false]],
  ]) {
    await evaluate(session, sessionId, `window.muFocusGridControl(${index})`);
    await key(session, sessionId, name, code, number, text);
    state = await evaluate(session, sessionId, 'window.muGridCollapseState()');
    check(`${code} changes all collapsible cards and keeps focus on the grid control`,
      JSON.stringify(state.collapsed) === JSON.stringify(expected) && state.focused === index, state);
  }
  await evaluate(session, sessionId, 'window.muResetCollapseFocus()');
  return results;
}

async function browserChecks() {
  const { define } = await import('../../src/components/index.js');
  define();
  const results = [];
  const storageBefore = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const AUTHOR = { type: 'agent', id: 'agent-cards' };
  const CITATION = { source: 'Synthetic card record', locator: 'https://example.org/cards/1' };
  const data = { title: 'Synthetic card', summary: 'Body text.', status: 'Ready', collapsed_summary: 'Short text.',
    collapsible: true, facts: [{ component: 'fact', version: '0.1.0', data: { label: 'Shelf', value: 'A-1' } }] };
  const fill = (component, data, citation) => ({ component, version: '0.1.0', data,
    slots: { authorship: AUTHOR, ...(citation ? { citation } : {}) } });
  const stage = document.getElementById('stage');
  function mount(values = data, component = 'card', citation) {
    const node = document.createElement(`mu-${component}`);
    node.actor = AUTHOR;
    stage.append(node);
    node.fill = fill(component, values, citation);
    return node;
  }
  const button = (card) => card.shadowRoot.querySelector('[part="toggle"]');
  const body = (card) => card.shadowRoot.querySelector('[part="body"]');
  function visibleProvenance(card) {
    const root = card.shadowRoot;
    const parts = ['authorship', 'citation', 'locator', 'open'].map((part) => root.querySelector(`[part="${part}"]`));
    return root.querySelectorAll('[part="provenance"]').length === 1
      && root.querySelectorAll('[part="authorship"]').length === 1
      && root.querySelectorAll('[part="citation"]').length === 1
      && parts.every((node) => node && node.getBoundingClientRect().height > 0)
      && parts[0].textContent === 'Author: agent agent-cards'
      && parts[1].textContent === `Source: ${CITATION.source}` && parts[2].textContent === CITATION.locator;
  }
  function action(card, confirm = false) {
    const node = document.createElement('mu-action-button');
    node.slot = 'actions';
    node.action = { tool: 'library.renew', label: 'Renew', ...(confirm
      ? { confirm: { message: 'Renew the loan?', label: 'Yes, renew' } } : {}) };
    node.fill = { component: 'action-button', version: '0.1.0', data: { label: 'Renew' } };
    card.append(node);
    return node;
  }
  const press = (node) => node.shadowRoot.querySelector('[part="button"]').click();
  const tick = () => new Promise((done) => setTimeout(done, 0));
  const initial = document.createElement('mu-card');
  initial.actor = AUTHOR;
  let initialEvents = 0;
  initial.addEventListener('mu-collapse', () => { initialEvents += 1; });
  initial.fill = fill('card', { ...data, collapsed: true }, CITATION);
  stage.append(initial);
  check('card: a collapsed start state sends no change event', initial.collapsed && body(initial).hidden && initialEvents === 0);
  check('card: a collapsed start state shows the agent author and source once', initial.collapsed && visibleProvenance(initial));
  const failedStart = document.createElement('mu-card');
  failedStart.actor = AUTHOR;
  const failedAction = action(failedStart);
  let failedRequest;
  failedAction.addEventListener('mu-action', (event) => { failedRequest = event.detail; });
  press(failedAction);
  failedAction.receipt({ id: failedRequest.id, ok: false });
  failedStart.fill = fill('card', { ...data, collapsed: true });
  stage.append(failedStart);
  check('card: a collapsed start with a failed receipt stays expanded', !failedStart.collapsed
    && failedStart.dataset.state === 'expanded' && !body(failedStart).hidden && failedAction.dataset.state === 'error');
  failedStart.collapsed = true;
  button(failedStart).click();
  check('card: the property and toggle cannot hide a failed receipt', !failedStart.collapsed && !body(failedStart).hidden);
  failedStart.fill = fill('card', { ...data, status: 'Approved', collapsed_summary: 'Approved', collapsed: true });
  check('card: a collapsed refill cannot hide a failed receipt', !failedStart.collapsed && !body(failedStart).hidden
    && failedStart.querySelector('mu-action-button') === failedAction && failedAction.dataset.state === 'error');
  press(failedAction);
  failedAction.receipt({ id: failedRequest.id, ok: true });
  failedStart.collapsed = true;
  check('card: collapse works after a retry succeeds', failedStart.collapsed && failedAction.dataset.state === 'done');
  for (const values of [{ title: 'Plain card' }, { ...data, collapsible: false, collapsed: true },
    { title: 'Plain start state', collapsed: true }]) {
    const node = mount(values);
    check('card: no collapse control keeps the original state and content', !button(node)
      && node.dataset.state === 'default' && !node.collapsed && node.shadowRoot.querySelector('article'));
  }
  const card = mount(data, 'card', CITATION);
  const control = button(card);
  const events = [];
  card.addEventListener('mu-collapse', (event) => events.push(event));
  const original = JSON.stringify(card.fill);
  const pending = action(card);
  let request;
  pending.addEventListener('mu-action', (event) => { request = event.detail; });
  check('card: starts expanded with one header toggle and a valid controlled body', card.dataset.state === 'expanded'
    && card.shadowRoot.querySelectorAll('[part="toggle"]').length === 1
    && control.getAttribute('aria-expanded') === 'true'
    && card.shadowRoot.getElementById(control.getAttribute('aria-controls')) === body(card));
  control.focus();
  control.click();
  check('card: collapse keeps the title, status and short summary', card.collapsed && body(card).hidden
    && card.shadowRoot.querySelector('[part="title"]').textContent === data.title
    && card.shadowRoot.querySelector('[part="status"]').textContent === 'Ready'
    && !card.shadowRoot.querySelector('[part="collapsed-summary"]').hidden);
  check('card: collapse keeps the agent author and source visible once', card.collapsed && visibleProvenance(card));
  check('card: collapse keeps focus, DOM identity and fill data', card.shadowRoot.activeElement === control
    && button(card) === control && card.querySelector('mu-action-button') === pending && JSON.stringify(card.fill) === original);
  check('card: the state event bubbles, crosses shadow roots and has boolean detail', events.length === 1
    && events[0].bubbles && events[0].composed && events[0].detail.collapsed === true);
  card.collapsed = true;
  check('card: the current state sends no duplicate event', events.length === 1);
  card.collapsed = false;
  check('card: expansion hides only the short summary', !body(card).hidden
    && card.shadowRoot.querySelector('[part="collapsed-summary"]').hidden && events.length === 2);
  check('card: expansion shows the agent author and source once', !card.collapsed && visibleProvenance(card));
  press(pending);
  card.collapsed = true;
  control.click();
  check('card: both the property and the button refuse to hide a pending action', !card.collapsed
    && !body(card).hidden && pending.action.state === 'pending' && events.length === 2);
  check('card: a wrong receipt keeps the action visible', !pending.receipt({ id: 'wrong', ok: true }) && !card.collapsed);
  card.fill = fill('card', { ...data, collapsed: true });
  check('card: a collapsed refill cannot hide a pending action', !card.collapsed && !body(card).hidden
    && card.querySelector('mu-action-button') === pending && pending.action.state === 'pending');
  pending.receipt({ id: request.id, ok: true });
  card.collapsed = true;
  check('card: collapse works after a receipt', card.collapsed && pending.action.state === 'done');
  card.fill = fill('card', data);
  check('card: a refill resets to its declared state and emits the change', !card.collapsed
    && events.at(-1).detail.collapsed === false);
  const short = mount({ ...data, collapsed: true });
  const shortEvents = [];
  short.addEventListener('mu-collapse', (event) => shortEvents.push(event.detail));
  const added = action(short);
  press(added);
  check('card: a new request expands a collapsed card before it reaches the application', !short.collapsed
    && !body(short).hidden && shortEvents.length === 1 && shortEvents[0].collapsed === false);
  const late = mount({ ...data, collapsed: true });
  const lateAction = action(mount());
  press(lateAction);
  late.append(lateAction);
  await tick();
  check('card: an inserted pending action expands the card', !late.collapsed && !body(late).hidden);
  const nested = mount({ ...data, collapsed: true });
  const holder = document.createElement('div');
  holder.slot = 'actions';
  holder.attachShadow({ mode: 'open' });
  const nestedAction = action(mount());
  press(nestedAction);
  holder.shadowRoot.append(nestedAction);
  nested.append(holder);
  await tick();
  check('card: an action in a nested shadow root cannot be hidden', !nested.collapsed);
  const lateError = mount({ ...data, collapsed: true });
  const receiptAction = action(mount());
  let receiptRequest;
  receiptAction.addEventListener('mu-action', (event) => { receiptRequest = event.detail; });
  press(receiptAction);
  lateError.append(receiptAction);
  check('card: the failed receipt target starts collapsed', lateError.collapsed);
  receiptAction.receipt({ id: receiptRequest.id, ok: false });
  await tick();
  check('card: a failed receipt in a collapsed card expands it', !lateError.collapsed
    && !body(lateError).hidden && receiptAction.dataset.state === 'error');
  const nestedError = mount({ ...data, collapsed: true });
  const errorHolder = document.createElement('div');
  errorHolder.slot = 'actions';
  errorHolder.attachShadow({ mode: 'open' });
  const errorMarker = document.createElement('div');
  errorMarker.dataset.state = 'default';
  errorHolder.shadowRoot.append(errorMarker);
  nestedError.append(errorHolder);
  await tick();
  errorMarker.dataset.state = 'error';
  errorMarker.textContent = 'Not done';
  await tick();
  check('card: an error marker in a nested shadow root expands the card', !nestedError.collapsed && !body(nestedError).hidden);
  errorMarker.dataset.state = 'default';
  errorMarker.action = { state: 'error' };
  nestedError.collapsed = true;
  check('card: an action model error also blocks collapse', !nestedError.collapsed);
  errorMarker.action = { state: 'default' };
  nestedError.collapsed = true;
  check('card: collapse works after the page clears the error', nestedError.collapsed && body(nestedError).hidden);
  const offline = mount({ ...data, collapsed: true });
  const queued = document.createElement('div');
  queued.slot = 'actions';
  queued.dataset.state = 'pending';
  queued.textContent = 'Pending offline';
  offline.append(queued);
  await tick();
  offline.collapsed = true;
  check('card: a pending offline action stays visible', !offline.collapsed && !body(offline).hidden);
  const asked = mount();
  const askedAction = action(asked, true);
  press(askedAction);
  asked.collapsed = true;
  check('card: an open confirm step cannot be hidden', !asked.collapsed && askedAction.dataset.state === 'confirm');
  const focusCard = mount();
  const focusAction = action(focusCard);
  focusAction.shadowRoot.querySelector('button').focus();
  focusCard.collapsed = true;
  check('card: a programmatic collapse returns body focus to the toggle', focusCard.shadowRoot.activeElement === button(focusCard));
  const sparse = mount({ title: 'Short card', collapsible: true, collapsed: true });
  check('card: status and short summary are optional', sparse.collapsed
    && !sparse.shadowRoot.querySelector('[part="status"], [part="collapsed-summary"]'));
  const markup = '<img src=x onerror=alert(1)>';
  const unsafe = mount({ ...data, title: markup, status: markup, collapsed_summary: markup, collapsed: true });
  check('card: header values stay text', !unsafe.shadowRoot.querySelector('img')
    && unsafe.shadowRoot.querySelector('[part="status"]').textContent === markup);

  const items = [data, { ...data, title: 'Second card', collapsed: true }, { title: 'Fixed card' }]
    .map((data) => ({ component: 'card', version: '0.1.0', data }));
  const grid = mount({ label: 'Cards', cards: items, collapse_controls: true }, 'card-grid');
  const cards = [...grid.shadowRoot.querySelectorAll('mu-card')];
  const gridEvents = [];
  grid.addEventListener('mu-collapse', (event) => gridEvents.push(event.detail));
  const gridButtons = [...grid.shadowRoot.querySelectorAll('button')];
  const gridPending = action(cards[0]);
  let gridRequest;
  gridPending.addEventListener('mu-action', (event) => { gridRequest = event.detail; });
  press(gridPending);
  gridButtons[1].focus();
  gridButtons[1].click();
  check('grid: Collapse all uses the pending rule and keeps focus', !cards[0].collapsed && cards[1].collapsed
    && !cards[2].collapsed && grid.shadowRoot.activeElement === gridButtons[1] && gridEvents.length === 0);
  gridPending.receipt({ id: gridRequest.id, ok: false });
  gridButtons[1].click();
  check('grid: Collapse all skips a failed receipt and keeps focus', !cards[0].collapsed && !body(cards[0]).hidden
    && gridPending.dataset.state === 'error' && cards[1].collapsed && !cards[2].collapsed
    && grid.shadowRoot.activeElement === gridButtons[1] && gridEvents.length === 0);
  press(gridPending);
  gridPending.receipt({ id: gridRequest.id, ok: true });
  gridButtons[1].click();
  check('grid: Collapse all emits only changes and leaves fixed cards alone', cards[0].collapsed
    && cards[1].collapsed && !cards[2].collapsed && gridEvents.length === 1 && gridEvents[0].collapsed);
  gridButtons[0].click();
  check('grid: Expand all expands each collapsible card and emits their changes', cards.every((card) => !card.collapsed)
    && gridEvents.length === 3 && gridEvents.slice(1).every((event) => event.collapsed === false));
  check('grid: controls are optional', !mount({ label: 'Plain grid', cards: items }, 'card-grid').shadowRoot.querySelector('button'));
  check('grid: an empty grid keeps its empty state', mount({ label: 'Empty grid', cards: [], collapse_controls: true }, 'card-grid')
    .shadowRoot.querySelector('[part="empty"]').textContent === 'No cards. Change the request, or try again later.');
  check('card: collapse saves no browser state', JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]) === storageBefore);

  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const style = getComputedStyle(button(sparse));
  if (mode === 'forced-colors') {
    const probe = document.createElement('span');
    probe.style.color = 'ButtonText';
    stage.append(probe);
    check('card: forced colors keep the toggle border and text visible', style.color === getComputedStyle(probe).color
      && style.borderTopColor === style.color && style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) >= 1);
  }
  if (mode === 'reduced-motion') check('card: no height animation under reduced motion',
    [body(sparse), button(sparse), sparse.shadowRoot.querySelector('article')].every((node) => {
      const value = getComputedStyle(node);
      return value.animationName === 'none' && value.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }));

  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  const target = document.createElement('mu-button');
  target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target);
  const keys = mount({ ...data, title: 'Keyboard card' });
  keyboard.append(keys);
  const keyAction = action(keys);
  let keyRequest;
  keyAction.addEventListener('mu-action', (event) => { keyRequest = event.detail; });
  const keyEvents = [];
  keys.addEventListener('mu-collapse', (event) => keyEvents.push(event.detail));
  const after = document.createElement('button');
  after.textContent = 'After card';
  keyboard.append(after);
  window.muFocusCollapse = () => { button(keys).focus(); return true; };
  window.muCollapseState = () => ({ collapsed: keys.collapsed, expanded: button(keys).getAttribute('aria-expanded'),
    focused: keys.shadowRoot.activeElement === button(keys), events: keyEvents, hidden: body(keys).hidden,
    pending: keyAction.action.state === 'pending' });
  window.muStartCardAction = () => { press(keyAction); return true; };
  window.muFinishCardAction = () => keyAction.receipt({ id: keyRequest.id, ok: true });
  window.muAfterCardFocused = () => document.activeElement === after;
  window.muFocusGridControl = (index) => { gridButtons[index].focus(); return true; };
  window.muGridCollapseState = () => ({ collapsed: cards.map((card) => card.collapsed),
    focused: gridButtons.indexOf(grid.shadowRoot.activeElement) });
  window.muResetCollapseFocus = () => { keys.collapsed = false; start.focus(); return true; };
  window.muPresses = () => presses;
  start.focus();
  window.muChecks = { mode, results };
}
if (typeof window !== 'undefined') await browserChecks();
