export const POPOVER_PAGE = 'examples/cards/popovers.html';

function readPopovers() {
  const menu = document.querySelector('mu-menu');
  const tooltip = document.querySelector('mu-tooltip');
  const toast = document.querySelector('mu-toast');
  const part = (element, name) => element.shadowRoot.querySelector('[part="' + name + '"]');
  const trigger = part(menu, 'trigger');
  const items = [...menu.shadowRoot.querySelectorAll('[part="item"]')];
  const target = document.getElementById('tray-help');
  const show = document.getElementById('show-toast');
  const showError = document.getElementById('show-error');
  const close = part(toast, 'close');
  const panels = [part(menu, 'menu'), part(tooltip, 'tooltip'), part(toast, 'toast')];
  const box = (node) => node?.getBoundingClientRect().toJSON();
  const forced = matchMedia('(forced-colors: active)').matches;
  const probe = document.createElement('span');
  probe.style.forcedColorAdjust = 'none';
  probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
  probe.style.backgroundColor = forced ? 'Canvas' : 'var(--mu-color-surface)';
  document.body.append(probe);
  const expected = getComputedStyle(probe);
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const focus = getComputedStyle(active);
  const open = panels.map((node) => node?.matches(':popover-open') ?? false);
  const description = (target.getAttribute('aria-describedby') ?? '').split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent).filter(Boolean).join(' ');
  const targetSize = (node) => {
    const { width, height } = box(node);
    return width >= 44 && height >= 44;
  };
  const result = {
    open, states: [menu, tooltip, toast].map((node) => node.dataset.state),
    expanded: trigger.getAttribute('aria-expanded'), description, text: panels[1].textContent,
    focus: [trigger, ...items, target, show, showError, close].indexOf(active),
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2 && focus.outlineColor === expected.color,
    targets: [trigger, target, show, showError, ...(open[0] ? items : []), ...(open[2] && close ? [close] : [])].every(targetSize),
    surfaces: panels.every((node, index) => !open[index] || (getComputedStyle(node).backgroundColor === expected.backgroundColor
      && getComputedStyle(node).borderStyle === 'solid')),
    noMotion: [...panels, trigger, ...items, target, show, showError, close].filter(Boolean).every((node) => {
      const css = getComputedStyle(node);
      return css.animationName === 'none' && css.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }),
    forced, dark: matchMedia('(prefers-color-scheme: dark)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    boxes: panels.map(box), targetBox: box(target), width: innerWidth, height: innerHeight,
    scroll: document.documentElement.scrollWidth,
    status: toast.shadowRoot.querySelector('[role="status"]')?.textContent,
    alert: toast.shadowRoot.querySelector('[role="alert"]')?.textContent,
    events: window.popoverEvents,
  };
  probe.remove();
  return result;
}

