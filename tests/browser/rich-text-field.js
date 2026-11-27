export const RICH_TEXT_FIELD_PAGE = 'examples/apps/library-note.html';

const PASTE_PROBE_PATH = '/probe-paste/';
const INLINE_HANDLER_REPORT = "Executing inline event handler violates the following Content Security Policy directive 'script-src 'self''."
  + " Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution."
  + " Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present."
  + ' The action has been blocked.';
const INLINE_STYLE_REPORT = new RegExp(
  String.raw`^Applying inline style violates the following Content Security Policy directive 'style-src 'self''\.`
  + String.raw` Either the 'unsafe-inline' keyword, a hash \('sha256-[A-Za-z0-9+/]{43}='\), or a nonce \('nonce-\.\.\.'\) is required to enable inline execution\.`
  + String.raw`(?: Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present\.)?`
  + String.raw` The action has been blocked\.$`,
);

export function isPlannedPolicyReport(entry) {
  const url = entry?.stackTrace?.callFrames?.[0]?.url;
  return entry?.source === 'security' && entry.level === 'error'
    && typeof url === 'string' && url.endsWith('/src/primitives/rich-text-field-model.js')
    && typeof entry.text === 'string' && (entry.text === INLINE_HANDLER_REPORT || INLINE_STYLE_REPORT.test(entry.text));
}

function plannedErrors(entries, problems, start) {
  const planned = [];
  const other = [];
  for (const entry of entries) {
    if (isPlannedPolicyReport(entry)) {
      planned.push(entry.text);
    } else {
      other.push({
        text: entry.exception?.description || entry.text || 'Text is missing.',
        url: entry.stackTrace?.callFrames?.[0]?.url || entry.url || 'URL is missing.',
      });
    }
  }
  const count = planned.length;
  const inlineHandler = planned.includes(INLINE_HANDLER_REPORT);
  const added = problems.splice(start);
  for (const text of added) {
    const match = planned.indexOf(text);
    if (match >= 0) planned.splice(match, 1);
    else problems.push(text);
  }
  return { count, inlineHandler, other };
}

function toolbarState() {
  const root = document.querySelector('mu-editable-form').shadowRoot.querySelector('mu-rich-text-field').shadowRoot;
  const toolbar = root.querySelector('[part="toolbar"]');
  const editor = root.querySelector('[part="input"]');
  const buttons = [...toolbar.querySelectorAll('button')];
  const active = root.activeElement;
  const style = active ? getComputedStyle(active) : null;
  const forced = matchMedia('(forced-colors: active)').matches;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const size = (node) => {
    const rect = node.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  };
  return {
    width: innerWidth, scroll: document.documentElement.scrollWidth, forced, dark, reduced,
    toolbarName: toolbar.getAttribute('aria-label'), toolbarRole: toolbar.getAttribute('role'),
    role: editor.getAttribute('role'), multiline: editor.getAttribute('aria-multiline'), required: editor.getAttribute('aria-required'),
    tabStops: buttons.filter(({ tabIndex }) => tabIndex === 0).map(({ textContent }) => textContent),
    focus: active === editor ? 'editor' : active?.textContent,
    focusRing: style?.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2
      && style.outlineColor === color(forced ? 'Highlight' : 'var(--mu-color-focus)'),
    targets: [editor, ...buttons].every(size),
    pressed: buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').map(({ textContent }) => textContent),
    colors: getComputedStyle(editor).backgroundColor === color(forced ? 'Canvas' : 'var(--mu-color-surface)')
      && getComputedStyle(editor).color === color(forced ? 'CanvasText' : 'var(--mu-color-text)'),
    noMotion: buttons.every((button) => {
      const style = getComputedStyle(button);
      return style.animationName === 'none' && style.transitionDuration.split(',').every((duration) => parseFloat(duration) === 0);
    }),
  };
}

