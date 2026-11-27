export const MULTI_CHOICE_PAGE = 'examples/forms/garden.html';

export async function multiChoiceExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules }, problems) {
  const steps = [];
  const url = base + '/' + MULTI_CHOICE_PAGE;
  const page = (expression) => evaluate(session, sessionId, expression);
  const press = (name, code, number, text) => key(session, sessionId, name, code, number, text);
  const tab = () => press('Tab', 'Tab', 9);
  const space = () => press(' ', 'Space', 32, ' ');
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const read = () => page(`(() => {
    const form = document.querySelector('mu-editable-form');
    const [short, long] = [...form.shadowRoot.querySelectorAll('mu-multi-choice-field')];
    const checkboxes = [...short.shadowRoot.querySelectorAll('[part="checkbox"]')];
    const root = long.shadowRoot;
    const search = root.querySelector('[part="search"]');
    const list = root.querySelector('[part="listbox"]');
    const options = [...list.children];
    const buttons = [...root.querySelectorAll('[part="remove"]')];
    const focused = short.shadowRoot.activeElement || root.activeElement;
    const active = root.getElementById(search.getAttribute('aria-activedescendant'));
    const target = (node) => {
      const {width, height} = node.getBoundingClientRect();
      return width >= muControlSize(node) && height >= muControlSize(node);
    };
    const forced = matchMedia('(forced-colors: active)').matches;
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.forcedColorAdjust = 'none';
    probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
    const outline = (node) => {
      const style = node && getComputedStyle(node);
      return style?.outlineStyle === 'solid' && style.outlineWidth === '2px' && style.outlineColor === getComputedStyle(probe).color;
    };
    const ring = outline(focused);
    const optionRing = outline(active);
    probe.style.color = forced ? 'Field' : 'var(--mu-color-surface)';
    const surface = getComputedStyle(search).backgroundColor === getComputedStyle(probe).color;
    probe.remove();
    return {
      width: innerWidth, scroll: document.documentElement.scrollWidth, ring, optionRing, forced, surface,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      noMotion: [search, ...checkboxes, ...buttons, ...options].every((node) =>
        getComputedStyle(node).transitionDuration.split(',').every((time) => parseFloat(time) === 0)),
      focusPart: focused?.getAttribute('part'), focusName: focused?.getAttribute('aria-label'),
      checkboxTargets: checkboxes.length === 5 && checkboxes.every(target),
      removeTargets: buttons.length === 2 && buttons.every(target), searchTarget: target(search),
      optionTargets: options.length === 30 && options.every(target),
      open: search.getAttribute('aria-expanded') === 'true', controls: search.getAttribute('aria-controls') === list.id,
      listbox: list.getAttribute('role') === 'listbox' && list.getAttribute('aria-multiselectable') === 'true',
      optionCount: options.length,
      active: active?.textContent, status: root.querySelector('[part="status"]').textContent,
      selected: options.filter((node) => node.getAttribute('aria-selected') === 'true').map((node) => node.textContent),
      tags: buttons.map((node) => node.getAttribute('aria-label')),
      sun: short.value, plants: long.value,
      submitFocus: form.shadowRoot.activeElement?.type === 'submit', state: form.dataset.state,
      args: JSON.parse(document.querySelector('#main pre').textContent || '{}')
    };
  })()`);
  const check = (mode, step, ok, detail) => steps.push({ page: MULTI_CHOICE_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail) });
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, url, problems);
      await page(`new Promise((done, fail) => {
        const end = performance.now() + 5000;
        function ready() {
          const root = document.querySelector('mu-editable-form')?.shadowRoot;
          if (innerWidth === 375 && root?.querySelectorAll('mu-multi-choice-field').length === 2) {
            const form = root.querySelector('form');
            form.tabIndex = -1;
            form.focus();
            done(true);
          } else if (performance.now() < end) requestAnimationFrame(ready);
          else fail(new Error('The garden form did not load at 375 CSS pixels.'));
        }
        ready();
      })`);
      await tab();
      const closed = await read();
      check(mode, 'Tab reaches the first checkbox with a focus ring',
        closed.focusPart === 'checkbox' && closed.ring && !closed.open, closed);
      const fits = ({ width, scroll }) => width === 375 && scroll === 375;
      check(mode, 'each checkbox and tag remove button has the target size',
        closed.checkboxTargets && closed.removeTargets && closed.searchTarget, closed);
      await space();
      const checked = await read();
      check(mode, 'Space selects the focused checkbox', checked.sun.join() === 'Full sun,Part shade', checked);
      for (let i = 0; i < 5; i += 1) await tab();
      const firstTag = await read();
      check(mode, 'Tab reaches the first remove button with a focus ring',
        firstTag.focusName === 'Remove Mist fern' && firstTag.ring, firstTag);
      await tab();
      await tab();
      const search = await read();
      check(mode, 'Tab reaches the search box with a focus ring', search.focusPart === 'search' && search.ring, search);
      await press('ArrowDown', 'ArrowDown', 40);
      const opened = await read();
      check(mode, 'the search opens the multiselect listbox and all options have the target size',
        opened.open && opened.controls && opened.listbox && opened.optionTargets && opened.optionRing
        && opened.active === 'Mist fern' && opened.selected.join() === 'Mist fern,Dune bell', opened);
      check(mode, 'the open and closed form fit at 375 CSS pixels', fits(closed) && fits(opened), { closed: closed.scroll, open: opened.scroll });
      check(mode, 'the search uses the current theme and respects reduced motion',
        opened.surface && opened.forced === (mode === 'forced-colors') && opened.reduced === (mode === 'reduced-motion')
        && (mode === 'forced-colors' || opened.dark === (mode === 'dark'))
        && (mode !== 'reduced-motion' || opened.noMotion), opened);
      if (mode !== 'light') continue;
      steps.push(...await pageRules(session, sessionId, MULTI_CHOICE_PAGE + ' with the list open'));
      await session.send('Input.insertText', { text: 'bELL' }, sessionId);
      await press('End', 'End', 35);
      await enter();
      const removed = await read();
      check(mode, 'Enter clears the active choice and keeps the filtered list open',
        removed.open && removed.optionCount === 2 && removed.active === 'Dune bell'
        && removed.plants.join() === 'Mist fern' && removed.selected.length === 0, removed);
      await press('Home', 'Home', 36);
      await enter();
      const added = await read();
      check(mode, 'Enter selects another choice and sends no request',
        added.open && added.active === 'Rain bell' && added.selected.join() === 'Rain bell'
        && added.plants.join() === 'Mist fern,Rain bell' && !added.args.plants, added);
      await session.send('Input.insertText', { text: '?' }, sessionId);
      const noMatch = await read();
      check(mode, 'a search with no results gives a status and keeps the selections',
        noMatch.open && noMatch.optionCount === 0 && !noMatch.active && noMatch.status === 'No match'
        && noMatch.plants.join() === 'Mist fern,Rain bell', noMatch);
      await press('Escape', 'Escape', 27);
      const escaped = await read();
      check(mode, 'Escape closes the list and keeps focus on the search box', !escaped.open && escaped.focusPart === 'search', escaped);
      for (let i = 0; i < 2; i += 1) {
        await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
      }
      await enter();
      const next = await read();
      check(mode, 'Enter removes the tag and moves focus to the next remove button',
        next.focusName === 'Remove Rain bell' && next.ring && next.plants.join() === 'Rain bell', next);
      await space();
      const empty = await read();
      check(mode, 'Space removes the last tag and moves focus to the search box',
        empty.focusPart === 'search' && empty.ring && empty.tags.length === 0, empty);
      await session.send('Input.insertText', { text: 'dune' }, sessionId);
      await enter();
      await tab();
      const beforeSubmit = await read();
      check(mode, 'Tab closes the list, moves focus to Save and sends no request',
        !beforeSubmit.open && beforeSubmit.submitFocus && !beforeSubmit.args.plants, beforeSubmit);
      await enter();
      const sent = await read();
      check(mode, 'Save sends both lists and shows the receipt',
        sent.args.sun?.join() === 'Full sun,Part shade' && sent.args.plants?.join() === 'Dune bell'
        && sent.state === 'done' && fits(sent), sent);
    }
  } finally {
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  }
  return steps;
}
