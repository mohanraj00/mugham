export const BOOKING_PAGE = 'examples/forms/booking.html';

export async function bookingExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules }, problems) {
  const steps = [];
  const run = (expression) => evaluate(session, sessionId, expression);
  const form = "document.querySelector('mu-editable-form')?.shadowRoot.querySelector('form')";
  const inputs = `[...(${form}).querySelectorAll('mu-date-range-field, mu-time-field, mu-date-time-field')]
    .flatMap(({ shadowRoot }) => [...shadowRoot.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"]')])`;
  const read = () => run(`(() => {
    const probe = document.body.appendChild(document.createElement('span'));
    const forced = matchMedia('(forced-colors: active)').matches;
    probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
    const focus = getComputedStyle(probe).color;
    probe.style.color = 'var(--mu-color-surface)';
    const surface = getComputedStyle(probe).color;
    probe.remove();
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, focus, surface, forced,
      dark: matchMedia('(prefers-color-scheme: dark)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      controls: (${inputs}).map((input) => {
        const { width, height } = input.getBoundingClientRect();
        const style = getComputedStyle(input);
        const label = input.labels[0];
        return { width, height, label: label?.getClientRects().length ? label.innerText : null,
          type: input.type, required: input.required,
          focused: input.getRootNode().activeElement === input,
          ring: [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor],
          background: style.backgroundColor, border: style.borderStyle, appearance: style.appearance,
          noMotion: style.transitionProperty === 'none' && style.animationName === 'none' };
      }) };
  })()`);
  const check = (mode, step, ok, detail) => steps.push({ page: BOOKING_PAGE, step: mode + ': ' + step, ok,
    detail: JSON.stringify(detail) });
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${BOOKING_PAGE}`, problems);
      await run(`new Promise((done, fail) => {
        const end = performance.now() + 5000;
        function ready() {
          if (innerWidth === 375 && (${form})) done(true);
          else if (performance.now() < end) requestAnimationFrame(ready);
          else fail(new Error('The room booking form did not load at 375 CSS pixels.'));
        }
        ready();
      })`);
      const view = await read();
      const labels = ['Start date', 'End date', 'Start time', 'Setup date and time'];
      check(mode, 'the four native inputs have visible labels and fit without horizontal scroll',
        view.width === 375 && view.scroll === 375
        && JSON.stringify(view.controls.map(({ label, type }) => [label, type]))
          === JSON.stringify(labels.map((label, index) => [label, ['date', 'date', 'time', 'datetime-local'][index]]))
        && view.controls.every(({ width, height, required }) => width >= 44 && height >= 44 && required), view);
      check(mode, 'the inputs keep their native display, border and surface in this mode',
        view.controls.every(({ background, border, appearance }) => (view.forced || background === view.surface)
          && border === 'solid' && appearance !== 'none')
        && view.forced === (mode === 'forced-colors') && view.reduced === (mode === 'reduced-motion')
        && (mode !== 'light' && mode !== 'dark' || view.dark === (mode === 'dark'))
        && (mode !== 'reduced-motion' || view.controls.every(({ noMotion }) => noMotion)), view);

      await run(`(() => { const node = ${form}; node.tabIndex = -1; node.focus(); })()`);
      // The browser can put more than one tab stop in a date or time input.
      const visited = [];
      for (let attempt = 0; attempt < 32 && visited.length < labels.length; attempt += 1) {
        await key(session, sessionId, 'Tab', 'Tab', 9);
        const state = await read();
        const input = state.controls.find(({ focused }) => focused);
        if (!input || visited.includes(input.label)) continue;
        visited.push(input.label);
        check(mode, 'Tab shows a focus ring on ' + input.label,
          JSON.stringify(input.ring) === JSON.stringify(['solid', '2px', '2px', state.focus]), input);
      }
      check(mode, 'Tab reaches each native input in order', JSON.stringify(visited) === JSON.stringify(labels), visited);
      steps.push(...await pageRules(session, sessionId, BOOKING_PAGE + ' ' + mode));
      if (mode !== 'light') continue;

      const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
      const exposed = nodes.filter((node) => !node.ignored);
      const local = exposed.find((node) => node.name?.value === labels[3] && node.description?.value?.includes('Time zone Europe/Oslo'));
      check(mode, 'the accessibility tree names each input and gives the fixed zone as a description',
        labels.every((label) => exposed.some((node) => node.name?.value === label)) && Boolean(local), local);

      const result = await run(`(async () => {
        const controls = ${inputs};
        const submit = (${form}).querySelector('button[type="submit"]');
        const log = document.querySelector('#main pre');
        const edit = (input, value) => {
          input.value = value;
          input.dispatchEvent(new Event('input'));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        edit(controls[1], '2028-04-09');
        submit.click();
        const refused = log.textContent === '' && controls[1].getAttribute('aria-invalid') === 'true'
          && controls[1].getRootNode().activeElement === controls[1];
        ['2028-04-12', '2028-04-12', '10:15', '2028-04-12T09:30'].forEach((value, index) => edit(controls[index], value));
        submit.click();
        await new Promise((done) => requestAnimationFrame(done));
        return { refused, args: JSON.parse(log.textContent || '{}'), state: document.querySelector('mu-editable-form').dataset.state };
      })()`);
      check(mode, 'the form refuses reversed dates and sends the corrected date pair and the two text values',
        result.refused && JSON.stringify(result.args.dates) === '["2028-04-12","2028-04-12"]'
        && result.args.start_time === '10:15' && result.args.setup === '2028-04-12T09:30'
        && !Object.hasOwn(result.args, 'time_zone') && result.state === 'done', result);

      const mismatch = await run(`(() => {
        const booking = document.querySelector('mu-editable-form');
        const original = booking.fill;
        const fields = original.data.fields.map((field) => field.component === 'date-time-field'
          ? { ...field, data: { ...field.data, time_zone: 'America/New_York' } } : field);
        booking.fill = { ...original, data: { ...original.data, fields } };
        return { state: booking.dataset.state, form: Boolean(${form}),
          detail: booking.shadowRoot.querySelector('[part="details"] > div')?.textContent };
      })()`);
      check(mode, 'the form refuses a fill with a different time zone from the action binding',
        mismatch.state === 'refused' && !mismatch.form
        && mismatch.detail?.includes('data.fields: the time zone of the field setup is not the time zone of the application'), mismatch);
    }
  } finally {
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  }
  return steps;
}
