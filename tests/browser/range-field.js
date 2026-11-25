// The range field example uses one handle for days and two handles for prices.
export const RANGE_PAGE = 'examples/forms/ranges.html';

export async function rangeExampleChecks(session, sessionId, base, modes, { evaluate, open, key }, problems) {
  const steps = [];
  const evalPage = (expression) => evaluate(session, sessionId, expression);
  const read = () => evalPage(`(() => {
    const form = document.querySelector('mu-editable-form').shadowRoot;
    const fields = [...form.querySelectorAll('mu-range-field')];
    const controls = fields.flatMap(({ shadowRoot }) => [...shadowRoot.querySelectorAll('.controls input')].map((input) => {
      const { width, height } = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      return { width, height, value: input.valueAsNumber, min: input.min, max: input.max,
        focused: shadowRoot.activeElement === input,
        ring: [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor],
        appearance: style.appearance, accent: style.accentColor, border: style.borderStyle,
        noMotion: style.transitionDuration.split(',').every((time) => parseFloat(time) === 0) };
    }));
    const probe = document.body.appendChild(document.createElement('span'));
    const forced = matchMedia('(forced-colors: active)').matches;
    probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
    const focus = getComputedStyle(probe).color;
    probe.style.color = 'var(--mu-color-accent)';
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return { controls, width: innerWidth, scroll: document.documentElement.scrollWidth, focus, accent, forced,
      dark: matchMedia('(prefers-color-scheme: dark)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  })()`);
  const press = (name, code, text) => key(session, sessionId, name, name, code, text);
  const check = (mode, step, ok, detail) => steps.push({ page: RANGE_PAGE, step: mode + ': ' + step,
    ok, detail: JSON.stringify(detail) });
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${RANGE_PAGE}`, problems);
      await evalPage(`new Promise((done, fail) => {
        const end = performance.now() + 5000;
        function ready() {
          if (innerWidth === 375 && document.querySelector('mu-editable-form')?.shadowRoot.querySelectorAll('mu-range-field').length === 2) done(true);
          else if (performance.now() < end) requestAnimationFrame(ready);
          else fail(new Error('The range form did not load at 375 CSS pixels.'));
        }
        ready();
      })`);
      const start = await read();
      check(mode, 'each control has a 44 by 44 CSS pixel target and the page fits without horizontal scroll',
        start.width === 375 && start.scroll === 375 && start.controls.length === 6
        && start.controls.every(({ width, height }) => width >= 44 && height >= 44), start);
      check(mode, 'the native slider and number box are visible in this mode',
        start.controls.every(({ appearance, border }, index) => index % 2 ? border === 'solid' : appearance !== 'none')
        && start.forced === (mode === 'forced-colors') && start.reduced === (mode === 'reduced-motion')
        && (mode !== 'light' && mode !== 'dark' || (start.dark === (mode === 'dark') && start.controls[0].accent === start.accent))
        && (mode !== 'reduced-motion' || start.controls.every(({ noMotion }) => noMotion)), start);
      await evalPage(`(() => {
        const form = document.querySelector('mu-editable-form').shadowRoot.querySelector('form');
        form.tabIndex = -1;
        form.focus();
      })()`);
      const tab = async (index) => {
        await press('Tab', 9);
        const state = await read();
        const control = state.controls[index];
        check(mode, 'Tab focuses control ' + (index + 1) + ' with a visible ring', control.focused
          && JSON.stringify(control.ring) === JSON.stringify(['solid', '2px', '2px', state.focus]), control);
      };
      await tab(0);
      if (mode !== 'light') {
        await tab(1);
        continue;
      }
      for (const [name, code, value] of [['ArrowRight', 39, 15], ['ArrowUp', 38, 16], ['ArrowLeft', 37, 15],
        ['ArrowDown', 40, 14], ['PageUp', 33, 24], ['PageDown', 34, 14], ['End', 35, 28], ['Home', 36, 7], ['ArrowRight', 39, 8]]) {
        await press(name, code);
        const { controls: [slider, number] } = await read();
        check(mode, name + ' changes the loan period and its number box', slider.value === value && number.value === value, { slider, number });
      }
      await tab(1);
      await tab(2);
      await press('End', 35);
      await press('ArrowRight', 39);
      const tied = await read();
      check(mode, 'the low slider stops at the high value', tied.controls[2].value === 60 && tied.controls[3].value === 60
        && tied.controls[4].min === '60', tied.controls);
      const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
      const limits = nodes.filter((node) => !node.ignored && node.role?.value === 'slider' && node.name?.value.startsWith('Price range'))
        .map((node) => [node.name.value, node.value?.value, ...['valuemin', 'valuemax'].map((name) =>
          node.properties?.find((item) => item.name === name)?.value?.value)]);
      check(mode, 'the accessibility tree has current values and dependent limits for both price sliders',
        JSON.stringify(limits) === JSON.stringify([['Price range Minimum', 60, 0, 60], ['Price range Maximum', 60, 60, 100]]), limits);
      await tab(3);
      await evalPage(`(() => {
        const form = document.querySelector('mu-editable-form').shadowRoot;
        const number = form.querySelectorAll('mu-range-field')[1].shadowRoot.querySelector('[part="number"]');
        number.value = '25';
        number.dispatchEvent(new Event('input'));
      })()`);
      const edited = await read();
      check(mode, 'a number box edit updates the low slider and the high limit', edited.controls[2].value === 25
        && edited.controls[3].value === 25 && edited.controls[4].min === '25', edited.controls);
      await tab(4);
      await press('Home', 36);
      await press('ArrowLeft', 37);
      const joined = await read();
      check(mode, 'the high slider stops at the low value', joined.controls[4].value === 25
        && joined.controls[5].value === 25 && joined.controls[2].max === '25', joined.controls);
      await press('PageUp', 33);
      await tab(5);
      await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }, sessionId);
      const back = await read();
      check(mode, 'Shift+Tab goes back to the high slider', back.controls[4].focused, back.controls);
      await tab(5);
      await press('Tab', 9);
      await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
      const sent = await evalPage(`({
        args: JSON.parse(document.querySelector('#main pre').textContent || '{}'),
        state: document.querySelector('mu-editable-form').dataset.state
      })`);
      check(mode, 'the form sends a number and an ordered pair, then shows Done after the receipt',
        sent.args.days === 8 && JSON.stringify(sent.args.price) === '[25,75]' && sent.state === 'done', sent);
    }
  } finally {
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  }
  return steps;
}
