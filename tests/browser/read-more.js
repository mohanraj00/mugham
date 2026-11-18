// Expected results come from the text contracts and src/components/read-more.md.
export async function readMoreKeyboardChecks(session, sessionId, { evaluate, key }, page) {
  const results = [];
  for (let index = 0; index < 4; index += 1) {
    await evaluate(session, sessionId, `window.muFocusReadMore(${index})`);
    await key(session, sessionId, 'Tab', 'Tab', 9);
    const tabbed = await evaluate(session, sessionId, `window.muReadMoreState(${index})`);
    results.push({ page, step: `${index}: Tab focuses the native control`, ok: tabbed.focused, detail: JSON.stringify(tabbed) });
    for (const [name, code, number, text, expanded] of [['Enter', 'Enter', 13, '\r', true], [' ', 'Space', 32, ' ', false]]) {
      await key(session, sessionId, name, code, number, text);
      const found = await evaluate(session, sessionId, `window.muReadMoreState(${index})`);
      results.push({ page, step: `${index}: ${code} changes the state and keeps focus`,
        ok: found.focused && found.expanded === String(expanded) && found.label === (expanded ? 'Read less' : 'Read more'),
        detail: JSON.stringify(found) });
    }
  }
  for (const [width, overflow] of [[260, true], [1200, false], [260, true]]) {
    await session.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate(session, sessionId, 'window.muReadMoreWait()');
    const found = await evaluate(session, sessionId, 'window.muResizeReadMore()');
    results.push({ page, step: `window width ${width} rechecks overflow`,
      ok: found.overflow === overflow && found.viewport === width
        && Math.abs(found.stageWidth - found.availableWidth) < 0.5
        && Math.abs(found.targetWidth - found.stageWidth) < 0.5,
      detail: JSON.stringify(found) });
  }
  await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  await evaluate(session, sessionId, 'window.muReadMoreWait()');
  await evaluate(session, sessionId, 'window.muResetReadMoreFocus()');
  return results;
}

