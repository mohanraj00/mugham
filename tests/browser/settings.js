import { setTimeout as delay } from 'node:timers/promises';

export const SETTINGS_PAGE = 'examples/cards/settings.html';

function readSettings() {
  const root = (name) => document.querySelector('mu-' + name).shadowRoot;
  const parts = (name, part) => [...root(name).querySelectorAll('[part="' + part + '"]')];
  const tabs = parts('tabs', 'tab');
  const panels = parts('tabs', 'panel');
  const toggles = parts('accordion', 'toggle');
  const sections = parts('accordion', 'panel');
  const dialog = parts('dialog', 'dialog')[0];
  const close = parts('dialog', 'close')[0];
  const action = document.querySelector('mu-action-button');
  const toast = parts('toast', 'toast')[0];
  const select = document.getElementById('digest-frequency');
  const review = document.getElementById('review-settings');
  let active = document.activeElement;
  while (active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const forced = matchMedia('(forced-colors: active)').matches;
  const probe = document.createElement('span');
  probe.style.forcedColorAdjust = 'none';
  probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
  probe.style.backgroundColor = forced ? 'ButtonFace' : 'var(--mu-color-surface)';
  document.body.append(probe);
  const ringColor = getComputedStyle(probe).color;
  const surface = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const focus = getComputedStyle(active);
  const controls = [...tabs, ...toggles, select, review, close, ...action.shadowRoot.querySelectorAll('button')]
    .filter((node) => node.getClientRects().length);
  return {
    selected: document.querySelector('mu-tabs').selected,
    selectedStates: tabs.map((tab) => tab.getAttribute('aria-selected')),
    tabStops: tabs.map((tab) => tab.tabIndex),
    panels: panels.map((panel) => [panel.hidden, panel.getAttribute('tabindex')]),
    expanded: toggles.map((toggle) => toggle.getAttribute('aria-expanded')),
    sections: sections.map((section) => section.hidden),
    focus: active.id || active.getAttribute('part'),
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2 && focus.outlineColor === ringColor,
    targets: controls.every((node) => {
      const { width, height } = node.getBoundingClientRect();
      return width >= 44 && height >= 44;
    }),
    surfaces: [...tabs, ...toggles].every((node) => {
      const css = getComputedStyle(node);
      return css.backgroundColor === surface && css.borderStyle === 'solid';
    }),
    noMotion: [...controls, ...panels, ...sections].every((node) => {
      const css = getComputedStyle(node);
      return css.animationName === 'none' && css.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }),
    forced, dark: matchMedia('(prefers-color-scheme: dark)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    modal: dialog.open, action: action.dataset.state,
    toast: toast.matches(':popover-open') && root('toast').querySelector('[role="status"]').textContent,
    result: document.getElementById('save-result').textContent,
    events: window.settingsEvents,
    saves: window.settingsSaves,
  };
}

export async function settingsExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = () => page(`(${readSettings})()`);
  const press = async (name, number, code = name, text) => {
    await key(session, sessionId, name, code, number, text);
    if (name === 'Escape') {
      await delay(150);
      await session.send('Page.bringToFront', {}, sessionId);
    }
  };
  const enter = () => press('Enter', 13, 'Enter', '\r');
  const space = () => press(' ', 32, 'Space', ' ');
  const tab = () => press('Tab', 9);
  const escape = () => press('Escape', 27);
  const backTab = async () => {
    const data = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...data }, sessionId);
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...data }, sessionId);
  };
  const waitFor = (expression) => page(`new Promise((done, fail) => {
    const end = performance.now() + 5000;
    function check() {
      if (${expression}) done(true);
      else if (performance.now() < end) setTimeout(check, 16);
      else fail(new Error('The settings example did not reach the expected state.'));
    }
    check();
  })`);
  const check = (mode, step, ok, detail) => steps.push({
    page: SETTINGS_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail),
  });
  const fits = ({ width, scroll, targets }) => width === 375 && scroll === width && targets;
  const activeTab = (state, index, name) => state.selected === name && state.focus === 'tab-' + name && state.ring
    && state.tabStops[index] === 0 && state.tabStops.filter((stop) => stop === 0).length === 1
    && state.selectedStates[index] === 'true' && state.selectedStates.filter((value) => value === 'true').length === 1
    && !state.panels[index][0] && state.panels.filter(([hidden]) => !hidden).length === 1;

  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${SETTINGS_PAGE}`, problems);
      await waitFor('innerWidth === 375 && document.querySelector("mu-tabs")?.selected === "general" && document.querySelector("mu-toast")');
      await page(`(() => {
        window.settingsEvents = [];
        window.settingsSaves = [];
        for (const type of ['mu-tabs-change', 'mu-accordion-toggle']) {
          document.addEventListener(type, (event) => window.settingsEvents.push(event.detail));
        }
        document.addEventListener('mu-action', (event) => window.settingsSaves.push(event.detail.arguments.frequency));
        document.querySelector('mu-tabs').shadowRoot.querySelector('[role="tab"]').focus();
      })()`);

      const generalRoles = await axErrors(session, sessionId, [
        ['tablist', 'Settings'], ['tab', 'General'], ['tab', 'Notifications'], ['tab', 'Access rules'], ['tabpanel', 'General'],
      ], SETTINGS_PAGE);
      check(mode, 'the tab list, tabs and visible panel have names', generalRoles.every(({ ok }) => ok), generalRoles);
      await tab();
      const general = await read();
      await backTab();
      const back = await read();
      check(mode, 'Tab reaches the text panel and Shift+Tab returns to the selected tab',
        general.focus === 'tab-panel-general' && general.ring && general.panels[0][1] === '0'
        && activeTab(back, 0, 'general'), { general, back });

      for (const [name, number, index, selected] of [
        ['ArrowLeft', 37, 2, 'access_rules'], ['ArrowRight', 39, 0, 'general'], ['ArrowRight', 39, 1, 'notifications'],
        ['End', 35, 2, 'access_rules'], ['Home', 36, 0, 'general'],
      ]) {
        await press(name, number);
        const state = await read();
        check(mode, name + ' selects ' + selected + ' and shows its focus ring', activeTab(state, index, selected), state);
      }
      const arrows = await read();
      check(mode, 'each tab change sends one event', arrows.events.map(({ name }) => name).join()
        === 'access_rules,general,notifications,access_rules,general', arrows.events);
      if (mode === 'light') {
        await page('document.documentElement.dir = "rtl"');
        await press('ArrowRight', 39);
        const right = await read();
        await press('ArrowLeft', 37);
        const left = await read();
        check(mode, 'right to left text reverses the arrows and keeps wrapping',
          activeTab(right, 2, 'access_rules') && activeTab(left, 0, 'general') && fits(right), { right, left });
        await page('document.documentElement.removeAttribute("dir")');
      }

      await press('ArrowRight', 39);
      await tab();
      const first = await read();
      const roles = await axErrors(session, sessionId, [
        ['tabpanel', 'Notifications'], ['group', 'Notice settings'], ['heading', 'Digest schedule'],
        ['heading', 'Reminders'], ['button', 'Digest schedule'], ['button', 'Reminders'],
      ], SETTINGS_PAGE);
      check(mode, 'Tab enters the accordion and its headings and buttons have names',
        first.focus === 'section-digest_schedule' && first.ring && first.panels[1][1] === null
        && first.sections.every(Boolean) && roles.every(({ ok }) => ok), { first, roles });

      await enter();
      const expanded = await read();
      await tab();
      const frequency = await read();
      await tab();
      const review = await read();
      await tab();
      const second = await read();
      await space();
      const both = await read();
      await escape();
      const escaped = await read();
      await space();
      const collapsed = await read();
      check(mode, 'Enter and Space toggle independent sections and Escape keeps them open',
        expanded.expanded.join() === 'true,false' && expanded.focus === first.focus && expanded.ring
        && both.expanded.join() === 'true,true' && both.sections.every((hidden) => !hidden)
        && escaped.expanded.join() === 'true,true' && escaped.focus === second.focus
        && collapsed.expanded.join() === 'true,false' && collapsed.focus === second.focus
        && JSON.stringify(collapsed.events.filter(({ expanded }) => expanded !== undefined)) === JSON.stringify([
          { name: 'digest_schedule', expanded: true }, { name: 'reminders', expanded: true }, { name: 'reminders', expanded: false },
        ]), { expanded, both, escaped, collapsed });
      check(mode, 'Tab follows the open section content and gives each control a focus ring',
        frequency.focus === 'digest-frequency' && frequency.ring && review.focus === 'review-settings' && review.ring
        && second.focus === 'section-reminders' && second.ring, { frequency, review, second });
      check(mode, 'the page fits at 375 CSS pixels and uses the active theme with full size targets',
        [general, first, both].every((state) => fits(state) && state.surfaces
          && state.forced === (mode === 'forced-colors') && state.reduced === (mode === 'reduced-motion')
          && (mode === 'forced-colors' || state.dark === (mode === 'dark'))
          && (mode !== 'reduced-motion' || state.noMotion)), both);
      steps.push(...await pageRules(session, sessionId, SETTINGS_PAGE + ' in ' + mode));

      await backTab();
      await enter();
      const modal = await read();
      const modalRoles = await axErrors(session, sessionId, [
        ['dialog', 'Review notice settings'], ['button', 'Close review'], ['button', 'Save settings'],
      ], SETTINGS_PAGE);
      await escape();
      const closed = await read();
      check(mode, 'the review dialog has a close control and Escape returns focus to Review',
        modal.modal && modal.focus === 'close' && modal.ring && fits(modal) && modalRoles.every(({ ok }) => ok)
        && !closed.modal && closed.focus === 'review-settings' && closed.ring && closed.saves.length === 0,
      { modal, closed, modalRoles });
      if (mode !== 'light') continue;

      await page(`(() => {
        const input = document.getElementById('digest-frequency');
        input.value = 'weekly';
      })()`);
      await enter();
      await tab();
      await enter();
      const confirm = await read();
      check(mode, 'the action asks for confirmation before it sends a request',
        confirm.modal && confirm.action === 'confirm' && confirm.focus === 'cancel' && confirm.ring
        && confirm.saves.length === 0 && !confirm.toast && fits(confirm), confirm);
      steps.push(...await pageRules(session, sessionId, SETTINGS_PAGE + ' with the confirm step open'));
      await escape();
      const canceled = await read();
      check(mode, 'Escape closes the confirm step and keeps the dialog open',
        canceled.modal && canceled.action === 'default' && canceled.focus === 'button'
        && canceled.ring && canceled.saves.length === 0, canceled);
      await enter();
      await tab();
      const accept = await read();
      await enter();
      await waitFor('document.querySelector("mu-action-button").dataset.state === "done" && document.querySelector("mu-toast").shadowRoot.querySelector("[role=status]").textContent');
      const saved = await read();
      const savedRoles = await axErrors(session, sessionId, [['status', 'Notification']], SETTINGS_PAGE);
      check(mode, 'one save gives a receipt and a toast and returns focus to Review',
        accept.focus === 'accept' && accept.ring && !saved.modal && saved.focus === 'review-settings'
        && saved.saves.join() === 'weekly' && saved.toast === 'Settings saved.' && saved.result === 'Saved digest frequency: Weekly.'
        && fits(saved) && savedRoles.every(({ ok }) => ok), { accept, saved, savedRoles });
      steps.push(...await pageRules(session, sessionId, SETTINGS_PAGE + ' after a save'));
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Page.bringToFront', {}, sessionId);
  }
  return steps;
}
