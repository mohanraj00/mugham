import { RICH_TEXT_FIELD_PAGE } from './rich-text-field.js';

const LOANS_PAGE = 'examples/cards/loans.html';

async function prepareControls(note) {
  const deadline = performance.now() + 3000;
  let host;
  let fieldRoot;
  do {
    if (note) {
      host = document.querySelector('mu-editable-form')?.shadowRoot?.querySelector('mu-rich-text-field');
      fieldRoot = host?.shadowRoot;
      if (fieldRoot?.querySelector('[part="link-editor"]')) break;
    } else {
      host = document.querySelector('mu-card-grid');
      if (host?.shadowRoot.querySelector('mu-card')) break;
    }
    if (performance.now() > deadline) throw new Error('The controls did not load.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (true);

  const target = (element, part, name, tooltipPart = 'tooltip') => {
    const root = element.shadowRoot;
    const button = root.querySelector(`[part="${part}"]`);
    return { element, button, name, tooltip: root.querySelector(`[part="${tooltipPart}"]`),
      area: button.parentElement };
  };
  if (note) {
    fieldRoot.querySelector('[part="toolbar"] [aria-label="Link"]').click();
    window.muCompactControls = [
      target(host, 'link-apply', 'Apply link', 'link-tooltip'),
      target(host, 'link-cancel', 'Cancel', 'link-tooltip'),
    ];
  } else {
    const card = document.querySelector('mu-card');
    const nested = host.shadowRoot.querySelector('mu-card');
    window.muCompactControls = [
      target(card, 'toggle', 'Collapse Field guide to moss'),
      target(host, 'expand-all', 'Expand all'),
      target(host, 'collapse-all', 'Collapse all'),
      target(nested, 'toggle', 'Expand Rivers and deltas'),
    ];
  }
  window.muCompactEscapes = [];
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.muCompactEscapes.push(event.defaultPrevented);
  });
  return window.muCompactControls.map(({ name }) => name);
}

function compareDisplays(index) {
  const { element, button, area } = window.muCompactControls[index];
  // Escape closes the link editor, so open it again for the next control.
  if (area.hidden) element.shadowRoot.querySelector('[part="toolbar"] [aria-label="Link"]').click();
  const width = () => button.getBoundingClientRect().width;
  const icon = width();
  const before = element.getAttribute('control-display');
  element.setAttribute('control-display', 'text');
  const text = width();
  const label = button.textContent;
  if (before === null) element.removeAttribute('control-display');
  else element.setAttribute('control-display', before);
  // Put the focus before the control so Tab uses the normal keyboard order.
  const start = document.createElement('span');
  start.tabIndex = -1;
  start.style.position = 'absolute';
  button.before(start);
  start.focus({ preventScroll: true });
  area.scrollIntoView({ block: 'center', behavior: 'instant' });
  window.muCompactEscapes.length = 0;
  return { icon, text, label };
}

function controlState(index) {
  const { button, tooltip, element, area } = window.muCompactControls[index];
  const box = button.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const visible = tip.width > 0 && tip.height > 0 && getComputedStyle(tooltip).visibility === 'visible';
  const style = getComputedStyle(button);
  const forced = matchMedia('(forced-colors: active)').matches;
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const graphic = button.querySelector('svg');
  const noMotion = (node) => {
    const value = getComputedStyle(node);
    return value.animationName === 'none' && value.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
  };
  const root = element.shadowRoot;
  const content = root.querySelector('[part="input"], [part="list"], [part="body"]');
  const text = [...area.children].filter((node) => node !== tooltip.parentElement && node.getBoundingClientRect().height > 0);
  return {
    width: box.width, height: box.height,
    point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    tooltip: visible ? tooltip.textContent : '',
    tooltipFits: !visible || (text.every((node) => node.getBoundingClientRect().bottom <= tip.top)
      && (!content || !content.getClientRects().length || content.getBoundingClientRect().bottom <= tip.top
        || content.getBoundingClientRect().top >= tip.bottom)),
    tooltipColors: !visible || (getComputedStyle(tooltip).color === color(forced ? 'CanvasText' : 'var(--mu-color-text)')
      && getComputedStyle(tooltip).backgroundColor === color(forced ? 'Canvas' : 'var(--mu-color-surface)')),
    iconColor: graphic && getComputedStyle(graphic).stroke === style.color,
    noMotion: graphic && [button, graphic, tooltip].every(noMotion),
    focus: root.activeElement === button,
    ring: button.matches(':focus-visible') && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2
      && style.outlineColor === color(forced ? 'Highlight' : 'var(--mu-color-focus)'),
    escapes: window.muCompactEscapes,
    fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    areaHidden: area.hidden,
  };
}

