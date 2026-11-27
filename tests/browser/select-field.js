export const SELECT_PAGE = 'examples/forms/branches.html';

export async function selectExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const press = (name, code, number, text) => key(session, sessionId, name, code, number, text);
  const tab = () => press('Tab', 'Tab', 9);
  const space = () => press(' ', 'Space', 32, ' ');
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const read = () => page(`(() => {
    const form = document.querySelector('mu-editable-form');
    const field = form.shadowRoot.querySelector('mu-select-field');
    const root = field.shadowRoot;
    const control = root.querySelector('[part="control"]');
    const search = root.querySelector('[part="search"]');
    const list = root.querySelector('[part="listbox"]');
    const options = [...list.children];
    const focused = root.activeElement;
    const active = root.getElementById(focused?.getAttribute('aria-activedescendant'));
    const target = (node) => {
      const { width, height } = node.getBoundingClientRect();
      return width >= muControlSize(node) && height >= muControlSize(node);
    };
    const style = getComputedStyle(control);
    const focus = focused && getComputedStyle(focused);
    const forced = matchMedia('(forced-colors: active)').matches;
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
    const ring = focus?.outlineStyle === 'solid' && focus.outlineWidth === '2px' && focus.outlineColor === getComputedStyle(probe).color;
    probe.style.color = forced ? 'ButtonFace' : 'var(--mu-color-surface)';
    const surface = style.backgroundColor === getComputedStyle(probe).color;
    probe.remove();
    return {
      width: innerWidth, scroll: document.documentElement.scrollWidth, focused: focused?.getAttribute('part'), ring, surface, forced,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      noMotion: [style, ...options.map((option) => getComputedStyle(option))]
        .every((css) => css.transitionDuration.split(',').every((time) => parseFloat(time) === 0)),
      open: control.getAttribute('aria-expanded') === 'true', controlTarget: target(control), searchTarget: target(search),
      optionTargets: options.every(target), optionCount: options.length, active: active?.textContent,
      selected: options.filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.textContent),
      value: field.value, shown: control.querySelector('[part="value"]').textContent, status: root.querySelector('[part="status"]').textContent,
      state: form.dataset.state, submitFocus: form.shadowRoot.activeElement?.type === 'submit',
      args: JSON.parse(document.querySelector('#main pre').textContent || '{}')
    };
  })()`);
  const filter = (text) => session.send('Input.insertText', { text }, sessionId);
  const check = (mode, step, ok, detail) => steps.push({ page: SELECT_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail) });
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${SELECT_PAGE}`, problems);
      await page(`new Promise((done, fail) => {
        const end = performance.now() + 5000;
        function ready() {
          const form = document.querySelector('mu-editable-form')?.shadowRoot;
          if (innerWidth === 375 && form?.querySelector('mu-select-field')) {
            const anchor = form.querySelector('form');
            anchor.tabIndex = -1;
            anchor.focus();
            done(true);
          } else if (performance.now() < end) requestAnimationFrame(ready);
          else fail(new Error('The branch form did not load at 375 CSS pixels.'));
        }
        ready();
      })`);
      await tab();
      const closed = await read();
      check(mode, 'Tab reaches the closed control with a focus ring', closed.focused === 'control' && closed.ring && !closed.open
        && closed.value === 'Branch 01' && closed.shown === closed.value, closed);
      await space();
      const opened = await read();
      check(mode, 'Space opens the choices and moves focus to search', opened.open && opened.focused === 'search' && opened.ring
        && opened.active === 'Branch 01' && opened.selected.join() === 'Branch 01', opened);
      check(mode, 'the control, search and all 40 options meet the target size', opened.controlTarget && opened.searchTarget
        && opened.optionTargets && opened.optionCount === 40, opened);
      check(mode, 'the open and closed page fit at 375 CSS pixels', [closed, opened].every(({ width, scroll }) => width === 375 && scroll === 375),
        { closed: closed.scroll, open: opened.scroll });
      check(mode, 'the control uses the current theme and respects reduced motion', opened.surface
        && opened.forced === (mode === 'forced-colors') && opened.reduced === (mode === 'reduced-motion')
        && (mode === 'forced-colors' || opened.dark === (mode === 'dark'))
        && (mode !== 'reduced-motion' || opened.noMotion), opened);
      if (mode !== 'light') continue;
      steps.push(...await pageRules(session, sessionId, SELECT_PAGE + ' with the list open'));
      for (const [name, code, active] of [['ArrowDown', 40, 'Branch 02'], ['ArrowUp', 38, 'Branch 01'],
        ['End', 35, 'Branch 40'], ['Home', 36, 'Branch 01']]) {
        await press(name, name, code);
        const state = await read();
        check(mode, name + ' moves the active option and keeps the value', state.active === active && state.value === 'Branch 01', state);
      }
      await filter('aNcH 2');
      const filtered = await read();
      check(mode, 'search matches part of the text and ignores case', filtered.optionCount === 10 && filtered.active === 'Branch 20', filtered);
      await filter('x');
      await enter();
      const empty = await read();
      check(mode, 'Enter with no match keeps the value and sends no request', empty.open && empty.optionCount === 0
        && empty.active === undefined && empty.status === 'No match' && empty.value === 'Branch 01' && !empty.args.branch, empty);
      await press('Escape', 'Escape', 27);
      const escaped = await read();
      check(mode, 'Escape closes the list and returns focus without a change',
        !escaped.open && escaped.focused === 'control' && escaped.value === 'Branch 01', escaped);
      await space();
      await tab();
      const tabbed = await read();
      check(mode, 'Tab closes the list and moves to Save without a change', !tabbed.open && tabbed.submitFocus && tabbed.value === 'Branch 01', tabbed);
      await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
      await space();
      const reopened = await read();
      await page('document.querySelector("h1").click()');
      const outside = await read();
      check(mode, 'an outside click closes the list without a change', reopened.open && !outside.open && outside.value === 'Branch 01', outside);
      await page(`document.querySelector('mu-editable-form').shadowRoot.querySelector('mu-select-field')
        .shadowRoot.querySelector('[part="control"]').focus()`);
      await space();
      await filter('anch 2');
      await press('ArrowDown', 'ArrowDown', 40);
      await enter();
      const selected = await read();
      check(mode, 'Enter selects the active option and returns focus without a submit', !selected.open && selected.focused === 'control'
        && selected.value === 'Branch 21' && selected.shown === selected.value && !selected.args.branch, selected);
      await tab();
      await enter();
      const sent = await read();
      check(mode, 'Save sends the selected text and the form shows the receipt', sent.args.branch === 'Branch 21' && sent.state === 'done', sent);
    }
  } finally {
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  }
  return steps;
}
