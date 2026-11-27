// The interaction details of the kit. Expected results come from src/components/interaction.md.
// tools/browser_check.mjs loads the page in each media mode, reads window.muChecks and then runs stateChecks,
// which moves a real pointer and presses real keys.
const WIDTHS = [375, 768, 1280];
const REASON = 'This content did not show because it did not match the rules of the application.';
const NEXT = 'Ask for this content again. If the refusal shows again, tell the owner of the application.';
const MARKUP = '<img src=x onerror="window.muUnsafe=1">';
const ERRORS = [`data.${MARKUP}: the contract does not declare this field`, 'data.title: must be a string'];
const DETAILS = 'card: ' + ERRORS.join('\n');

export async function stateChecks(session, sessionId, { evaluate, key, pageRules, sleep }, page, mode) {
  const results = [];
  const check = (step, ok, detail) => results.push({ page, step: `${mode}: ${step}`, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const mouse = (type, x, y, extra = {}) => session.send('Input.dispatchMouseEvent', { type, x, y, ...extra }, sessionId);
  const down = { button: 'left', buttons: 1, clickCount: 1 };
  const count = await evaluate(session, sessionId, 'window.muControls()');
  check('the page has each type of control', count >= 20, count);

  if (mode === 'light') {
    // The focus ring. The Tab key of the generic keyboard check gave the focus to the first button.
    const token = await evaluate(session, sessionId, 'window.muFocusToken()');
    const rings = [];
    for (let i = 0; i < count; i += 1) rings.push(await evaluate(session, sessionId, `window.muFocus(${i})`));
    const able = rings.filter((ring) => !ring.disabled);
    const odd = able.filter((ring) => ring.outline !== `solid 2px ${token} 2px`);
    check('each control shows the same focus ring', able.length >= 18 && odd.length === 0, odd.length ? odd : able.length);
  }

  // Hover and pressed, with a real pointer. The pointer leaves the control before the release, so no press occurs.
  const wrong = [];
  let layered = 0;
  for (let i = 0; i < count; i += 1) {
    await mouse('mouseMoved', 1, 1);
    const at = await evaluate(session, sessionId, `window.muPoint(${i})`);
    const rest = await evaluate(session, sessionId, `window.muStyle(${i})`);
    await mouse('mouseMoved', at.x, at.y);
    const hover = await evaluate(session, sessionId, `window.muStyle(${i})`);
    await mouse('mousePressed', at.x, at.y, down);
    const pressed = await evaluate(session, sessionId, `window.muStyle(${i})`);
    await mouse('mouseMoved', 1, 1, { button: 'left', buttons: 1 });
    await mouse('mouseReleased', 1, 1, { button: 'left', buttons: 0, clickCount: 1 });
    let ok;
    if (at.disabled) {
      ok = hover.layer === rest.layer && pressed.layer === rest.layer
        && rest.opacity === (at.opaque || mode === 'forced-colors' ? '1' : '0.6')
        && ['not-allowed', 'progress'].includes(rest.cursor);
    // Forced colors remove the layer. Hover shows a line, and a pressed button or summary shows a ground.
    } else if (mode === 'forced-colors') ok = hover.edge !== rest.edge && (at.kind !== 'layer' || pressed.layer !== hover.layer);
    else if (at.kind === 'text') ok = hover.edge !== rest.edge && pressed.ring.startsWith('solid 2px');
    else ok = hover.layer !== rest.layer && pressed.layer !== hover.layer && pressed.layer !== rest.layer;
    if (!at.disabled && at.kind !== 'text') layered += 1;
    if (!ok) wrong.push({ name: at.name, kind: at.kind, rest, hover, pressed });
  }
  check('each control shows hover and pressed, and a disabled control shows no change', layered >= 12 && wrong.length === 0,
    wrong.length ? wrong : layered);
  await evaluate(session, sessionId, 'document.activeElement?.blur(), window.muBlur()');
  const originalWidth = await evaluate(session, sessionId, 'innerWidth');
  const waitForWidth = (width) => evaluate(session, sessionId, `new Promise((resolve, reject) => {
    let frames = 0;
    let frame;
    const timeout = setTimeout(() => {
      cancelAnimationFrame(frame);
      reject(new Error('Expected viewport width ${width}, got ' + innerWidth));
    }, 5000);
    function checkWidth() {
      frames = innerWidth === ${width} ? frames + 1 : 0;
      if (frames === 2) {
        clearTimeout(timeout);
        resolve();
      } else {
        frame = requestAnimationFrame(checkWidth);
      }
    }
    frame = requestAnimationFrame(checkWidth);
  })`);
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    await waitForWidth(375);
    const receipt = await evaluate(session, sessionId, 'window.muReceiptLayout()');
    check('375px: the receipt has no horizontal scroll, and the copy control wraps when the row is narrow',
      receipt.width === 375 && receipt.scroll === 0 && receipt.sameRow && receipt.wraps && receipt.target, receipt);
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await waitForWidth(originalWidth);
  }

  for (const kind of ['element', 'thread']) {
    const state = () => evaluate(session, sessionId, `window.muRefusalState('${kind}')`);
    await evaluate(session, sessionId, `window.muRefusalStart('${kind}')`);
    await key(session, sessionId, 'Tab', 'Tab', 9);
    const closed = await state();
    await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
    const opened = await state();
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const exposed = (role, name) => nodes.some((node) => !node.ignored && node.role?.value === role && node.name?.value === name);
    check(`refused ${kind}: Tab reaches the summary and Enter opens the details`,
      closed.focus === 'Technical details' && closed.ring === 'solid' && !closed.open && !closed.visible
      && opened.open && opened.visible, { closed, opened });
    check(`refused ${kind}: a screen reader can reach the disclosure and the copy control`,
      exposed('DisclosureTriangle', 'Technical details') && exposed('button', 'Copy technical details'), opened);
    await key(session, sessionId, ' ', 'Space', 32, ' ');
    const hidden = await state();
    await key(session, sessionId, ' ', 'Space', 32, ' ');
    await key(session, sessionId, 'Tab', 'Tab', 9);
    const copy = await state();
    check(`refused ${kind}: Tab reaches Copy and Space closes the summary`,
      copy.focus === 'Copy technical details' && hidden.focus === 'Technical details' && !hidden.open && !hidden.visible, { copy, hidden });
    await evaluate(session, sessionId, `window.muRefusalOpen('${kind}', false)`);
  }
  await evaluate(session, sessionId, "window.muRefusalOpen('element', true), window.muRefusalOpen('thread', true)");
  results.push(...await pageRules(session, sessionId, `${page} ${mode} with open refusal details`));
  await evaluate(session, sessionId, "window.muRefusalOpen('element', false), window.muRefusalOpen('thread', false)");
  if (mode !== 'light') return results;

  // The copy controls, with a real press. The clipboard gets the text, and Copied shows for a short time.
  const origin = await evaluate(session, sessionId, 'location.origin');
  await session.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId);
  for (const [target, name, expected] of [['code', 'code', 'tray check --all'], ['reference', 'reference', 'R-0001'],
    ['element', 'technical details', DETAILS], ['thread', 'technical details', DETAILS]]) {
    if (target === 'element' || target === 'thread') await evaluate(session, sessionId, `window.muRefusalOpen('${target}', true)`);
    let before = null;
    for (let i = 0; i < 80; i += 1) {
      before = await evaluate(session, sessionId, `window.muCopyState('${target}')`);
      if (before.label === 'Copy') break;
      await sleep(50);
    }
    const at = await evaluate(session, sessionId, `window.muCopyPoint('${target}')`);
    await mouse('mouseMoved', at.x, at.y);
    await mouse('mousePressed', at.x, at.y, down);
    await mouse('mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
    let state = null;
    for (let i = 0; i < 40; i += 1) {
      state = await evaluate(session, sessionId, `window.muCopyState('${target}')`);
      if (state.label !== 'Copy') break;
      await sleep(50);
    }
    const clipboard = await evaluate(session, sessionId, 'navigator.clipboard.readText()');
    check(`the copy control of the ${target} copies the text and shows Copied`, before.label === 'Copy' && before.status === ''
      && before.name === 'Copy ' + name && state.label === 'Copied' && state.status === 'Copied' && state.role === 'status'
      && state.name === 'Copy ' + name && clipboard === expected, { before, state, clipboard });
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const said = nodes.some((node) => !node.ignored && node.role?.value === 'status')
      && nodes.some((node) => !node.ignored && node.role?.value === 'StaticText' && node.name?.value === 'Copied');
    check(`the screen reader gets Copied for the ${target}`, said, said);
    await mouse('mouseMoved', 1, 1);
    for (let i = 0; i < 80 && state.label !== 'Copy'; i += 1) {
      await sleep(50);
      state = await evaluate(session, sessionId, `window.muCopyState('${target}')`);
    }
    check(`the copy control of the ${target} goes back to Copy`, state.label === 'Copy' && state.status === '', state);
    if (target === 'element' || target === 'thread') await evaluate(session, sessionId, `window.muRefusalOpen('${target}', false)`);
  }
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: false }, sessionId);
  await session.send('Browser.resetPermissions', {});

  // The space of a collapsed card and of the grid controls, at a phone width and at two more widths.
  try {
    for (const width of WIDTHS) {
      await session.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: width < 700 }, sessionId);
      await waitForWidth(width);
      const gaps = await evaluate(session, sessionId, 'window.muGaps()');
      check(`${width}px: the grid controls have 8px above, 12px below and 8px between them`, gaps.width === width && gaps.above === 8
        && gaps.below === 12 && gaps.between >= 8 && gaps.scroll <= 0, gaps);
      check(`${width}px: a collapsed card has 8px between its parts and no empty space below`, gaps.parts.length >= 3
        && gaps.parts.every((gap) => gap === 8) && gaps.under === 0 && gaps.hidden === 0, gaps);
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await waitForWidth(originalWidth);
  }
  return results;
}