export async function popoverExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = () => page(`(${readPopovers})()`);
  const press = async (name, code, number, text) => {
    await key(session, sessionId, name, code, number, text);
    if (name === 'Escape') await session.send('Page.bringToFront', {}, sessionId);
  };
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const space = () => press(' ', 'Space', 32, ' ');
  const escape = () => press('Escape', 'Escape', 27);
  const tab = () => press('Tab', 'Tab', 9);
  const point = (x, y) => session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);
  const check = (mode, step, ok, detail) => steps.push({ page: POPOVER_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail) });
  const inViewport = (state, index) => {
    const { left, right, top, bottom } = state.boxes[index];
    return state.width === 375 && state.scroll === 375 && left >= 0 && right <= state.width
      && top >= 0 && bottom <= state.height;
  };
  const clearOfTarget = ({ boxes: [, tooltip], targetBox }) =>
    tooltip.bottom <= targetBox.top || tooltip.top >= targetBox.bottom;
  const waitFor = (expression) => page(`new Promise((done, fail) => {
    const end = performance.now() + 6000;
    function check() {
      if (${expression}) done(true);
      else if (performance.now() < end) setTimeout(check, 16);
      else fail(new Error('The popover example did not reach the expected state.'));
    }
    check();
  })`);

  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${POPOVER_PAGE}`, problems);
      await waitFor('innerWidth === 375 && document.getElementById("tray-help")?.hasAttribute("aria-describedby")');
      await page(`(() => {
        window.popoverEvents = [];
        for (const type of ['mu-menu-select', 'mu-menu-open', 'mu-menu-close', 'mu-tooltip-open', 'mu-tooltip-close',
          'mu-toast-open', 'mu-toast-close', 'mu-action']) {
          document.addEventListener(type, (event) => window.popoverEvents.push(event.detail?.name ?? type));
        }
        document.querySelector('mu-menu').shadowRoot.querySelector('[part="trigger"]').focus();
      })()`);

      await press('ArrowUp', 'ArrowUp', 38);
      const menu = await read();
      check(mode, 'Up opens the menu at the last item with a focus ring', menu.open[0] && menu.states[0] === 'open'
        && menu.focus === 3 && menu.expanded === 'true' && menu.ring, menu);
      check(mode, 'the menu fits and uses the current theme', inViewport(menu, 0) && menu.surfaces && menu.targets
        && menu.forced === (mode === 'forced-colors') && menu.reduced === (mode === 'reduced-motion')
        && (mode === 'forced-colors' || menu.dark === (mode === 'dark'))
        && (mode !== 'reduced-motion' || menu.noMotion), menu);
      steps.push(...await pageRules(session, sessionId, POPOVER_PAGE + ' with the menu open in ' + mode));
      const menuRoles = await axErrors(session, sessionId, [['menu', 'Tray options'], ['menuitem', 'Show note']], POPOVER_PAGE);
      check(mode, 'the menu and items have names', menuRoles.every(({ ok }) => ok), menuRoles);

      const order = [];
      for (const [name, number] of [['ArrowDown', 40], ['End', 35], ['Home', 36], ['ArrowUp', 38]]) {
        await press(name, name, number);
        order.push((await read()).focus);
      }
      check(mode, 'the menu moves focus in order', order.join() === '1,3,1,3', order);
      await escape();
      const escaped = await read();
      check(mode, 'Escape closes the menu and returns focus to its trigger',
        !escaped.open[0] && escaped.expanded === 'false' && escaped.focus === 0 && escaped.ring, escaped);

      await enter();
      const opened = await read();
      await press('End', 'End', 35);
      await space();
      await waitFor('window.popoverEvents.includes("show_note")');
      const selected = await read();
      check(mode, 'Enter opens the menu and Space selects one item',
        opened.open[0] && opened.focus === 1 && !selected.open[0] && selected.focus === 0
        && selected.events.filter((name) => name === 'show_note').length === 1 && !selected.events.includes('mu-action'), selected);
      await space();
      await tab();
      await waitFor('document.querySelector("mu-menu").dataset.state === "default"');
      const help = await read();
      check(mode, 'Tab leaves the menu and gives focus to the tooltip target', !help.open[0] && help.open[1]
        && help.focus === 4 && help.ring && help.description === help.text, help);
      check(mode, 'the tooltip fits below or above its target', inViewport(help, 1) && clearOfTarget(help)
        && help.targets && help.surfaces && (mode !== 'reduced-motion' || help.noMotion), help);
      steps.push(...await pageRules(session, sessionId, POPOVER_PAGE + ' with the tooltip open in ' + mode));
      const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
      const accessibleTarget = nodes.find((node) => !node.ignored && node.role?.value === 'button'
        && node.name?.value === 'About this tray');
      check(mode, 'the tooltip gives its text as the accessible description of the target',
        accessibleTarget?.description?.value === help.text && nodes.some((node) => !node.ignored && node.role?.value === 'tooltip'),
        accessibleTarget);
      await escape();
      const hidden = await read();
      check(mode, 'Escape closes the tooltip and keeps focus on its target', !hidden.open[1] && hidden.focus === 4, hidden);

      await tab();
      const button = await read();
      const { left, top, width, height } = button.targetBox;
      await point(left + width / 2, top + height / 2);
      await waitFor('document.querySelector("mu-tooltip").dataset.state === "open"');
      const hover = await read();
      const box = hover.boxes[1];
      await point(box.left + box.width / 2, box.top + box.height / 2);
      const overText = await read();
      check(mode, 'the tooltip stays open over its text and keeps the current focus', hover.focus === 5
        && overText.open[1] && overText.focus === 5, overText);
      await point(1, 1);
      await waitFor('document.querySelector("mu-tooltip").dataset.state === "default"');

      await enter();
      await waitFor('document.querySelector("mu-toast").shadowRoot.querySelector("[role=status]").textContent');
      const toast = await read();
      check(mode, 'the normal toast reports status without moving focus', toast.open[2] && toast.focus === 5
        && toast.status === 'Tray note saved.' && !toast.alert && inViewport(toast, 2) && toast.surfaces && toast.targets
        && (mode !== 'reduced-motion' || toast.noMotion), toast);
      const statusRoles = await axErrors(session, sessionId, [['status', 'Notification']], POPOVER_PAGE);
      check(mode, 'the toast exposes a named status', statusRoles.every(({ ok }) => ok), statusRoles);

      await tab();
      await enter();
      await waitFor('document.querySelector("mu-toast").shadowRoot.querySelector("[role=alert]").textContent');
      const error = await read();
      check(mode, 'the error toast reports an alert and keeps focus on its trigger', error.open[2] && error.focus === 6
        && error.alert === 'Tray note did not save.' && !error.status && error.targets && error.surfaces, error);
      steps.push(...await pageRules(session, sessionId, POPOVER_PAGE + ' with the error toast open in ' + mode));
      const toastRoles = await axErrors(session, sessionId, [['alert', 'Notification'], ['button', 'Close message']], POPOVER_PAGE);
      check(mode, 'the alert and its close button have names', toastRoles.every(({ ok }) => ok), toastRoles);
      await tab();
      const close = await read();
      await space();
      const closed = await read();
      check(mode, 'Tab reaches the close button and Space closes the toast', close.focus === 7 && close.ring
        && !closed.open[2] && closed.focus === 6 && closed.ring, { close, closed });
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
  }
  return steps;
}
