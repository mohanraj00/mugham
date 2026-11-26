export const DIALOG_PAGE = 'examples/cards/dialogs.html';

function readModal(name) {
  const modal = document.querySelector('mu-' + name);
  const root = modal.shadowRoot;
  const dialog = root.querySelector('dialog');
  const close = root.querySelector('[part="close"]');
  const trigger = document.getElementById('open-' + name);
  const action = modal.querySelector('mu-action-button');
  const control = action ? action.shadowRoot.querySelector('[part="button"]') : modal.querySelector('button');
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const box = dialog.getBoundingClientRect();
  const forced = matchMedia('(forced-colors: active)').matches;
  const probe = document.createElement('span');
  probe.style.forcedColorAdjust = 'none';
  probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
  probe.style.backgroundColor = forced ? 'Canvas' : 'var(--mu-color-surface)';
  document.body.append(probe);
  const expected = getComputedStyle(probe);
  const focus = active && getComputedStyle(active);
  const style = getComputedStyle(dialog);
  const result = {
    open: dialog.matches(':modal'), state: modal.dataset.state,
    focus: active === close ? 'close' : active === control ? 'body' : active === trigger ? 'trigger'
      : !active || active === document.body || active === document.documentElement ? 'viewport' : 'other',
    ring: focus?.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2 && focus.outlineColor === expected.color,
    targets: [trigger, close, control].map((node) => {
      const { width, height } = node.getBoundingClientRect();
      return width >= 44 && height >= 44;
    }),
    surface: style.backgroundColor === expected.backgroundColor, border: style.borderStyle,
    forced, dark: matchMedia('(prefers-color-scheme: dark)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    noMotion: [dialog, close, control].every((node) => {
      const css = getComputedStyle(node);
      return css.animationName === 'none' && css.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }),
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, height: innerHeight,
    eventNames: window.modalEvents[name], actions: window.modalActions,
    actionState: action?.dataset.state,
  };
  probe.remove();
  return result;
}