async function browserChecks() {
  const controlSize = (node) => {
    // The target size of a control (decision 0009): size.control of its host, and never less than 24 CSS pixels.
    const host = node.getRootNode().host;
    const name = host || !matchMedia('(pointer: coarse)').matches ? '--mu-size-control' : '--mu-size-control-touch';
    const value = getComputedStyle(host ?? document.documentElement).getPropertyValue(name).trim();
    const unit = value.endsWith('rem') ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 1;
    return Math.max(24, parseFloat(value) * unit) - 0.01;
  };
  const { define } = await import('../../src/thread/index.js');
  const { COPIED_TIME } = await import('../../src/render/dom.js');
  define();
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const media = (query) => matchMedia(query).matches;
  const AUTHOR = { type: 'agent', id: 'agent-check' };
  const SLOTS = { authorship: AUTHOR };
  const node = (component, data) => ({ component, version: '0.1.0', data });
  const fill = (component, data, slots) => ({ ...node(component, data), ...(slots ? { slots } : {}) });
  const stage = document.getElementById('stage');
  const probe = document.createElement('span');
  document.body.append(probe);
  const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const root = (element) => element.shadowRoot;
  const tick = () => new Promise((done) => { setTimeout(done, 0); });
  function mount(tag, value, parent = stage) {
    const element = document.createElement(tag);
    element.actor = AUTHOR;
    parent.append(element);
    element.fill = value;
    return element;
  }
  const text = (words, id) => {
    const p = document.createElement('p');
    p.id = id;
    p.textContent = words;
    stage.append(p);
  };

  // The keyboard target of the generic check comes first.
  const keyboard = document.getElementById('keyboard');
  const target = mount('mu-button', fill('button', { label: 'Keyboard target' }), keyboard);
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  window.muPresses = () => presses;

  // One control of each type.
  mount('mu-button', fill('button', { label: 'Later', emphasis: 'secondary' }));
  const closed = mount('mu-button', fill('button', { label: 'Closed', disabled: true }));
  const action = (label) => {
    const element = mount('mu-action-button', fill('action-button', { label }));
    element.action = { tool: 'library.renew', label, arguments: { loan_id: 'L-0001' } };
    const requests = [];
    element.addEventListener('mu-action', (event) => requests.push(event.detail));
    return { element, requests, control: root(element).querySelector('button') };
  };
  action('Renew');
  const busy = action('Renew now');
  const done = action('Renew again');
  const longReceipt = action('Renew one more loan');
  const unavailable = mount('mu-action-button', fill('action-button', { label: 'Renew later' }));
  const LOAN = { title: 'Field guide to moss', summary: 'A short guide for walks in wet woods.', status: 'On loan',
    collapsed_summary: 'Due on 1 December.', collapsible: true };
  const CITED = { ...SLOTS, citation: { source: 'Synthetic loan record', locator: 'https://example.org/loans/1' } };
  const open = mount('mu-card', fill('card', LOAN, CITED));
  const shut = mount('mu-card', fill('card', { ...LOAN, title: 'Rivers and deltas', collapsed: true }, SLOTS));
  text('Text above the grid.', 'above');
  const grid = mount('mu-card-grid', fill('card-grid', { label: 'Loans', collapse_controls: true,
    cards: [node('card', LOAN), node('card', { ...LOAN, title: 'A short history of maps', collapsed: true })] }, SLOTS));
  text('Text below the grid.', 'below');
  mount('mu-field', fill('field', { label: 'Shelf code', value: 'B-14' }));
  mount('mu-long-text-field', fill('long-text-field', { label: 'Note', value: 'Keep dry.' }));
  mount('mu-choice-field', fill('choice-field', { label: 'Branch', value: 'A', choices: ['A', 'South'] }));
  const branch = mount('mu-choice-field', fill('choice-field', { label: 'Closed branch', value: 'A', choices: ['A', 'South'], disabled: true }));
  const row = (index) => node('table-row', { cells: [`Plot ${index}`, index % 2 ? 'North' : 'South'] });
  const long = mount('mu-table', fill('table', { label: 'Synthetic plots', columns: ['Plot', 'Area'],
    rows: Array.from({ length: 40 }, (_, index) => row(index + 1)) }, SLOTS));
  const span = (words) => node('rich-span', { text: words });
  const rich = mount('mu-rich-text', fill('rich-text', { blocks: [
    node('rich-paragraph', { content: [span('Run this command. Read the '), node('rich-link', { text: 'Synthetic rules', url: 'https://example.org/rules' }), span('.')] }),
    node('rich-code', { text: 'tray check --all' })] }, SLOTS));
  const change = node('diff-change', { label: 'Shelf', change: 'changed', before: 'B-14', after: 'C-02' });
  const changed = mount('mu-diff', fill('diff', { title: 'Loan L-0001', parts: [node('diff-part', { title: 'Loan', changes: [change] }),
    node('diff-part', { title: 'Rules', changes: [] })] }, SLOTS));

  // Each empty state and a refused state.
  const empty = {
    'card-grid': mount('mu-card-grid', fill('card-grid', { label: 'No loans', cards: [] }, SLOTS)),
    table: mount('mu-table', fill('table', { label: 'No plots', columns: ['Plot'], rows: [] }, SLOTS)),
    'rich-text': mount('mu-rich-text', fill('rich-text', { blocks: [] }, SLOTS)),
    citation: mount('mu-citation', fill('citation', { quote: 'A loan lasts two weeks.' }, SLOTS)),
    'source-status': mount('mu-source-status', fill('source-status', { label: 'Tool library', state: 'empty' })),
    diff: mount('mu-diff', fill('diff', { title: 'Loan L-0002', parts: [node('diff-part', { title: 'Loan', changes: [] })] }, SLOTS)),
  };
  const refused = document.createElement('mu-card');
  refused.actor = AUTHOR;
  stage.append(refused);
  let refusalEvent;
  stage.addEventListener('mu-refused', (event) => { refusalEvent = event; }, { once: true });
  const badFill = fill('card', { title: 7, [MARKUP]: '' }, SLOTS);
  refused.fill = badFill;
  const thread = document.createElement('mu-thread');
  stage.append(thread);
  await thread.read([{ type: 'ACTIVITY_SNAPSHOT', messageId: 'check', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: badFill } }]);
  const refusals = { element: refused, thread };
  const detailsOf = (element) => root(element).querySelector('details[part="details"]');

  // The chevron of the card toggle.
  const toggle = (card) => root(card).querySelector('[part="toggle"]');
  const chevron = (card) => toggle(card).querySelector('svg');
  const turn = (card) => getComputedStyle(chevron(card)).transform;
  check('chevron: the toggle holds one inline SVG of the kit with aria-hidden', [open, shut].every((card) => toggle(card).querySelectorAll('svg').length === 1
    && chevron(card).getAttribute('aria-hidden') === 'true' && chevron(card).namespaceURI === 'http://www.w3.org/2000/svg'
    && chevron(card).querySelector('path').getAttribute('d') === 'M3.5 6 8 10.5 12.5 6' && !root(card).querySelector('img, use, image')));
  check('chevron: it points down on a collapsed card and up on an expanded card', turn(shut) === 'none' && turn(open) === 'matrix(-1, 0, 0, -1, 0, 0)',
    `${turn(shut)} | ${turn(open)}`);
  check('chevron: the button shows only its icon and keeps its accessible name and state',
    toggle(shut).getAttribute('aria-label') === 'Expand Rivers and deltas'
    && toggle(open).getAttribute('aria-label') === 'Collapse Field guide to moss'
    && toggle(shut).textContent === '' && toggle(open).textContent === '' && toggle(shut).getAttribute('aria-expanded') === 'false');
  toggle(shut).click();
  check('chevron: a press turns it, with no animation under reduced motion',
    (!media('(prefers-reduced-motion: reduce)') || turn(shut) === 'matrix(-1, 0, 0, -1, 0, 0)')
    && toggle(shut).getAttribute('aria-expanded') === 'true'
    && toggle(shut).getAttribute('aria-label') === 'Collapse Rivers and deltas', turn(shut));
  shut.collapsed = true;
  const size = chevron(open).getBoundingClientRect();
  check('chevron: it has a size and the color of the button text', size.width >= 12 && size.height >= 12
    && getComputedStyle(chevron(open)).stroke === getComputedStyle(toggle(open)).color && getComputedStyle(chevron(open)).fill === 'none',
  `${size.width} ${getComputedStyle(chevron(open)).stroke}`);
  if (media('(forced-colors: active)')) {
    check('forced colors: the chevron shows in the button text color', getComputedStyle(chevron(open)).stroke === resolved('ButtonText')
      && getComputedStyle(toggle(open)).borderTopColor === resolved('ButtonText'), getComputedStyle(chevron(open)).stroke);
  }

  // Each transition is short, and reduced motion stops it.
  const all = [];
  const walk = (base) => {
    for (const item of base.querySelectorAll('*')) {
      all.push(item);
      if (item.shadowRoot) walk(item.shadowRoot);
    }
  };
  walk(stage);
  const times = (item) => getComputedStyle(item).transitionDuration.split(',').map((time) => parseFloat(time) * (time.trim().endsWith('ms') ? 1 : 1000));
  const longest = Math.max(...all.flatMap(times));
  const moving = all.filter((item) => times(item).some((time) => time > 0)).length;
  if (media('(prefers-reduced-motion: reduce)')) {
    check('reduced motion: no element has a transition or an animation', longest === 0
      && all.every((item) => getComputedStyle(item).animationName === 'none'), longest);
    check('reduced motion: the chevron turns with no animation', times(chevron(open)).every((time) => time === 0));
  } else {
    check('each transition is 120 ms at the maximum', longest > 0 && longest <= 120 && moving >= 20, `${longest} ${moving}`);
    check('the chevron turns in 120 ms', getComputedStyle(chevron(open)).transitionProperty === 'transform' && times(chevron(open))[0] === 120);
  }

  // A pending action is busy and accepts no second press. The receipt changes the state at once.
  busy.control.click();
  check('pending: the control is busy and disabled', busy.element.dataset.state === 'pending' && busy.control.getAttribute('aria-busy') === 'true'
    && busy.control.getAttribute('aria-disabled') === 'true' && getComputedStyle(busy.control).cursor === 'progress'
    && getComputedStyle(busy.control).opacity === (media('(forced-colors: active)') ? '1' : '0.6'), busy.control.outerHTML);
  busy.control.click();
  check('pending: a second press sends no second request', busy.requests.length === 1, busy.requests.length);
  done.control.click();
  const accepted = done.element.receipt({ id: done.requests[0].id, ok: true, message: 'The loan is renewed.', reference: 'R-0001' });
  check('receipt: the state changes in the same task', accepted && done.element.dataset.state === 'done'
    && !done.control.hasAttribute('aria-busy') && root(done.element).querySelector('[part="status"]').textContent.startsWith('Done: The loan is renewed.'),
  done.element.dataset.state);
  check('receipt: the reference has a copy control', root(done.element).querySelector('[part="reference"]').textContent === 'Reference: R-0001'
    && root(done.element).querySelector('[part="copy"]').getAttribute('aria-label') === 'Copy reference');
  done.control.click();
  check('receipt: a done button stays disabled and sends no second request',
    done.control.getAttribute('aria-disabled') === 'true' && done.requests.length === 1 && !done.control.querySelector('svg'));
  longReceipt.control.click();
  longReceipt.element.receipt({ id: longReceipt.requests[0].id, ok: true, reference: 'R'.repeat(80) });
  const doneStatus = root(done.element).querySelector('[part="status"]');
  const doneStyle = getComputedStyle(done.control);
  const offStyle = getComputedStyle(root(unavailable).querySelector('button'));
  const forced = media('(forced-colors: active)');
  const success = resolved(forced ? 'ButtonText' : 'var(--mu-color-success)');
  const canvas = resolved(forced ? 'CanvasText' : 'var(--mu-color-success)');
  check('receipt: the done button and state text use the success style',
    doneStyle.opacity === '1' && doneStyle.borderTopColor === success && doneStyle.color === success
    && doneStyle.borderTopColor !== offStyle.borderTopColor && getComputedStyle(doneStatus).color === canvas
    && doneStatus.checkVisibility());
  if (forced) {
    check('forced colors: the unavailable action uses GrayText', offStyle.color === resolved('GrayText')
      && offStyle.borderTopColor === resolved('GrayText'));
  } else {
    const surface = resolved('var(--mu-color-surface)');
    const page = resolved('var(--mu-color-page)');
    const copyStyle = getComputedStyle(root(done.element).querySelector('[part="copy"]'));
    const luminance = (value) => {
      const linear = value.match(/\d+/g).map((channel) => {
        const fraction = Number(channel) / 255;
        return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrast = (a, b) => {
      const [low, high] = [luminance(a), luminance(b)].sort((left, right) => left - right);
      return (high + 0.05) / (low + 0.05);
    };
    check('receipt: done and unavailable text have 4.5:1 contrast and their edges have 3:1 contrast',
      offStyle.opacity === '1' && contrast(offStyle.color, offStyle.backgroundColor) >= 4.5
      && contrast(offStyle.borderTopColor, page) >= 3 && contrast(doneStyle.borderTopColor, page) >= 3
      && contrast(doneStyle.color, doneStyle.backgroundColor) >= 4.5 && contrast(getComputedStyle(doneStatus).color, page) >= 4.5);
    check('receipt: the copy control has a less strong edge', contrast(copyStyle.borderTopColor, surface) >= 3
      && contrast(copyStyle.borderTopColor, surface) < contrast(copyStyle.color, surface));
  }
  if (media('(prefers-reduced-motion: reduce)')) {
    check('reduced motion: the done state and copy control have no motion',
      [done.control, doneStatus, root(done.element).querySelector('[part="copy"]')].every((item) =>
        times(item).every((time) => time === 0) && getComputedStyle(item).animationName === 'none'));
  }
  check('disabled: a disabled button has the disabled style', getComputedStyle(root(closed).querySelector('button')).opacity === (media('(forced-colors: active)') ? '1' : '0.6')
    && getComputedStyle(root(closed).querySelector('button')).cursor === 'not-allowed');
  // The radio and its label are one control, so the label has the disabled style too.
  const gray = document.createElement('span');
  gray.style.color = 'GrayText';
  document.body.append(gray);
  const dim = [...root(branch).querySelectorAll('.option label')].map((item) => getComputedStyle(item)).map((style) => ({
    opacity: style.opacity, cursor: style.cursor, gray: style.color === getComputedStyle(gray).color }));
  gray.remove();
  check('disabled: the label of a disabled option has the disabled style', dim.length === 2 && dim.every((item) => item.cursor === 'not-allowed'
    && (media('(forced-colors: active)') ? item.opacity === '1' && item.gray : item.opacity === '0.6')), dim);

  // Each empty state and each refused state tells the person what to do next.
  const EMPTY = {
    'card-grid': 'No cards. Change the request, or try again later.',
    table: 'No rows. Change the request, or try again later.',
    'rich-text': 'No text. Ask for the text again.',
    citation: 'No source given. Ask for the source before you use this text.',
    'source-status': 'No records. Add a record, or try again later.',
    diff: 'No changes. You do not need to review these versions.',
  };
  for (const [name, words] of Object.entries(EMPTY)) {
    const shown = root(empty[name]).querySelector('[part="empty"]')?.textContent;
    check(`empty: ${name} tells what to do next`, empty[name].dataset.state === 'empty' && shown === words, shown);
  }
  check('empty: a diff part with no change tells what to do next',
    root(changed).querySelector('details[data-state="empty"] [part="empty"]')?.textContent === 'No changes. You do not need to review this part.');
  for (const [kind, element] of Object.entries(refusals)) {
    const details = detailsOf(element);
    const next = root(element).querySelector('[part="next"]');
    const reason = root(element).querySelector('[part="reason"]');
    check(`refused ${kind}: the reason and next step come before the closed details`, reason?.textContent === REASON
      && reason.nextElementSibling === next && next?.textContent === NEXT
      && Boolean(next.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !details?.open && details?.firstElementChild.matches('summary') && details.firstElementChild.textContent === 'Technical details',
    root(element).textContent);
    const error = details?.querySelector('div');
    check(`refused ${kind}: the errors stay text`, error?.textContent === DETAILS
      && error.childNodes.length === 1 && error.firstChild.nodeType === Node.TEXT_NODE && !root(element).querySelector('img'), error?.textContent);
    const style = getComputedStyle(details.firstElementChild);
    const color = media('(forced-colors: active)') ? 'CanvasText' : style.getPropertyValue('--mu-color-danger').trim();
    check(`refused ${kind}: the summary has the state color, a 44 pixel target and respects reduced motion`,
      style.color === resolved(color) && details.firstElementChild.getBoundingClientRect().height >= 44
      && (!media('(prefers-reduced-motion: reduce)') || style.transitionDuration === '0s'), style.color);
  }
  check('refused: the element keeps no fill and sends all the errors in mu-refused',
    refused.dataset.state === 'refused' && refused.fill === null && refusalEvent?.target === refused && refusalEvent.bubbles && refusalEvent.composed
    && JSON.stringify(refusalEvent.detail) === JSON.stringify({ errors: ERRORS }), refusalEvent?.detail);

  // A long table keeps its column headers in view.
  const area = root(long).querySelector('[part="table"]');
  area.scrollTop = 600;
  const header = root(long).querySelector('thead th').getBoundingClientRect();
  const first = root(long).querySelector('tbody tr:first-child td').getBoundingClientRect();
  check('table: a long table scrolls in its own area', area.scrollHeight > area.clientHeight && area.scrollTop === 600
    && area.getBoundingClientRect().height <= 480, `${area.scrollHeight} ${area.clientHeight}`);
  check('table: the column headers stay in view', Math.abs(header.top - area.getBoundingClientRect().top) <= 1
    && getComputedStyle(root(long).querySelector('thead th')).position === 'sticky' && first.bottom < header.top,
  `${header.top} ${area.getBoundingClientRect().top}`);
  // The author of the table stays in view at the bottom of the area.
  const author = root(long).querySelector('[part="authorship"]');
  const areaBox = area.getBoundingClientRect();
  const authorBox = author.getBoundingClientRect();
  check('table: the author stays in view in a long table', getComputedStyle(author).position === 'sticky'
    && authorBox.top >= areaBox.top && authorBox.bottom <= areaBox.bottom + 1 && authorBox.height > 0,
  `${authorBox.top} ${authorBox.bottom} ${areaBox.top} ${areaBox.bottom}`);
  area.scrollTop = 0;

  // The copy control tells a failure, and it shows Copied only after the browser accepts the text.
  const copy = root(rich).querySelector('[part="copy"]');
  const copyStatus = root(rich).querySelector('[part="copy-status"]');
  const real = navigator.clipboard?.writeText;
  check('copy: the code block has a copy control with a name and a status', copy.textContent === 'Copy' && copy.getAttribute('aria-label') === 'Copy code'
    && copyStatus.getAttribute('role') === 'status' && copyStatus.textContent === '' && COPIED_TIME === 2000);
  if (navigator.clipboard) {
    let accept;
    navigator.clipboard.writeText = () => new Promise((yes) => { accept = yes; });
    copy.click();
    await tick();
    check('copy: Copied does not show before the browser accepts the text', copy.textContent === 'Copy' && copyStatus.textContent === '');
    accept();
    await tick();
    check('copy: Copied shows after the browser accepts the text', copy.textContent === 'Copied' && copyStatus.textContent === 'Copied');
    navigator.clipboard.writeText = () => Promise.reject(new Error('refused'));
    copy.click();
    await tick();
    check('copy: a failure tells the person to select the text', copy.textContent === 'Not copied'
      && copyStatus.textContent === 'Not copied. Select the text and copy it.', copyStatus.textContent);
    if (real) delete navigator.clipboard.writeText;
  }

  // The helpers of stateChecks. A control is a native control in a shadow root of the kit.
  const controls = [];
  const seek = (base) => {
    for (const item of base.querySelectorAll('*')) {
      if (item.shadowRoot) seek(item.shadowRoot);
      if (item.matches('button, input, textarea, select, summary') && item.getRootNode() !== document && item.getClientRects().length) controls.push(item);
    }
  };
  seek(stage);
  const kind = (item) => (item.matches('input[type="radio"], input[type="checkbox"]') ? 'option'
    : item.matches('input, textarea, select') ? 'text' : 'layer');
  // The element that shows hover and pressed: the row of a radio, or the control.
  const face = (item) => (kind(item) === 'option' ? item.closest('.option') : item);
  const off = (item) => item.disabled || item.getAttribute('aria-disabled') === 'true';
  window.muControls = () => controls.length;
  window.muFocusToken = () => resolved(getComputedStyle(document.documentElement).getPropertyValue('--mu-color-focus').trim());
  window.muPoint = (index) => {
    const item = controls[index];
    item.scrollIntoView({ block: 'center', behavior: 'instant' });
    const box = item.getBoundingClientRect();
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2), kind: kind(item), disabled: off(item),
      opaque: [done.control, longReceipt.control].includes(item) || item.getRootNode().host === unavailable,
      name: `${item.getRootNode().host.localName} ${item.getAttribute('aria-label') || item.textContent.trim() || item.type}` };
  };
  window.muStyle = (index) => {
    const item = controls[index];
    const layer = face(item);
    // Read the final state styles. The motion checks above measure the transition durations.
    for (const transition of layer.getAnimations()) {
      if (transition instanceof CSSTransition) transition.finish();
    }
    const style = getComputedStyle(item);
    const shown = getComputedStyle(layer);
    // A line that does not show has no color: a border or an outline with no style or no width.
    // A link shows hover as a thick underline.
    const line = (name) => (shown[`${name}Style`] !== 'none' && shown[`${name}Width`] !== '0px' ? shown[`${name}Color`] : 'none');
    return { layer: `${shown.boxShadow} | ${shown.backgroundColor} | ${shown.outlineStyle}`, edge: `${line('borderTop')} | ${line('outline')} | ${shown.textDecorationLine === 'none' ? 'none' : shown.textDecorationThickness}`,
      ring: `${style.outlineStyle} ${style.outlineWidth}`, opacity: style.opacity, cursor: style.cursor };
  };
  window.muFocus = (index) => {
    const item = controls[index];
    item.focus();
    const style = getComputedStyle(item);
    return { name: window.muPoint(index).name, disabled: item.disabled, focused: item.getRootNode().activeElement === item,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset}` };
  };
  window.muBlur = () => { for (const item of controls) item.blur(); return true; };
  const copies = { code: rich, reference: done.element, ...refusals };
  window.muRefusalStart = (kind) => {
    probe.tabIndex = -1;
    refusals[kind].before(probe);
    probe.focus();
  };
  window.muRefusalOpen = (kind, open) => { detailsOf(refusals[kind]).open = open; };
  window.muRefusalState = (kind) => {
    const details = detailsOf(refusals[kind]);
    const focus = root(refusals[kind]).activeElement;
    return { open: details.open, visible: details.querySelector('div').checkVisibility(),
      focus: focus?.getAttribute('aria-label') ?? focus?.textContent, ring: focus && getComputedStyle(focus).outlineStyle };
  };
  window.muReceiptLayout = () => {
    const reference = root(done.element).querySelector('[part="reference"]');
    const copy = root(done.element).querySelector('[part="copy"]');
    const row = reference.parentElement;
    const box = (item) => item.getBoundingClientRect();
    const initial = box(copy);
    const label = box(reference);
    const sameRow = row.contains(copy) && initial.left >= label.right && initial.top <= label.top && initial.bottom >= label.bottom;
    const scroll = document.documentElement.scrollWidth - innerWidth;
    done.element.style.inlineSize = '100px';
    const wraps = box(copy).top >= box(reference).bottom;
    done.element.style.inlineSize = '';
    return { width: innerWidth, scroll, sameRow, wraps, target: initial.width >= controlSize(copy) && initial.height >= controlSize(copy) };
  };
  window.muCopyPoint = (name) => {
    const item = root(copies[name]).querySelector('[part="copy"]');
    item.scrollIntoView({ block: 'center', behavior: 'instant' });
    const box = item.getBoundingClientRect();
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  };
  window.muCopyState = (name) => {
    const item = root(copies[name]).querySelector('[part="copy"]');
    const said = root(copies[name]).querySelector('[part="copy-status"]');
    return { label: item.textContent, name: item.getAttribute('aria-label'), status: said.textContent, role: said.getAttribute('role') };
  };
  window.muGaps = () => {
    const box = (item) => item.getBoundingClientRect();
    const buttons = [...root(grid).querySelectorAll('.collapse-controls button')].map(box);
    const article = root(shut).querySelector('article');
    const parts = [...article.children].filter((item) => item.getClientRects().length).map(box);
    const style = getComputedStyle(article);
    const [first, second] = buttons;
    return { width: innerWidth, scroll: document.documentElement.scrollWidth - innerWidth,
      above: Math.round(Math.min(...buttons.map((item) => item.top)) - box(document.getElementById('above')).bottom),
      below: Math.round(box(root(grid).querySelector('ul')).top - Math.max(...buttons.map((item) => item.bottom))),
      between: Math.round(second.top >= first.bottom ? second.top - first.bottom : second.left - first.right),
      parts: parts.slice(1).map((item, index) => Math.round(item.top - parts[index].bottom)),
      under: Math.round(box(article).bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth) - parts.at(-1).bottom),
      hidden: [...article.children].filter((item) => item.hidden && item.getClientRects().length).length };
  };
  probe.style.color = '';
  window.muChecks = { mode, results };
}
if (typeof window !== 'undefined') await browserChecks();
