export const COLOR_PAGE = 'examples/forms/colors.html';
export const CONTACT_PAGE = 'examples/forms/contact.html';

export async function colorExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules }, problems) {
  const steps = [];
  const check = (mode, step, ok, detail) =>
    steps.push({ page: COLOR_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail) });
  const run = (source) => evaluate(session, sessionId, source);
  const read = () => run(`(() => {
    const form = document.querySelector('mu-editable-form').shadowRoot;
    const select = form.querySelector('mu-app-color-field').shadowRoot.querySelector('select');
    const submit = form.querySelector('button[type="submit"]');
    const forced = matchMedia('(forced-colors: active)').matches;
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
    const focus = getComputedStyle(probe).color;
    probe.style.color = forced ? 'Field' : 'var(--mu-color-surface)';
    const surface = getComputedStyle(probe).color;
    probe.remove();
    const controls = [select, submit].map((node) => {
      const { width, height } = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { width, height, focused: node.getRootNode().activeElement === node,
        background: style.backgroundColor, border: style.borderStyle,
        ring: [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor],
        noMotion: style.transitionProperty === 'none' && style.animationName === 'none' };
    });
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, forced, focus, surface, controls,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  })()`);
  try {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    for (const [mode, features] of Object.entries(modes)) {
      await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
      await open(session, sessionId, `${base}/${COLOR_PAGE}`, problems);
      await run(`new Promise((done, fail) => {
        const end = performance.now() + 5000;
        function ready() {
          if (innerWidth === 375 && document.querySelector('mu-editable-form') && document.querySelector('.has-docs')) done(true);
          else if (performance.now() < end) requestAnimationFrame(ready);
          else fail(new Error('The color form did not load at 375 CSS pixels.'));
        }
        ready();
      })`);
      const view = await read();
      check(mode, 'the controls are at least 44 by 44 CSS pixels and the page has no horizontal scroll',
        view.width === 375 && view.scroll === 375
        && view.controls.every(({ width, height }) => width >= 44 && height >= 44), view);
      check(mode, 'the select has a visible border and uses the theme colors and motion',
        view.controls[0].border === 'solid' && view.controls[0].background === view.surface
        && view.forced === (mode === 'forced-colors') && view.reduced === (mode === 'reduced-motion')
        && (!['light', 'dark'].includes(mode) || view.dark === (mode === 'dark'))
        && (!view.reduced || view.controls.every(({ noMotion }) => noMotion)), view);

      await run(`(() => {
        const form = document.querySelector('mu-editable-form').shadowRoot.querySelector('form');
        form.tabIndex = -1;
        form.focus();
      })()`);
      for (const [index, name] of ['select', 'submit button'].entries()) {
        await key(session, sessionId, 'Tab', 'Tab', 9);
        const state = await read();
        const control = state.controls[index];
        check(mode, 'Tab shows a focus ring on the ' + name,
          control.focused && JSON.stringify(control.ring) === JSON.stringify(['solid', '2px', '2px', state.focus]), control);
      }
      steps.push(...await pageRules(session, sessionId, COLOR_PAGE + ' ' + mode));
      if (mode !== 'light') continue;

      const result = await run(`(async () => {
        const host = document.querySelector('mu-editable-form');
        const form = host.shadowRoot;
        const field = form.querySelector('mu-app-color-field').shadowRoot;
        const select = field.querySelector('select');
        const submit = form.querySelector('button[type="submit"]');
        const log = document.querySelector('#main pre');
        submit.click();
        const problem = field.querySelector('[part="problem"]');
        const blocked = log.textContent === '' && select.getAttribute('aria-invalid') === 'true'
          && select.getAttribute('aria-describedby')?.split(' ').includes(problem.id) && field.activeElement === select;
        const error = problem.textContent;
        select.value = 'Reed green';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        submit.click();
        await new Promise((done) => requestAnimationFrame(done));
        return { blocked, error, cleared: !problem.textContent && !select.hasAttribute('aria-invalid'),
          args: JSON.parse(log.textContent || '{}'), state: host.dataset.state };
      })()`);
      check(mode, 'the form shows the missing color error and sends the selected color after correction',
        result.blocked && result.error === 'Choose a label color.' && result.cleared
        && JSON.stringify(result.args) === '{"color":"Reed green"}' && result.state === 'done', result);
    }
  } finally {
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  }
  return steps;
}

export async function contactExampleChecks(session, sessionId, base, { evaluate, open }, problems) {
  await open(session, sessionId, `${base}/${CONTACT_PAGE}`, problems);
  const result = await evaluate(session, sessionId, `(async () => {
    const root = document.querySelector('mu-app-contact-card').shadowRoot;
    const name = root.querySelector('mu-field').shadowRoot.querySelector('input');
    const method = root.querySelector('mu-choice-field').shadowRoot;
    const save = root.querySelector('mu-action-button');
    const log = document.querySelector('#main pre');
    name.value = 'Contact B2';
    name.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    const phone = [...method.querySelectorAll('input')].find((node) => node.value === 'Phone');
    phone.click();
    const before = log.textContent;
    save.shadowRoot.querySelector('button[part="button"]').click();
    await new Promise((done) => requestAnimationFrame(done));
    return { before, method: phone.checked, args: JSON.parse(log.textContent || '{}'), state: save.dataset.state };
  })()`);
  return [{ page: CONTACT_PAGE, step: 'the action sends both edited values and shows the receipt',
    ok: result.before === '' && result.method && result.state === 'done'
      && result.args.contact_name === 'Contact B2' && result.args.method === 'Phone', detail: JSON.stringify(result) }];
}