export async function dialogExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = (name) => page(`(${readModal})(${JSON.stringify(name)})`);
  const press = (name, code, number, text) => key(session, sessionId, name, code, number, text);
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const tab = () => press('Tab', 'Tab', 9);
  const backTab = async () => {
    const data = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...data }, sessionId);
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...data }, sessionId);
  };
  const check = (mode, step, ok, detail) => steps.push({ page: DIALOG_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail) });

  const waitFor = (expression) => page(`new Promise((done, fail) => {
    const end = performance.now() + 5000;
    function check() {
      if (${expression}) done(true);
      else if (performance.now() < end) requestAnimationFrame(check);
      else fail(new Error('The modal example did not reach the expected state.'));
    }
    check();
  })`);

  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${DIALOG_PAGE}`, problems);
      await waitFor('innerWidth === 375 && document.querySelector("mu-drawer")?.shadowRoot?.querySelector("dialog")');
      await page(`(() => {
        window.modalEvents = { dialog: [], drawer: [] };
        window.modalActions = 0;
        for (const name of ['dialog', 'drawer']) {
          const modal = document.querySelector('mu-' + name);
          for (const type of ['mu-dialog-open', 'mu-dialog-close']) {
            document.addEventListener(type, (event) => {
              if (event.target === modal) window.modalEvents[name].push(type);
            });
          }
        }
        document.addEventListener('mu-action', () => { window.modalActions += 1; });
      })()`);

      for (const [name, title, body] of [
        ['dialog', 'Release tray A3', 'Release tray'],
        ['drawer', 'Tray details', 'Close details'],
      ]) {
        await page(`document.getElementById('open-${name}').focus()`);
        const closed = await read(name);
        await enter();
        const opened = await read(name);
        check(mode, name + ' opens as a modal and puts focus on Close', !closed.open && opened.open
          && opened.state === 'open' && opened.focus === 'close' && opened.eventNames.join() === 'mu-dialog-open', opened);
        check(mode, name + ' fits at 375 CSS pixels and shows 44 by 44 CSS pixel targets',
          [closed, opened].every(({ width, scroll }) => width === 375 && scroll === width)
          && opened.targets.every(Boolean) && opened.box.left >= 0 && opened.box.right <= opened.width
          && (name !== 'drawer' || Math.abs(opened.box.bottom - opened.height) < 1), opened);
        check(mode, name + ' uses the current theme and respects reduced motion', opened.surface && opened.border === 'solid'
          && opened.forced === (mode === 'forced-colors') && opened.reduced === (mode === 'reduced-motion')
          && (mode === 'forced-colors' || opened.dark === (mode === 'dark'))
          && (mode !== 'reduced-motion' || opened.noMotion), opened);
        steps.push(...await pageRules(session, sessionId, DIALOG_PAGE + ' with the ' + name + ' open in ' + mode));
        const roles = await axErrors(session, sessionId, [['dialog', title], ['button', 'Close ' + name], ['button', body]], DIALOG_PAGE);
        check(mode, name + ' exposes the dialog and button names', roles.every(({ ok }) => ok), roles);

        await tab();
        const next = await read(name);
        await backTab();
        const back = await read(name);
        check(mode, name + ' tabs into the body and back to the close button with focus rings',
          next.focus === 'body' && next.ring && back.focus === 'close' && back.ring, { next, back });
        // The browser can give the viewport a Tab step between the last and first controls.
        await backTab();
        const previous = await read(name);
        if (previous.focus === 'viewport') await backTab();
        const last = await read(name);
        await tab();
        const forward = await read(name);
        if (forward.focus === 'viewport') await tab();
        const first = await read(name);
        check(mode, name + ' keeps keyboard focus in the modal controls', last.focus === 'body' && first.focus === 'close',
          { previous, last, forward, first });

        await press('Escape', 'Escape', 27);
        await waitFor(`window.modalEvents.${name}.length === 2`);
        const escaped = await read(name);
        check(mode, name + ' closes with Escape and gives focus back', !escaped.open && escaped.state === 'default'
          && escaped.focus === 'trigger' && escaped.eventNames.at(-1) === 'mu-dialog-close' && escaped.actions === 0, escaped);

        await enter();
        if (name === 'drawer') await tab();
        await press(' ', 'Space', 32, ' ');
        await waitFor(`window.modalEvents.${name}.length === 4`);
        const dismissed = await read(name);
        check(mode, name + ' closes with its button and gives focus back', !dismissed.open && dismissed.focus === 'trigger'
          && dismissed.eventNames.join() === 'mu-dialog-open,mu-dialog-close,mu-dialog-open,mu-dialog-close', dismissed);
      }

      if (mode === 'light') {
        await page('document.getElementById("open-dialog").focus()');
        await enter();
        await tab();
        await enter();
        const confirm = await read('dialog');
        check(mode, 'the action asks for confirmation before it sends a request',
          confirm.actionState === 'confirm' && confirm.actions === 0, confirm);
        await tab();
        await enter();
        await waitFor('document.querySelector("mu-action-button").dataset.state === "done"');
        const done = await read('dialog');
        check(mode, 'the action sends one request and shows Done after the receipt', done.open && done.actions === 1, done);
        await press('Escape', 'Escape', 27);
      }
    }
    await session.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 812, deviceScaleFactor: 1, mobile: false }, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    for (const direction of ['ltr', 'rtl']) {
      await page(`(() => {
        document.documentElement.dir = '${direction}';
        document.getElementById('open-drawer').focus();
        document.querySelector('mu-drawer').open();
      })()`);
      await waitFor('innerWidth === 1000');
      const side = await read('drawer');
      check('desktop', 'the drawer opens at the inline end in ' + direction, side.open
        && (direction === 'ltr' ? Math.abs(side.box.right - side.width) < 1 : Math.abs(side.box.left) < 1)
        && side.box.top === 0 && Math.abs(side.box.bottom - side.height) < 1, side);
      await page('document.querySelector("mu-drawer").close()');
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
  }
  return steps;
}
