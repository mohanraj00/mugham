// Expected elements, limits and refusal texts come from catalog/rich-*.json and src/components/rich-text.md.
// tools/browser_check.mjs imports the keyboard checks in Node and loads this page in each media mode.
export async function richTextKeyboardChecks(session, sessionId, { evaluate, key }, page) {
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const state = () => evaluate(session, sessionId, 'window.muLinkState()');
  // The focus is on the first button of the page. The next Tab stop is the link.
  await key(session, sessionId, 'Tab', 'Tab', 9);
  let found = await state();
  check('Tab focuses the link and shows its target', found.focused && found.target === 'Opens https://example.org/rules', found);
  await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  await key(session, sessionId, ' ', 'Space', 32, ' ');
  found = await state();
  check('Enter and Space press the link', found.opens === 2 && found.focused, found);
  await key(session, sessionId, 'Escape', 'Escape', 27);
  // Headless Chrome marks the page hidden after an Escape key event. Show the page again before the next step.
  await session.send('Page.bringToFront', {}, sessionId);
  found = await state();
  // The page reads the target at the key event, because the browser focuses the link again when the page shows again.
  check('Escape hides the target and keeps the focus', found.focused && found.escaped === true, found);
  const tab = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...tab }, sessionId);
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...tab }, sessionId);
  found = await state();
  check('Shift+Tab moves the focus back to the first button', !found.focused && found.active === 'Keyboard target', found);
  return results;
}