export async function compactControlChecks(session, sessionId, base, modes, { open, evaluate, key, pageRules }, problems) {
  const steps = [];
  const send = (method, params = {}) => session.send(method, params, sessionId);
  const read = (fn, arg) => evaluate(session, sessionId, `(${fn})(${JSON.stringify(arg)})`);
  const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const press = (name, code) => key(session, sessionId, name, name, code);
  try {
    for (const width of [375, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 880, deviceScaleFactor: 1, mobile: false });
      for (const [mode, features] of Object.entries(modes)) {
        await send('Emulation.setEmulatedMedia', { features });
        const view = `${width} px, ${mode}`;
        for (const page of [LOANS_PAGE, RICH_TEXT_FIELD_PAGE]) {
          const check = (step, ok, detail) => steps.push({
            page, step: `${view}: ${step}`, ok: Boolean(ok), detail: JSON.stringify(detail),
          });
          try {
            await open(session, sessionId, base + '/' + page, problems);
            const names = await read(prepareControls, page === RICH_TEXT_FIELD_PAGE);
            steps.push(...await pageRules(session, sessionId, page + ' at ' + view));
            for (const [index, name] of names.entries()) {
              await move(0, 0);
              const widths = await read(compareDisplays, index);
              const idle = await read(controlState, index);
              check(name + ' has a fixed target that is narrower than the text button',
                idle.width === 44 && idle.height === 44 && widths.icon < widths.text && name.startsWith(widths.label)
                && widths.label.length > 0 && !idle.tooltip && idle.iconColor
                && (width !== 375 || idle.fits) && (mode !== 'reduced-motion' || idle.noMotion), { widths, idle });

              await move(idle.point.x, idle.point.y);
              const hover = await read(controlState, index);
              await press('Escape', 27);
              const dismissedHover = await read(controlState, index);
              check(name + ' shows its name on hover and closes it with Escape',
                hover.tooltip === name && !hover.focus && hover.tooltipFits && hover.tooltipColors
                && (width !== 375 || hover.fits) && !dismissedHover.tooltip && !dismissedHover.escapes.length,
              { hover, dismissedHover });

              await move(0, 0);
              await press('Tab', 9);
              const focus = await read(controlState, index);
              await press('Escape', 27);
              const dismissedFocus = await read(controlState, index);
              await press('Escape', 27);
              const secondEscape = await read(controlState, index);
              // In the link editor, the next Escape closes the editor. Elsewhere it reaches the page.
              const next = page === RICH_TEXT_FIELD_PAGE
                ? secondEscape.areaHidden && !secondEscape.escapes.length
                : secondEscape.escapes.length === 1 && secondEscape.escapes[0] === false;
              check(name + (page === RICH_TEXT_FIELD_PAGE ? ' shows its focus ring and lets the next Escape close the editor'
                : ' shows its focus ring and lets the next Escape reach the page'),
                focus.focus && focus.ring && focus.tooltip === name && focus.tooltipFits && focus.tooltipColors
                && (width !== 375 || focus.fits) && dismissedFocus.focus && !dismissedFocus.tooltip
                && !dismissedFocus.escapes.length && next,
              { focus, dismissedFocus, secondEscape });
            }
          } catch (error) {
            check('check the compact controls', false, String(error));
          }
        }
      }
    }
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setEmulatedMedia', { features: modes.light });
  }
  return steps;
}