async function exerciseEditor() {
  const { richTextValueErrors } = await import('/src/render/rich-text.js');
  const { MuRichText } = await import('/src/components/rich-text.js');
  const form = document.querySelector('mu-editable-form');
  const field = form.shadowRoot.querySelector('mu-rich-text-field');
  const root = field.shadowRoot;
  const editor = () => root.querySelector('[part="input"]');
  const button = (name) => [...root.querySelectorAll('button')].find((node) => node.textContent === name);
  const pressed = (name) => button(name).getAttribute('aria-pressed') === 'true';
  const select = (node, from = 0, to = node.length) => {
    editor().focus();
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const selection = root.getSelection?.() ?? document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const blocks = () => field.value.data.blocks;
  const valid = () => richTextValueErrors(field.value).length === 0;
  const reset = () => { field.fill = form.fill.data.fields[0]; };
  const lastText = (row) => editor().querySelectorAll('p,h1,h2,h3,pre')[row].firstChild;
  const checkMark = (mark) => blocks()[0].data.content[0].data.mark === mark && valid();
  const shortcut = (key, mod) => !editor().dispatchEvent(new KeyboardEvent('keydown', {
    key, [mod]: true, bubbles: true, cancelable: true,
  }));
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  const initial = form.fill.data.fields[0];
  const empty = { ...initial.data.value, data: { blocks: [] } };
  field.fill = { ...initial, data: { ...initial.data, value: empty } };
  button('Heading 3').click();
  const headingOrder = JSON.stringify(field.value) === JSON.stringify(empty) && !field.changed && !pressed('Heading 3')
    && root.querySelector('[part="status"]').textContent === 'A heading cannot skip a level. Use Heading 1 first.';

  for (const [key, name, mark] of [['b', 'Strong', 'strong'], ['i', 'Emphasis', 'emphasis'], ['e', 'Inline code', 'code']]) {
    reset();
    select(lastText(0));
    button(name).click();
    check(checkMark(mark) && pressed(name), name + ' button did not apply the mark.');
    button(name).click();
    check(checkMark(undefined) && !pressed(name), name + ' button did not remove the mark.');
    for (const mod of ['ctrlKey', 'metaKey']) {
      reset();
      select(lastText(0));
      check(shortcut(key, mod) && checkMark(mark) && pressed(name), name + ' shortcut did not apply the mark.');
    }
    const words = root.getElementById(button(name).getAttribute('aria-describedby'))?.textContent;
    check(words === 'Control or Command + ' + key.toUpperCase(), name + ' shortcut description is missing.');
  }

  for (const [name, component, ordered] of [['Bulleted list', 'rich-list', undefined],
    ['Numbered list', 'rich-list', true], ['Quote', 'rich-quote'], ['Code block', 'rich-code']]) {
    reset();
    select(lastText(0));
    button(name).click();
    check(blocks()[0].component === component && blocks()[0].data.ordered === ordered && pressed(name) && valid(),
      name + ' did not create its block.');
    button('Paragraph').click();
    check(blocks()[0].component === 'rich-paragraph' && pressed('Paragraph') && valid(), 'Paragraph did not restore the block.');
  }
  reset();
  editor().replaceChildren(...['First note', 'Second note', 'Third note'].map((words) => {
    const p = document.createElement('p');
    p.textContent = words;
    return p;
  }));
  editor().dispatchEvent(new Event('input'));
  for (const index of [0, 1, 2]) {
    select(lastText(index));
    const name = 'Heading ' + (index + 1);
    button(name).click();
    check(blocks()[index].component === 'rich-heading' && blocks()[index].data.level === index + 1 && pressed(name) && valid(),
      name + ' did not create its heading.');
  }

  for (const control of ['button', 'ctrlKey', 'metaKey']) {
    reset();
    select(lastText(0));
    if (control === 'button') button('Link').click();
    else check(shortcut('k', control), 'The link shortcut did not cancel the browser action.');
    const input = root.querySelector('[part="link-editor"] input');
    const panel = input.closest('[part="link-editor"]');
    check(!panel.hidden && root.activeElement === input, 'The link address did not take focus.');
    check([input, ...panel.querySelectorAll('button')].every((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width >= 44 && rect.height >= 44;
    }), 'A link control is smaller than 44 by 44 CSS pixels.');
    input.value = 'http://example.org/reading';
    button('Apply link').click();
    check(!panel.hidden && input.getAttribute('aria-invalid') === 'true' && !editor().querySelector('a'),
      'The address control accepted a scheme that the page refused.');
    input.value = 'https://example.org/reading';
    button('Apply link').click();
    const link = editor().querySelector('a');
    check(valid() && blocks()[0].data.content[0].data.url === input.value && link && !link.hasAttribute('href')
      && pressed('Link') && !link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    'The link address, pressed state or click behavior is incorrect.');
    const policy = MuRichText.linkSchemes;
    try {
      MuRichText.linkSchemes = [];
      check(valid() && !editor().querySelector('a') && blocks()[0].data.content[0].component === 'rich-span',
        'A link did not change to text after the page removed its scheme.');
    } finally {
      MuRichText.linkSchemes = policy;
    }
  }

  reset();
  select(lastText(0));
  const native = new InputEvent('beforeinput', { inputType: 'formatBold', bubbles: true, cancelable: true });
  check(!editor().dispatchEvent(native) && checkMark('strong'), 'The editor did not handle the native bold command.');

  reset();
  const div = document.createElement('div');
  const font = document.createElement('font');
  font.setAttribute('color', 'red');
  font.textContent = 'Edited note';
  div.append(font);
  editor().replaceChildren(div);
  select(font.firstChild, 5, 5);
  editor().dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  const cursor = (root.getSelection?.() ?? document.getSelection()).getRangeAt(0);
  check(valid() && editor().firstElementChild.localName === 'p' && !editor().querySelector('div,font,[color]')
    && cursor.startContainer === editor().firstElementChild.firstChild && cursor.startOffset === 5,
  'The editor did not remove the browser nodes and keep the caret.');
  form.shadowRoot.querySelector('form').requestSubmit();
  const request = document.querySelector('#saved-note').textContent;
  check(form.dataset.state === 'done' && JSON.stringify(JSON.parse(request)) === JSON.stringify(field.value),
    'The form did not send the edited rich text value and accept the receipt.');
  return { headingOrder, failures };
}

async function exercisePasteAndDrop(probePath) {
  const { richTextValueErrors } = await import('/src/render/rich-text.js');
  const form = document.querySelector('mu-editable-form');
  const field = form.shadowRoot.querySelector('mu-rich-text-field');
  const root = field.shadowRoot;
  const editor = () => root.querySelector('[part="input"]');
  const selectNote = () => {
    field.fill = form.fill.data.fields[0];
    editor().focus();
    const range = document.createRange();
    range.selectNodeContents(editor().querySelector('p').firstChild);
    const selection = root.getSelection?.() ?? document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const valid = () => richTextValueErrors(field.value).length === 0;
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const paste = (html, plain, type = 'paste') => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', plain);
    return !editor().dispatchEvent(type === 'paste'
      ? new ClipboardEvent('paste', { clipboardData: data, cancelable: true, bubbles: true })
      : new DragEvent('drop', { dataTransfer: data, cancelable: true, bubbles: true }));
  };
  selectNote();
  const html = '<script>window.noteScriptExecuted = true</script><style>p{color:red}</style>'
    + '<iframe></iframe><img onerror="window.noteScriptExecuted = true"><p onclick="window.noteScriptExecuted = true" style="color:red">'
    + '<strong>Safe text</strong> <a href="javascript:ignored">Script link</a> <a href="data:text/plain,ignored">Data link</a></p>';
  check(paste(html, 'Fallback'), 'The paste default action was not canceled.');
  const pasted = JSON.stringify(field.value);
  check(valid() && editor().textContent === 'Safe text Script link Data link'
    && !editor().querySelector('script,style,iframe,img,[onclick],[onerror],[style],[href],a')
    && !pasted.includes('javascript:') && !pasted.includes('data:text') && !pasted.includes('<script>'),
  'The paste kept an unsafe element, attribute, address or text.');
  const prior = JSON.stringify(field.value);
  check(paste('<div>'.repeat(40) + 'Deep' + '</div>'.repeat(40), '')
    && root.querySelector('[part="status"]').textContent && JSON.stringify(field.value) === prior,
  'The deep paste did not keep the previous value.');
  check(paste('x'.repeat(262145), '') && root.querySelector('[part="status"]').textContent && JSON.stringify(field.value) === prior,
    'The large paste did not keep the previous value.');
  check(paste('', 'x'.repeat(2001)) && root.querySelector('[part="status"]').textContent && JSON.stringify(field.value) === prior,
    'The paste that exceeded the span limit did not keep the previous value.');
  selectNote();
  const url = location.origin + probePath;
  const urlTags = '<p>Safe text</p>'
    + `<img src="${url}img.png"><link rel="stylesheet" href="${url}style.css">`
    + `<video poster="${url}poster.png"></video><iframe src="${url}frame.html"></iframe>`
    + `<object data="${url}object.html"></object><svg><image href="${url}svg.png"/></svg>`
    + `<input type="image" src="${url}input.png"><script src="${url}script.js"></script>`;
  check(paste(urlTags, 'Fallback') && valid() && editor().textContent === 'Safe text'
    && !editor().querySelector('img,link,video,iframe,object,svg,input,script,[src],[href],[poster],[data]')
    && !JSON.stringify(field.value).includes(probePath), 'The paste with URL tags did not keep only the safe text.');
  selectNote();
  check(paste('<em>Drop text</em>', '', 'drop') && valid()
    && field.value.data.blocks[0]?.data.content[0]?.data.mark === 'emphasis' && editor().textContent === 'Drop text',
    'The drop did not cancel the default action and use the same data walk.');
  // Let Chrome process pending events from the paste and drop.
  await new Promise((done) => setTimeout(done, 0));
  return failures;
}

async function withLimit(run, step, limit = 15000) {
  let timer;
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(step + ' timed out.')), limit); });
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function richTextFieldChecks(session, sessionId, base, modes, { open, evaluate, key, pageRules }, problems) {
  const steps = [];
  const check = (view, step, ok, reason, detail) => steps.push({
    page: RICH_TEXT_FIELD_PAGE, step: view + ': ' + step, ok: Boolean(ok),
    detail: JSON.stringify(ok ? detail ?? {} : { reason, detail }),
  });
  const send = (method, params = {}) => withLimit(() => session.send(method, params, sessionId), method);
  const page = (fn, ...args) => withLimit(
    () => evaluate(session, sessionId, '(' + fn + ')(' + args.map((arg) => JSON.stringify(arg)).join(',') + ')'), 'Read the editor');
  const press = (name, code) => withLimit(() => key(session, sessionId, name, name, code), 'Press ' + name);

  try {
    for (const width of [375, 1280]) {
      for (const [mode, features] of Object.entries(modes)) {
        const view = width + ' px, ' + mode;
        try {
          await send('Emulation.setDeviceMetricsOverride', { width, height: 880, deviceScaleFactor: 1, mobile: false });
          await send('Emulation.setEmulatedMedia', { features });
          await withLimit(() => open(session, sessionId, base + '/' + RICH_TEXT_FIELD_PAGE, problems), 'Open the note');
          await page(async function waitForEditor() {
            const end = performance.now() + 3000;
            while (!document.querySelector('mu-editable-form')?.shadowRoot?.querySelector('mu-rich-text-field')?.shadowRoot?.querySelector('[part="toolbar"]')) {
              if (performance.now() > end) throw new Error('The editor did not load.');
              await new Promise((done) => setTimeout(done, 25));
            }
            document.querySelector('mu-editable-form').shadowRoot.querySelector('mu-rich-text-field')
              .shadowRoot.querySelector('[part="toolbar"] button').focus();
            return true;
          });

          await press('ArrowRight', 39);
          const next = await page(toolbarState);
          await press('End', 35);
          const last = await page(toolbarState);
          await press('ArrowRight', 39);
          const wrap = await page(toolbarState);
          await press('ArrowLeft', 37);
          const back = await page(toolbarState);
          await press('Home', 36);
          const first = await page(toolbarState);
          check(view, 'the toolbar has one tab stop and the keys move the focus',
            [next, last, wrap, back, first].every(({ focus, tabStops }) => tabStops.length === 1 && tabStops[0] === focus)
            && [next.focus, last.focus, wrap.focus, back.focus, first.focus].join(',') === 'Heading 1,Link,Paragraph,Link,Paragraph'
            && first.toolbarRole === 'toolbar' && first.toolbarName === 'Text formats',
          'A key moved to the wrong control or the toolbar role, name or tab stop is incorrect.', first);
          check(view, 'the keyboard shows the focus ring', next.focusRing && last.focusRing && first.focusRing,
            'A format button does not show the focus ring.', first);

          await press('Tab', 9);
          const editor = await page(toolbarState);
          check(view, 'Tab leaves the toolbar for the multi-line editor', editor.focus === 'editor' && editor.focusRing
            && editor.role === 'textbox' && editor.multiline === 'true' && editor.required === 'true',
          'The editor did not receive visible focus or has incorrect semantics.', editor);
          const media = first.forced === (mode === 'forced-colors') && (first.forced || first.dark === (mode === 'dark'))
            && first.reduced === (mode === 'reduced-motion');
          check(view, 'targets fit and the colors and motion respect the current mode',
            first.targets && first.colors && media && (!first.reduced || first.noMotion) && first.width === width && first.scroll <= width,
            'A target, color, media setting, motion value or page width is incorrect.', first);
          steps.push(...await withLimit(() => pageRules(session, sessionId, RICH_TEXT_FIELD_PAGE + ' at ' + view), 'Check the page rules'));

          const start = problems.length;
          const entries = [];
          const requests = [];
          const policyFailures = [];
          const networkFailures = [];
          const recordPasteEvent = (message) => {
            if (message.sessionId !== sessionId) return;
            if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
              entries.push(message.params.entry);
            }
            if (message.method === 'Runtime.exceptionThrown') entries.push(message.params.exceptionDetails);
            if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
          };
          session.listeners.push(recordPasteEvent);
          try {
            await send('Network.enable');
            const errors = await page(exercisePasteAndDrop, PASTE_PROBE_PATH);
            check(view, 'paste and drop keep only the permitted data', errors.length === 0,
              'Paste or drop gave a different result.', errors);
            if (await page(() => 'noteScriptExecuted' in window)) {
              policyFailures.push('An inline script or event handler ran.');
            }
          } catch (error) {
            policyFailures.push(String(error));
            networkFailures.push(String(error));
          } finally {
            await send('Network.disable').catch((error) => networkFailures.push(String(error)));
            session.listeners = session.listeners.filter((listener) => listener !== recordPasteEvent);
          }
          const { count, inlineHandler, other } = plannedErrors(entries, problems, start);
          if (!inlineHandler) policyFailures.push('The browser did not give the inline handler policy report.');
          if (other.length > 0) {
            const reason = 'Paste or drop gave an unexpected page error.';
            policyFailures.push(reason);
            networkFailures.push(reason);
          }
          check(view, 'a paste of inline handlers makes only the planned policy reports and no handler runs',
            policyFailures.length === 0, policyFailures.join(' '), { count, other });
          const urls = requests.filter((url) => url.includes(PASTE_PROBE_PATH));
          if (urls.length > 0) networkFailures.push('A pasted URL started a request.');
          check(view, 'a paste of URL tags starts no request', networkFailures.length === 0,
            networkFailures.join(' '), { urls, other });

          const { headingOrder, failures } = await page(exerciseEditor);
          check(view, 'Heading 3 on an empty note keeps the value and asks for Heading 1', headingOrder,
            'The note changed or the heading message was incorrect.');
          check(view, 'formats, shortcuts, input repair and form submit work',
            failures.length === 0, 'An editor action gave a different result.', failures);
        } catch (error) {
          check(view, 'complete the editor checks', false, String(error));
        }
      }
    }
  } finally {
    try {
      await send('Emulation.clearDeviceMetricsOverride');
      await send('Emulation.setEmulatedMedia', { features: modes.light });
    } catch (error) {
      check('Cleanup', 'restore the browser settings', false, String(error));
    }
  }
  return steps;
}