async function browserChecks() {
  const { MuRichText } = await import('../../src/components/rich-text.js');
  const { define } = await import('../../src/thread/index.js');
  const { CATALOG } = await import('../../src/render/catalog.js');
  define();

  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const AUTHOR = { type: 'agent', id: 'agent-garden', name: 'Garden helper' };
  const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script><a href="https://example.org/">x</a>';
  const BLOCKS = 'rich-paragraph or rich-heading or rich-list or rich-code or rich-quote';
  const node = (component, data) => ({ component, version: '0.1.0', data });
  const span = (text, mark) => node('rich-span', mark ? { text, mark } : { text });
  const link = (text, url) => node('rich-link', { text, url });
  const paragraph = (...content) => node('rich-paragraph', { content });
  const heading = (level, ...content) => node('rich-heading', { level, content });
  const list = (ordered, ...items) => node('rich-list', { ordered, items });
  const code = (text) => node('rich-code', { text });
  const quote = (...paragraphs) => node('rich-quote', { paragraphs });
  const fill = (...blocks) => ({ component: 'rich-text', version: '0.1.0', data: { blocks }, slots: { authorship: AUTHOR } });
  const stage = document.getElementById('stage');
  const root = (element) => element.shadowRoot;
  const tags = (element, selector) => [...root(element).querySelectorAll(selector)].map((item) => item.localName).join(' ');
  const refusal = (element) => (element.dataset.state === 'refused' ? root(element).querySelector('[part="details"] > div')?.textContent : null);
  function mount(value, parent = stage) {
    const element = new MuRichText();
    element.actor = AUTHOR;
    parent.append(element);
    element.fill = value;
    return element;
  }
  const RULES = 'https://example.org/rules';
  const ANSWER = fill(
    heading(1, span('Tray care')),
    paragraph(span('Keep the tray '), span('dry', 'strong'), span(' and '), span('cool', 'emphasis'), span('. Run '), span('tray check', 'code'), span('.')),
    list(true, paragraph(span('Open the tray.')), paragraph(span('Read the '), link('Synthetic rules', RULES), span('.')), paragraph(span('Close the tray.'))),
    list(false, paragraph(span('Seeds')), paragraph(span('Labels'))),
    heading(2, span('Details')),
    code('tray check --all\n  <b>not markup</b>'),
    quote(paragraph(span('A dry tray keeps its seeds.')), paragraph(span('Line one.\nLine two.'))),
    heading(3, span('Notes')),
  );

  // Each node type makes its fixed element. A text goes into a text node.
  const answer = mount(ANSWER);
  const wrapper = root(answer).querySelector('[part="rich-text"]');
  check('each node type: the fill is valid', answer.dataset.state === 'default' && answer.fill !== null, root(answer).textContent);
  check('each node type: the blocks show in order', tags(answer, '[part="rich-text"] > *') === 'h2 p ol ul h3 div blockquote h4 p',
    tags(answer, '[part="rich-text"] > *'));
  check('heading: the text shows', root(answer).querySelector('h2')?.textContent === 'Tray care');
  check('paragraph: the marks are strong, em and code', tags(answer, '[part="rich-text"] > p:first-of-type > *') === 'strong em code'
    && root(answer).querySelector('p')?.textContent === 'Keep the tray dry and cool. Run tray check.', tags(answer, 'p:first-of-type > *'));
  check('list: a numbered list has three items', root(answer).querySelectorAll('ol > li').length === 3
    && root(answer).querySelector('ol > li')?.textContent === 'Open the tray.');
  check('list: a bullet list has two items', root(answer).querySelectorAll('ul > li').length === 2);
  check('code block: the text shows as text', root(answer).querySelector('pre > code')?.textContent === 'tray check --all\n  <b>not markup</b>'
    && !root(answer).querySelector('b'));
  check('quote: each paragraph shows', tags(answer, 'blockquote > *') === 'p p'
    && root(answer).querySelector('blockquote p:last-child')?.textContent === 'Line one.\nLine two.');
  check('paragraph: a line break in the text shows', getComputedStyle(root(answer).querySelector('blockquote p:last-child')).whiteSpace.startsWith('pre-wrap'));
  check('the author shows as text', root(answer).querySelector('[part="authorship"]')?.textContent === 'Author: agent agent-garden (Garden helper)');
  // The contract declares these elements and attributes. No fill can add a different one.
  const ELEMENTS = new Set(['div', 'p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'blockquote', 'em', 'strong', 'span', 'button']);
  // The copy control of a code block is a kit button with a fixed name, and its status is a kit live region.
  const ATTRIBUTES = new Set(['class', 'part', 'id', 'type', 'aria-describedby', 'hidden', 'aria-label', 'role', 'aria-live']);
  const strange = (element) => [...root(element).querySelectorAll('*')].flatMap((item) => [
    ...(ELEMENTS.has(item.localName) ? [] : [item.localName]),
    ...item.getAttributeNames().filter((name) => !ATTRIBUTES.has(name)).map((name) => `${item.localName}[${name}]`)]);
  check('each element and attribute is in the fixed list', strange(answer).length === 0, strange(answer).join(' '));
  const style = getComputedStyle(root(answer).querySelector('h2'));
  check('heading: the weight is strong', Number(style.fontWeight) >= 600, style.fontWeight);

  // A link is a button with no address attribute. Its target shows on hover and on focus.
  const button = root(answer).querySelector('[part="link"]');
  const target = root(answer).querySelector('[part="target"]');
  const visible = () => !target.hidden && getComputedStyle(target).display !== 'none';
  check('link: the button has the link text and no address', button?.localName === 'button' && button.textContent === 'Synthetic rules'
    && !root(answer).querySelector('a, [href]'));
  check('link: the target is the description of the button', target?.textContent === 'Opens ' + RULES
    && button.getAttribute('aria-describedby') === target.id && root(answer).querySelectorAll('#' + target.id).length === 1);
  check('link: the target is hidden with no hover and no focus', !visible());
  button.focus();
  check('link: the target shows on focus', visible());
  button.blur();
  check('link: the target hides after the focus leaves', !visible());
  button.parentElement.dispatchEvent(new MouseEvent('mouseenter'));
  check('link: the target shows on hover', visible());
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  check('link: Escape hides the target', !visible());
  button.parentElement.dispatchEvent(new MouseEvent('mouseenter'));
  button.parentElement.dispatchEvent(new MouseEvent('mouseleave'));
  check('link: the target hides after the pointer leaves', !visible());
  // The target opens only after a press. The application can cancel the mu-open event.
  const calls = [];
  const realOpen = window.open;
  window.open = (...values) => { calls.push(values); return null; };
  const opened = [];
  const cancel = (event) => { opened.push(event.detail.locator); event.preventDefault(); };
  document.addEventListener('mu-open', cancel);
  check('link: a render opens nothing', calls.length === 0 && opened.length === 0);
  button.click();
  check('link: a press sends mu-open with the target', opened.join() === RULES);
  check('link: a canceled mu-open opens nothing', calls.length === 0);
  document.removeEventListener('mu-open', cancel);
  button.click();
  check('link: a press opens the target in a new tab with no opener and no referrer',
    JSON.stringify(calls) === JSON.stringify([[RULES, '_blank', 'noopener,noreferrer']]), JSON.stringify(calls));
  window.open = realOpen;

  // Markup, script text and a script address make no element and no handler.
  const marked = mount(fill(heading(1, span(MARKUP)), paragraph(span(MARKUP), span(MARKUP, 'strong'), link(MARKUP, RULES)),
    list(false, paragraph(span(MARKUP, 'code'))), code(MARKUP), quote(paragraph(span(MARKUP, 'emphasis')))));
  check('markup: each text shows as text', marked.dataset.state === 'default'
    && ['h2', 'p > strong', '[part="link"]', 'li > code', 'pre > code', 'blockquote em'].every((selector) => root(marked).querySelector(selector)?.textContent === MARKUP));
  check('markup: no element and no handler appears', !root(marked).querySelector('img, script, a, [href], [src], [style]')
    && strange(marked).length === 0 && window.muUnsafe === undefined, strange(marked).join(' '));
  const SCRIPT = 'java' + 'script:window.muUnsafe=1';
  for (const [name, url] of [['a script address', SCRIPT], ['a script address with a tab', 'java\tscript:window.muUnsafe=1'],
    ['a script address in upper case', SCRIPT.toUpperCase()], ['a data address', 'data:text/html,<script>window.muUnsafe=1</script>'],
    ['a relative address', '/rules'], ['an address with a user name', 'https://person@example.org/rules'],
    ['an http address', 'http://example.org/rules'], ['a mail address', 'mailto:desk@example.org'], ['text that is no address', 'rules page 4']]) {
    const bad = mount(fill(paragraph(span('Read the '), link('Synthetic rules', url))));
    check(`link: ${name} is refused`, refusal(bad) === 'rich-text: data.blocks[0].data.content[1].data.url: the page does not permit this link'
      && !root(bad).querySelector('button:not([part="copy"]), a, [href]') && bad.fill === null && window.muUnsafe === undefined, root(bad).textContent);
  }
  const inList = mount(fill(list(false, paragraph(span('One')), paragraph(link('Two', SCRIPT)))));
  check('link: the refusal gives the path of a link in a list', refusal(inList) === 'rich-text: data.blocks[0].data.items[1].data.content[0].data.url: the page does not permit this link');
  const inQuote = mount(fill(quote(paragraph(link('Two', SCRIPT)))));
  check('link: the refusal gives the path of a link in a quote', refusal(inQuote) === 'rich-text: data.blocks[0].data.paragraphs[0].data.content[0].data.url: the page does not permit this link');

  // The page sets the schemes. A fill cannot set them. A new policy applies to each connected rich text.
  check('schemes: the default is https only', MuRichText.linkSchemes.join() === 'https:' && Object.isFrozen(MuRichText.linkSchemes));
  const plain = mount(fill(paragraph(link('Plain rules', 'http://example.org/rules'))));
  const mail = mount(fill(paragraph(link('Write to the desk', 'mailto:desk@example.org'))));
  const headers = mount(fill(paragraph(link('Write to the desk', 'mailto:desk@example.org?subject=x'))));
  check('schemes: http and mailto are refused before the page permits them', plain.dataset.state === 'refused' && mail.dataset.state === 'refused');
  MuRichText.linkSchemes = ['https:', 'http:', 'mailto:', 'http:'];
  plain.fill = fill(paragraph(link('Plain rules', 'http://example.org/rules')));
  mail.fill = fill(paragraph(link('Write to the desk', 'mailto:desk@example.org')));
  headers.fill = fill(paragraph(link('Write to the desk', 'mailto:desk@example.org?subject=x')));
  check('schemes: the page can permit http and mailto', MuRichText.linkSchemes.join() === 'https:,http:,mailto:'
    && root(plain).querySelector('[part="target"]')?.textContent === 'Opens http://example.org/rules'
    && root(mail).querySelector('[part="target"]')?.textContent === 'Opens mailto:desk@example.org');
  check('schemes: a mail link with a header field is refused', headers.dataset.state === 'refused', root(headers).textContent);
  MuRichText.linkSchemes = ['https:'];
  check('schemes: a new policy refuses a rich text that is on the page', plain.dataset.state === 'refused' && plain.fill === null
    && mail.dataset.state === 'refused' && answer.dataset.state === 'default');
  const thrown = (act) => { try { act(); return ''; } catch (error) { return `${error.name}: ${error.message}`; } };
  for (const value of ['https:', ['ftp:'], ['https:', SCRIPT.split(':')[0] + ':'], [7], null]) {
    check(`schemes: ${JSON.stringify(value)} is not a policy`, thrown(() => { MuRichText.linkSchemes = value; })
      === 'TypeError: link schemes: must be an array of https:, http:, mailto:' && MuRichText.linkSchemes.join() === 'https:');
  }
  check('schemes: a fill cannot set the policy', refusal(mount({ ...fill(paragraph(span('x'))), data: { blocks: [], linkSchemes: ['http:'] } }))
    === 'rich-text: data.linkSchemes: the contract does not declare this field');

  // Headings: the page sets the first level. A heading cannot skip a level.
  check('heading: the default first level is 2', MuRichText.headingLevel === 2 && tags(answer, '.heading') === 'h2 h3 h4');
  MuRichText.headingLevel = 3;
  check('heading: the page moves each heading down', tags(answer, '.heading') === 'h3 h4 h5', tags(answer, '.heading'));
  MuRichText.headingLevel = 5;
  check('heading: no heading goes below level 6', tags(answer, '.heading') === 'h5 h6 h6', tags(answer, '.heading'));
  MuRichText.headingLevel = 2;
  for (const value of [1, 7, 2.5, '2', null]) {
    check(`heading: ${JSON.stringify(value)} is not a first level`, thrown(() => { MuRichText.headingLevel = value; })
      === 'TypeError: heading level: must be an integer from 2 to 6' && MuRichText.headingLevel === 2);
  }
  check('heading: a first heading of level 2 is refused', refusal(mount(fill(paragraph(span('x')), heading(2, span('Details')))))
    === 'rich-text: data.blocks[1].data.level: a heading cannot skip a level');
  check('heading: level 1 then level 3 is refused', refusal(mount(fill(heading(1, span('A')), heading(3, span('B')))))
    === 'rich-text: data.blocks[1].data.level: a heading cannot skip a level');
  check('heading: a heading can go up by more than one level', mount(fill(heading(1, span('A')), heading(2, span('B')), heading(3, span('C')),
    heading(1, span('D')))).dataset.state === 'default');
  check('heading: no element has the level 1 of the page', !root(answer).querySelector('h1'));

  // An unknown node type and an undeclared attribute show a refusal.
  check('an unknown block type is refused', refusal(mount(fill(node('rich-table', { rows: [] }))))
    === 'rich-text: data.blocks[0].component: must be ' + BLOCKS);
  check('an unknown inline type is refused', refusal(mount(fill(paragraph(node('rich-image', { url: RULES })))))
    === 'rich-text: data.blocks[0].data.content[0].component: must be rich-span or rich-link');
  for (const key of ['style', 'class', 'onclick', 'href', 'id']) {
    check(`a span with ${key} is refused`, refusal(mount(fill(paragraph(node('rich-span', { text: 'x', [key]: 'x' })))))
      === `rich-text: data.blocks[0].data.content[0].data.${key}: the contract does not declare this field`);
  }
  check('an undeclared mark is refused', refusal(mount(fill(paragraph(span('x', 'underline')))))
    === 'rich-text: data.blocks[0].data.content[0].data.mark: must be one of emphasis, strong, code');

  // States: empty, the size limit and the author.
  const empty = mount(fill());
  check('empty: a rich text with no block shows a text', empty.dataset.state === 'empty' && root(empty).querySelector('[part="empty"]')?.textContent === 'No text. Ask for the text again.');
  const row = Array.from({ length: 50 }, () => span('x'));
  check('size: 2000 inline nodes are valid', mount(fill(...Array.from({ length: 40 }, () => paragraph(...row)))).dataset.state === 'default');
  check('size: more than 2000 inline nodes are refused', refusal(mount(fill(...Array.from({ length: 40 }, () => paragraph(...row)), paragraph(span('x')))))
    === 'rich-text: data.blocks: more than 2000 inline nodes');
  const unbound = document.createElement('mu-rich-text');
  stage.append(unbound);
  unbound.fill = fill(paragraph(span('x')));
  check('author: a fill with no bound actor is refused', unbound.dataset.state === 'refused');
  const spoof = mount(fill(paragraph(span('x'))));
  spoof.fill = { ...fill(paragraph(span('x'))), slots: { authorship: { type: 'human', id: 'person-check' } } };
  check('author: a different author is refused', spoof.dataset.state === 'refused');
  const errors = [];
  spoof.addEventListener('mu-refused', (event) => errors.push(...event.detail.errors));
  spoof.fill = fill(node('rich-table', {}));
  check('the refusal event gives the errors', errors.join('|') === 'data.blocks[0].component: must be ' + BLOCKS, errors.join('|'));

  // Tokens and media modes.
  const css = MuRichText.styles.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ');
  const declared = new Set(CATALOG['rich-text'].tokens.map((token) => '--mu-' + token.replaceAll('.', '-')));
  const used = new Set(css.match(/--mu-[a-z0-9-]+/g) ?? []);
  check('the styles use each declared token and no other token', [...used].every((token) => declared.has(token)) && used.size === declared.size,
    [...used].filter((token) => !declared.has(token)).join(' '));
  const media = { dark: '(prefers-color-scheme: dark)', 'forced-colors': '(forced-colors: active)', 'reduced-motion': '(prefers-reduced-motion: reduce)' };
  if (media[mode]) check('media: the requested mode is active', matchMedia(media[mode]).matches);
  const probe = document.createElement('span');
  stage.append(probe);
  const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  // A policy change rendered the answer again, so read its link and its target again.
  const shownLink = root(answer).querySelector('[part="link"]');
  const shownTarget = root(answer).querySelector('[part="target"]');
  check('policy: a policy change renders the rich text again', shownLink !== button && !button.isConnected);
  const linkStyle = getComputedStyle(shownLink);
  check('link: the text has an underline', linkStyle.textDecorationLine === 'underline');
  if (mode === 'light' || mode === 'dark') {
    probe.style.color = 'var(--mu-color-accent)';
    check(`${mode}: the link has the accent color`, linkStyle.color === getComputedStyle(probe).color, linkStyle.color);
  }
  if (mode === 'forced-colors') {
    shownLink.focus();
    const tip = getComputedStyle(shownTarget);
    check('forced colors: the link has the system link color', linkStyle.color === resolved('LinkText'), linkStyle.color);
    check('forced colors: the target has system colors', tip.color === resolved('CanvasText') && tip.backgroundColor === resolved('Canvas')
      && tip.borderTopColor === resolved('CanvasText'), `${tip.color} ${tip.backgroundColor}`);
    check('forced colors: the code block and the quote keep a border', getComputedStyle(root(answer).querySelector('pre')).borderTopStyle === 'solid'
      && getComputedStyle(root(answer).querySelector('blockquote')).borderInlineStartStyle === 'solid');
    check('forced colors: the refusal is visible', getComputedStyle(root(unbound).querySelector('[role="status"]')).color === resolved('CanvasText'));
    shownLink.blur();
  }
  if (mode === 'reduced-motion') {
    check('reduced motion: no transition or animation', parseFloat(linkStyle.transitionDuration) === 0 && linkStyle.animationName === 'none');
  }

  // A card and a thread show rich text. The thread binds the actor of the envelope.
  const card = document.createElement('mu-card');
  card.actor = AUTHOR;
  card.fill = { component: 'card', version: '0.1.0', data: { title: 'Tray A1' }, slots: { authorship: AUTHOR } };
  const inCard = mount(fill(paragraph(span('The tray is dry.'))), card);
  inCard.slot = 'actions';
  stage.append(card);
  check('card: rich text shows in the page slot of a card', inCard.dataset.state === 'default' && inCard.assignedSlot?.localName === 'slot');
  const thread = document.createElement('mu-thread');
  stage.append(thread);
  thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'rich-message', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: ANSWER } });
  thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'bad-message', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill(paragraph(link('Synthetic rules', SCRIPT))) } });
  await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
  const parts = [...root(thread).querySelectorAll('mu-rich-text')];
  check('thread: a rich text part shows with the actor of the envelope', parts.length === 2 && parts[0].dataset.state === 'default'
    && parts[0].actor.id === AUTHOR.id && tags(parts[0], '.heading') === 'h2 h3 h4', parts.length);
  check('thread: a rich text with a script address shows a refusal', parts[1]?.dataset.state === 'refused'
    && !root(parts[1]).querySelector('button, a') && window.muUnsafe === undefined);

  // These checks moved the focus. Put the Tab start point before the keyboard target. The link is the next Tab stop.
  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  start.focus();
  const target0 = document.createElement('mu-button');
  target0.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
  let presses = 0;
  target0.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target0);
  const keyed = mount(fill(paragraph(span('Read the '), link('Synthetic rules', RULES), span('.'))), keyboard);
  let opens = 0;
  keyed.addEventListener('mu-open', (event) => { opens += 1; event.preventDefault(); });
  // This listener runs after the listener of the element, so it reads the result of the Escape key.
  let escaped = null;
  root(keyed).querySelector('[part="link"]').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') escaped = root(keyed).querySelector('[part="target"]').hidden;
  });
  window.muPresses = () => presses;
  window.muLinkState = () => {
    const tip = root(keyed).querySelector('[part="target"]');
    return { focused: root(keyed).activeElement === root(keyed).querySelector('[part="link"]'), opens, escaped,
      target: tip.hidden || getComputedStyle(tip).display === 'none' ? null : tip.textContent,
      active: document.activeElement?.shadowRoot?.activeElement?.textContent ?? '' };
  };
  window.muChecks = { mode, results };
}

if (typeof window !== 'undefined') await browserChecks();
