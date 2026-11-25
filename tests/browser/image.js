// The browser checks come from catalog/image.json. The runner uses real keys in all four media modes.
export async function imageKeyboardChecks(session, sessionId, { evaluate, key, axErrors }, page) {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ page, step: name, ok, detail: String(detail) });
  await evaluate(session, sessionId, 'window.muFocusImage()');
  await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  let state = await evaluate(session, sessionId, 'window.muImageState()');
  check('Enter opens the native image dialog and focuses Close image', state.open && state.closeFocused, JSON.stringify(state));
  for (const item of await axErrors(session, sessionId, [['dialog', 'Full-size image'], ['button', 'Close image'],
    ['image', 'Two rooms with a door.']], page)) check('accessibility: ' + item.role + ' ' + item.name, item.ok);
  // A native modal dialog makes the page behind it inert. Tab at the end of the dialog moves the focus
  // to the browser, outside the page. Thus the check does not press Tab here.
  check('The image dialog is modal and the page behind it is inert', state.modal, JSON.stringify(state));
  await key(session, sessionId, 'Escape', 'Escape', 27);
  // Headless Chrome marks the page hidden after an Escape key event. Show the page again before the next check.
  await session.send('Page.bringToFront', {}, sessionId);
  state = await evaluate(session, sessionId, 'window.muImageState()');
  check('Escape closes the image dialog and returns focus', !state.open && state.imageFocused, JSON.stringify(state));
  await key(session, sessionId, ' ', 'Space', 32, ' ');
  state = await evaluate(session, sessionId, 'window.muImageState()');
  check('Space opens the image dialog', state.open && state.closeFocused);
  await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  state = await evaluate(session, sessionId, 'window.muImageState()');
  check('Enter on Close image closes the dialog and returns focus', !state.open && state.imageFocused, JSON.stringify(state));
  await evaluate(session, sessionId, 'window.muResetImageFocus()');
  return results;
}