async function browserChecks() {
  const { define } = await import('../../src/thread/index.js');
  define();
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const stage = document.getElementById('stage');
  const author = { type: 'agent', id: 'agent-notes' };
  const long = 'Synthetic notes describe the east path and the small gate. '.repeat(16) + 'Last searchable sentence.';
  const fill = (component, data) => ({ component, version: '0.1.0', data,
    ...(['text', 'button'].includes(component) ? {} : { slots: { authorship: author, ...(component === 'excerpt'
      ? { citation: { source: 'Synthetic path notes', locator: 'https://example.org/notes' } } : {}) } }) });
  const values = (component, text, clamp) => ({ ...(component === 'text' ? { text }
    : component === 'excerpt' ? { passage: text, span_start: 0, span_end: 1 }
      : { blocks: [{ component: 'rich-paragraph', version: '0.1.0', data: {
        content: [{ component: 'rich-span', version: '0.1.0', data: { text } }] } }] }),
    ...(clamp === undefined ? {} : { clamp }) });
  function mount(component, text, clamp) {
    const node = document.createElement(`mu-${component}`);
    node.actor = author;
    node.style.width = '240px';
    stage.append(node);
    node.fill = fill(component, values(component, text, clamp));
    return node;
  }
  const wait = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const toggle = (node) => node.shadowRoot.querySelector('[part="read-more-toggle"]');
  const content = (node) => node.shadowRoot.querySelector('[part="read-more-content"]');
  const targets = [];
  for (const component of ['text', 'excerpt', 'rich-text']) {
    const plain = mount(component, long);
    const short = mount(component, 'Short note.', 2);
    const searchTarget = `Search target ${component}.`;
    const fullText = long + ' ' + searchTarget;
    const node = mount(component, fullText, 2);
    targets.push(node);
    await wait();
    check(`${component}: no clamp preserves the full view`, !toggle(plain) && plain.dataset.state === 'default');
    check(`${component}: short text has no visible control`, toggle(short).hidden);
    const button = toggle(node);
    const area = content(node);
    check(`${component}: long text has a native collapsed control`, button.localName === 'button' && !button.hidden
      && button.textContent === 'Read more' && button.getAttribute('aria-expanded') === 'false'
      && node.shadowRoot.getElementById(button.getAttribute('aria-controls')) === area
      && area.getBoundingClientRect().height < area.scrollHeight);
    check(`${component}: the complete text stays in the DOM`, area.textContent === fullText && !area.hidden
      && !area.querySelector('[hidden], [inert], [aria-hidden="true"]') && !area.hasAttribute('aria-hidden'));
    check(`${component}: page search can find the last text`, window.find(searchTarget, false, false, true));
    window.getSelection()?.removeAllRanges();
    button.focus();
    button.click();
    await wait();
    check(`${component}: expand keeps the same nodes and focus`, toggle(node) === button && content(node) === area
      && node.shadowRoot.activeElement === button && button.textContent === 'Read less'
      && button.getAttribute('aria-expanded') === 'true' && area.clientHeight >= area.scrollHeight - 1);
    node.setAttribute('read-more-label', 'Show full text');
    node.setAttribute('read-less-label', 'Show short text');
    check(`${component}: page label changes apply at once`, button.textContent === 'Show short text');
    button.click();
    check(`${component}: the page owns both labels`, button.textContent === 'Show full text');
    node.removeAttribute('read-more-label');
    node.removeAttribute('read-less-label');
    node.style.width = '5000px';
    await wait();
    check(`${component}: a width change removes overflow`, button.hidden);
    node.style.width = '240px';
    await wait();
    check(`${component}: a narrow view restores the control`, !button.hidden && button.getAttribute('aria-expanded') === 'false');
    const provenance = node.shadowRoot.querySelector('[part="authorship"]');
    check(`${component}: provenance stays outside the limit`, !provenance || !area.contains(provenance));
    for (const clamp of [0, -1, 21, 1.5, '2', null]) {
      node.fill = fill(component, values(component, 'Short note.', clamp));
      check(`${component}: invalid clamp is refused`, node.dataset.state === 'refused' && !toggle(node));
    }
    node.fill = fill(component, values(component, fullText, 2));
    await wait();
    node.remove();
    stage.append(node);
    await wait();
    check(`${component}: reconnect restores overflow checks`, !toggle(node).hidden);
  }

  const thread = document.createElement('mu-thread');
  thread.style.width = '240px';
  thread.clamp = 2;
  stage.append(thread);
  const startEvent = { type: 'TEXT_MESSAGE_START', messageId: 'note-1', role: 'assistant', metadata: { mugham: { actor: author } } };
  await thread.read([startEvent, { type: 'TEXT_MESSAGE_CONTENT', messageId: 'note-1', delta: long }]);
  await wait();
  const threadButton = toggle(thread);
  check('thread: plain text has the same control', threadButton && !threadButton.hidden && content(thread).textContent === long);
  await thread.read([{ ...startEvent, messageId: 'short-note' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'short-note', delta: 'Short note.' },
    { type: 'TEXT_MESSAGE_END', messageId: 'short-note' }]);
  await wait();
  check('thread: short text has no visible control', thread.shadowRoot.querySelectorAll('[part="read-more-toggle"]')[1].hidden);
  threadButton.focus();
  threadButton.click();
  await thread.read([{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'note-1', delta: ' Extra text.' }]);
  await wait();
  check('thread: a delta keeps the button, open state and focus', toggle(thread) === threadButton
    && thread.shadowRoot.activeElement === threadButton && threadButton.getAttribute('aria-expanded') === 'true'
    && content(thread).textContent === long + ' Extra text.');
  threadButton.click();
  for (const clamp of [0, 21, 1.5, '2', undefined]) {
    let refused = false;
    try { thread.clamp = clamp; } catch (error) { refused = error instanceof TypeError; }
    check('thread: invalid page clamp throws', refused && thread.clamp === 2);
  }
  thread.setAttribute('read-more-label', 'Show full text');
  check('thread: page labels apply to current text', threadButton.textContent === 'Show full text');
  thread.removeAttribute('read-more-label');
  thread.clamp = null;
  check('thread: null restores the full text', !toggle(thread) && thread.shadowRoot.textContent.includes(long));
  thread.clamp = 2;
  await wait();
  targets.push(thread);

  const rich = mount('rich-text', long, 2);
  rich.fill = fill('rich-text', { clamp: 2, blocks: [
    ...values('rich-text', long).blocks,
    { component: 'rich-paragraph', version: '0.1.0', data: { content: [
      { component: 'rich-link', version: '0.1.0', data: { text: 'Synthetic detail', url: 'https://example.org/detail' } }] } }] });
  await wait();
  rich.shadowRoot.querySelector('[part="link"]').focus();
  check('rich text: focus on a clipped link opens the full text', toggle(rich).getAttribute('aria-expanded') === 'true');

  for (const node of targets) {
    const button = toggle(node);
    const bounds = button.getBoundingClientRect();
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize);
    check(`${node.localName}: the control fits its label and has a compact target`,
      bounds.width >= unit * 1.5 && bounds.width < content(node).getBoundingClientRect().width / 2
      && bounds.height >= 44 && bounds.height < unit * 3.5,
      JSON.stringify({ width: bounds.width, height: bounds.height }));
    if (mode !== 'forced-colors') {
      const style = getComputedStyle(button);
      check(`${node.localName}: the compact control has an underline and no border`,
        style.textDecorationLine.includes('underline') && parseFloat(style.borderTopWidth) === 0);
    }
    if (mode === 'reduced-motion') check('reduced motion: no transition or animation', [button, content(node)].every((item) => {
      const style = getComputedStyle(item);
      return style.animationName === 'none' && style.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }));
    if (mode === 'forced-colors') {
      const style = getComputedStyle(button);
      check('forced colors: the control has a visible border', style.borderTopStyle === 'solid'
        && parseFloat(style.borderTopWidth) >= 1 && style.color === style.borderTopColor);
    }
  }
  // At 15px with a 23.25px line height, this passage needs more than two lines in
  // at most 244px, and at most two lines in about 1184px. The limit is 46.5px.
  const responsive = mount('text', 'Synthetic notes describe the east path, the small gate, and the garden beyond it. '
    + 'Follow the marked route past the trees and return through the west gate before the end of the day.', 2);
  responsive.style.width = '100%';
  window.muResizeReadMore = () => ({ overflow: !toggle(responsive).hidden, viewport: window.innerWidth,
    availableWidth: document.documentElement.clientWidth - 16, stageWidth: stage.getBoundingClientRect().width,
    targetWidth: responsive.getBoundingClientRect().width, fullHeight: content(responsive).scrollHeight,
    limitHeight: parseFloat(getComputedStyle(content(responsive).firstElementChild).lineHeight) * 2 });
  window.muReadMoreWait = wait;
  const starts = targets.map((node) => {
    const marker = document.createElement('span');
    marker.tabIndex = -1;
    toggle(node).before(marker);
    return marker;
  });
  window.muFocusReadMore = (index) => { starts[index].focus(); return true; };
  window.muReadMoreState = (index) => ({ expanded: toggle(targets[index]).getAttribute('aria-expanded'),
    label: toggle(targets[index]).textContent, focused: targets[index].shadowRoot.activeElement === toggle(targets[index]) });
  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  const target = document.createElement('mu-button');
  target.fill = fill('button', { label: 'Keyboard target' });
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target);
  window.muPresses = () => presses;
  window.muResetReadMoreFocus = () => { start.focus(); return true; };
  start.focus();
  window.muChecks = { mode, results };
}
if (typeof window !== 'undefined') await browserChecks();