async function browserChecks() {
  const { define, MuImage } = await import('../../src/components/index.js');
  const { define: defineThread } = await import('../../src/thread/index.js');
  define();
  defineThread();
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const stage = document.getElementById('stage');
  const AUTHOR = { type: 'agent', id: 'agent-plan' };
  const DATA = { url: '/examples/media/floor-plan.svg', alt: 'Two rooms with a door.', width: 480, height: 320 };
  const fill = (data = DATA) => ({ component: 'image', version: '0.1.0', data, slots: { authorship: AUTHOR } });
  const mount = (data = DATA, author = AUTHOR) => {
    const node = document.createElement('mu-image');
    node.actor = author;
    stage.append(node);
    node.fill = fill(data);
    return node;
  };
  const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
  const wait = async (test) => {
    for (let i = 0; i < 60 && !test(); i += 1) await frame();
    return test();
  };
  const root = (node) => node.shadowRoot;
  const image = (node) => root(node).querySelector('img');
  const button = (node) => root(node).querySelector('[part="open"]');
  const box = (node) => root(node).querySelector('[part="box"]').getBoundingClientRect();
  const refused = (node) => node.dataset.state === 'refused' && node.fill === null && !image(node)
    && root(node).querySelector('[part="details"] > div')?.textContent.startsWith('image:');

  check('origins: the page starts with no permitted origin', MuImage.allowedOrigins.length === 0 && refused(mount()));
  const origins = [location.origin];
  MuImage.allowedOrigins = origins;
  origins.push('https://example.org');
  check('origins: page policy is a frozen copy', Object.isFrozen(MuImage.allowedOrigins) && MuImage.allowedOrigins.length === 1);
  for (const origin of ['null', 'data:', location.origin + '/path', 'https://user@example.org']) {
    let threw = false;
    try { MuImage.allowedOrigins = [origin]; } catch (error) { threw = error instanceof TypeError; }
    check('origins: an invalid page origin is refused: ' + origin, threw && MuImage.allowedOrigins[0] === location.origin);
  }

  // Intercept src assignment. No refused fill must reach the request sink, even if CSP would block it.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const requests = [];
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor,
    set(value) { requests.push(value); descriptor.set.call(this, value); } });
  try {
    for (const url of ['https://example.org/plan.svg', '//example.org/plan.svg', 'javascript:alert(1)',
      'data:image/svg+xml,<svg/>', 'blob:' + location.origin + '/image', 'http://[',
      location.origin.replace('://', '://user:secret@') + '/plan.svg']) {
      const count = requests.length;
      check('URL: refuses before a request: ' + url, refused(mount({ ...DATA, url })) && requests.length === count);
    }
    for (const change of [{ allowedOrigins: ['https://example.org'] }, { srcset: '/plan.svg 2x' }, { style: 'color:red' },
      { alt: '' }, { alt: ' \n\t' }, { width: 0 }, { height: 4097 }]) {
      const count = requests.length;
      check('fill: refuses invalid data before a request: ' + JSON.stringify(change),
        refused(mount({ ...DATA, ...change })) && requests.length === count);
    }
    const count = requests.length;
    check('actor: refuses a false author before a request', refused(mount(DATA, { type: 'human', id: 'person-plan' }))
      && requests.length === count);
  } finally { Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor); }

  const node = mount({ ...DATA, caption: 'Synthetic floor plan.' });
  const initial = box(node);
  check('loading: state, notice, disabled open button and fixed ratio', node.dataset.state === 'loading'
    && root(node).textContent.includes('Loading image.') && button(node).disabled
    && Math.abs(initial.width / initial.height - 1.5) < 0.02);
  check('request: URL resolves against the page origin', image(node).src === location.origin + DATA.url);
  check('request: no referrer, async decoding, no srcset', image(node).referrerPolicy === 'no-referrer'
    && image(node).decoding === 'async' && !image(node).hasAttribute('srcset'));
  const loaded = await wait(() => node.dataset.state !== 'loading');
  check('default: a real SVG loads', loaded && node.dataset.state === 'default' && image(node).naturalWidth > 0);
  const loadedBox = box(node);
  check('default: load does not move the layout', initial.width === loadedBox.width && initial.height === loadedBox.height);
  check('accessibility: group name, text alternative, caption and author', root(node).querySelector('[role="group"]')?.getAttribute('aria-label') === 'Image'
    && image(node).alt === DATA.alt && button(node).getAttribute('aria-label') === 'Open image at full size: ' + DATA.alt
    && root(node).textContent.includes('Synthetic floor plan.')
    && root(node).textContent.includes('Author: agent agent-plan') && !button(node).disabled);

  // A declared square box stays square even when the natural image has a different ratio.
  const square = mount({ ...DATA, height: 480 });
  const squareBox = box(square);
  await wait(() => square.dataset.state !== 'loading');
  check('layout: natural dimensions cannot change the declared box', squareBox.width === box(square).width
    && squareBox.height === box(square).height && Math.abs(squareBox.width - squareBox.height) < 1);

  const failed = mount({ ...DATA, url: '/tests/browser/image.html' });
  const failedBox = box(failed);
  // A page is not an image. Its 200 response gives a decode error with no expected HTTP error in the runner log.
  await wait(() => failed.dataset.state !== 'loading');
  check('error: failed notice and alternative show as text', failed.dataset.state === 'error'
    && root(failed).querySelector('[role="status"]').textContent === 'Image failed to load. ' + DATA.alt && button(failed).disabled);
  check('error: failure keeps the fixed box', failedBox.width === box(failed).width && failedBox.height === box(failed).height);
  image(failed).dispatchEvent(new Event('load'));
  check('error: a late load cannot replace the failed state', failed.dataset.state === 'error');

  const decorative = mount({ ...DATA, alt: '', decorative: true });
  await wait(() => decorative.dataset.state !== 'loading');
  check('decorative: an empty alternative is permitted', decorative.dataset.state === 'default' && image(decorative).alt === '');
  const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
  const marked = mount({ ...DATA, url: DATA.url + '?text=' + MARKUP, alt: MARKUP, caption: MARKUP });
  await wait(() => marked.dataset.state !== 'loading');
  check('text: markup makes no extra element', image(marked).alt === MARKUP && root(marked).textContent.includes(MARKUP)
    && root(marked).querySelectorAll('img').length === 1 && !root(marked).querySelector('script, a') && window.muUnsafe === undefined);
  const oldImage = image(marked);
  marked.fill = fill({ ...DATA, url: 'data:image/svg+xml,bad' });
  oldImage.dispatchEvent(new Event('load'));
  check('refill: stale image events cannot replace a refusal', refused(marked));

  button(node).focus();
  button(node).click();
  const dialog = root(node).querySelector('dialog');
  check('dialog: native modal, full-size image and Close image focus', dialog instanceof HTMLDialogElement && dialog.open
    && dialog.matches(':modal') && root(node).activeElement?.textContent === 'Close image'
    && dialog.querySelector('img')?.alt === DATA.alt && getComputedStyle(dialog.querySelector('img')).maxWidth === 'none');
  dialog.querySelector('button').click();
  await frame();
  check('dialog: close button restores image button focus', !dialog.open && root(node).activeElement === button(node));

  MuImage.allowedOrigins = [];
  check('origins: a page policy change removes existing images', refused(node) && refused(square));
  MuImage.allowedOrigins = [location.origin];

  const card = document.createElement('mu-card');
  card.actor = AUTHOR;
  card.fill = { component: 'card', version: '0.1.0', data: { title: 'Synthetic plan' }, slots: { authorship: AUTHOR } };
  const inCard = mount();
  inCard.slot = 'actions';
  card.append(inCard);
  stage.append(card);
  await wait(() => inCard.dataset.state !== 'loading');
  check('card: an image works in the card content slot', inCard.dataset.state === 'default' && inCard.assignedSlot?.localName === 'slot');
  const thread = document.createElement('mu-thread');
  stage.append(thread);
  thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'image-message', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill() } });
  await wait(() => thread.shadowRoot.querySelector('mu-image')?.dataset.state === 'default');
  const inThread = thread.shadowRoot.querySelector('mu-image');
  check('thread: an image part binds the envelope actor', inThread?.dataset.state === 'default' && inThread.actor.id === AUTHOR.id);

  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const media = { dark: '(prefers-color-scheme: dark)', 'forced-colors': '(forced-colors: active)',
    'reduced-motion': '(prefers-reduced-motion: reduce)' };
  if (media[mode]) check('media: requested mode is active', matchMedia(media[mode]).matches);
  if (mode === 'forced-colors') {
    const style = getComputedStyle(button(inCard));
    check('forced colors: button border is visible', style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) >= 1);
  }
  if (mode === 'reduced-motion') {
    const style = getComputedStyle(button(inCard));
    check('reduced motion: no transition or animation', parseFloat(style.transitionDuration) === 0 && style.animationName === 'none');
  }

  // These checks moved the focus. Put the Tab start point before the keyboard targets.
  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  start.focus();
  const target = document.createElement('mu-button');
  target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target);
  const keyboardImage = mount();
  keyboard.append(keyboardImage);
  await wait(() => keyboardImage.dataset.state !== 'loading');
  window.muPresses = () => presses;
  window.muFocusImage = () => { button(keyboardImage).focus(); return true; };
  window.muImageState = async () => { await frame(); return { open: root(keyboardImage).querySelector('dialog').open,
    modal: root(keyboardImage).querySelector('dialog').matches(':modal'),
    closeFocused: root(keyboardImage).activeElement === root(keyboardImage).querySelector('dialog > button'),
    imageFocused: root(keyboardImage).activeElement === button(keyboardImage) }; };
  window.muResetImageFocus = () => { start.focus(); return true; };
  window.muChecks = { mode, results };
}

if (typeof window !== 'undefined') await browserChecks();
