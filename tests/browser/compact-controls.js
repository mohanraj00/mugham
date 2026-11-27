import { RICH_TEXT_FIELD_PAGE } from './rich-text-field.js';
import { waitFor } from './wait.js';

const LOANS_PAGE = 'examples/cards/loans.html';
const APPROVAL_PAGE = 'examples/cards/approval-icons.html';

const sameBoxes = (before, after) => JSON.stringify(before.boxes) === JSON.stringify(after.boxes);

function prepareApproval() {
  const card = document.querySelector('mu-card');
  const [approve, reject] = card.querySelectorAll('mu-action-button');
  const button = approve.shadowRoot.querySelector('[part="button"]');
  const tooltip = approve.shadowRoot.querySelector('[part="tooltip"]');
  window.muApprovalIcons = { button, tooltip, boxes: [
    reject.shadowRoot.querySelector('[part="button"]'), card.shadowRoot.querySelector('[part="card"]'),
  ] };
  const start = document.createElement('span');
  start.tabIndex = -1;
  start.style.position = 'absolute';
  button.before(start);
  start.focus({ preventScroll: true });
  button.scrollIntoView({ block: 'center', behavior: 'instant' });
}

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
      if (host?.shadowRoot?.querySelector('mu-card')) break;
    }
    if (performance.now() > deadline) throw new Error('The controls did not load.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (true);

  const target = (element, part, name, tooltipPart = 'tooltip') => {
    const root = element?.shadowRoot;
    const button = root?.querySelector(`[part="${part}"]`);
    const tooltip = root?.querySelector(`[part="${tooltipPart}"]`);
    if (!button || !tooltip) throw new Error(`The ${part} control or the ${tooltipPart} part did not load.`);
    const content = root.querySelector('[part="input"], [part="list"], [part="body"]');
    const next = button.nextElementSibling;
    return { element, button, name, tooltip, area: button.parentElement,
      boxes: [next?.matches('button') ? next : null, content].filter(Boolean) };
  };
  if (note) {
    const link = fieldRoot.querySelector('[part="toolbar"] [aria-label="Link"]');
    if (!link) throw new Error('The Link button did not load.');
    link.click();
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

function tooltipState(index) {
  const { button, tooltip, boxes } = index === null ? window.muApprovalIcons : window.muCompactControls[index];
  const box = button.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const viewport = document.documentElement;
  const visible = tip.width > 0 && tip.height > 0 && getComputedStyle(tooltip).visibility === 'visible';
  return {
    width: box.width, height: box.height,
    point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    focus: button.getRootNode().activeElement === button,
    tooltip: visible ? tooltip.textContent : '',
    tooltipPoint: { x: tip.x + tip.width / 2, y: tip.y + tip.height / 2 },
    tooltipFits: visible && tip.left >= 8 && tip.right <= viewport.clientWidth - 8
      && tip.top >= 8 && tip.bottom <= viewport.clientHeight - 8 && (tip.top >= box.bottom || tip.bottom <= box.top + 1),
    tooltipHovered: tooltip.matches(':hover'),
    boxes: boxes.map((node) => node.getBoundingClientRect().toJSON()),
  };
}

function controlState(state, index) {
  const { button, tooltip, area } = window.muCompactControls[index];
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
  return {
    ...state,
    tooltipColors: !state.tooltip || (getComputedStyle(tooltip).color === color(forced ? 'CanvasText' : 'var(--mu-color-text)')
      && getComputedStyle(tooltip).backgroundColor === color(forced ? 'Canvas' : 'var(--mu-color-surface)')
      && getComputedStyle(tooltip).borderTopColor === color(forced ? 'CanvasText' : 'var(--mu-color-border)')
      && getComputedStyle(tooltip).borderTopStyle === 'solid'),
    iconColor: graphic && getComputedStyle(graphic).stroke === style.color,
    noMotion: graphic && [button, graphic, tooltip].every(noMotion),
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
  const check = (page, view, step, ok, detail) => steps.push({
    page, step: `${view}: ${step}`, ok: Boolean(ok), detail: JSON.stringify(detail),
  });
  try {
    for (const width of [375, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 880, deviceScaleFactor: 1, mobile: false });
      for (const [mode, features] of Object.entries(modes)) {
        await send('Emulation.setEmulatedMedia', { features });
        const view = `${width} px, ${mode}`;
        if (mode === 'light') {
          const report = (step, ok, detail) => check(APPROVAL_PAGE, view, step, ok, detail);
          try {
            await open(session, sessionId, base + '/' + APPROVAL_PAGE, problems);
            await move(0, 0);
            await read(prepareApproval);
            const state = () => read(tooltipState, null);
            const idle = await waitFor(state, (value) => !value.tooltip);
            const name = 'Approve request 42';
            await move(idle.point.x, idle.point.y);
            const hover = await waitFor(state, (value) => value.tooltip === name);
            await move(0, 0);
            const away = await waitFor(state, (value) => !value.tooltip);
            report('the hover tooltip keeps the Reject button and the card in place',
              !idle.tooltip && hover.tooltip === name && hover.tooltipFits && !away.tooltip
              && sameBoxes(idle, hover) && sameBoxes(idle, away), { idle, hover, away });

            await press('Tab', 9);
            const focus = await waitFor(state, (value) => value.focus && value.tooltip === name);
            await press('Escape', 27);
            const dismissed = await waitFor(state, (value) => value.focus && !value.tooltip);
            report('the focus tooltip keeps the Reject button and the card in place',
              focus.focus && focus.tooltip === name && focus.tooltipFits && dismissed.focus && !dismissed.tooltip
              && sameBoxes(idle, focus) && sameBoxes(idle, dismissed), { idle, focus, dismissed });

            await evaluate(session, sessionId, `window.muApprovalIcons.button.parentElement.style.overflow = 'auto'`);
            await move(dismissed.point.x, dismissed.point.y);
            const outside = await waitFor(state, (value) => value.tooltip === name);
            if (outside.tooltip) await move(outside.tooltipPoint.x, outside.tooltipPoint.y);
            const overText = await waitFor(state, (value) => value.tooltipHovered);
            report('a scroll container does not clip the tooltip',
              outside.tooltipFits && overText.tooltipHovered && overText.tooltip === name, { outside, overText });
          } catch (error) {
            report('check the approval icons', false, String(error));
          }
        }
        for (const page of [LOANS_PAGE, RICH_TEXT_FIELD_PAGE]) {
          const report = (step, ok, detail) => check(page, view, step, ok, detail);
          try {
            await open(session, sessionId, base + '/' + page, problems);
            const names = await read(prepareControls, page === RICH_TEXT_FIELD_PAGE);
            steps.push(...await pageRules(session, sessionId, page + ' at ' + view));
            for (const [index, name] of names.entries()) {
              const state = () => evaluate(session, sessionId, `(${controlState})((${tooltipState})(${index}), ${index})`);
              await move(0, 0);
              const widths = await read(compareDisplays, index);
              const idle = await waitFor(state, (value) => !value.tooltip);
              report(name + ' has a fixed target that is narrower than the text button',
                idle.width === 44 && idle.height === 44 && widths.icon < widths.text && name.startsWith(widths.label)
                && widths.label.length > 0 && !idle.tooltip && idle.iconColor
                && (width !== 375 || idle.fits) && (mode !== 'reduced-motion' || idle.noMotion), { widths, idle });

              await move(idle.point.x, idle.point.y);
              const hover = await waitFor(state, (value) => value.tooltip === name);
              if (name === 'Expand all') {
                await move(hover.tooltipPoint.x, hover.tooltipPoint.y);
                const overText = await waitFor(state, (value) => value.tooltipHovered);
                report('the pointer can move from Expand all to its tooltip',
                  overText.tooltipHovered && overText.tooltip === name, overText);
              }
              await press('Escape', 27);
              const dismissedHover = await waitFor(state, (value) => !value.tooltip);
              report(name + ' shows its name on hover and closes it with Escape',
                hover.tooltip === name && !hover.focus && hover.tooltipFits && hover.tooltipColors
                && (width !== 375 || hover.fits) && !dismissedHover.tooltip && !dismissedHover.escapes.length
                && sameBoxes(idle, hover) && sameBoxes(idle, dismissedHover), { idle, hover, dismissedHover });

              await move(0, 0);
              await press('Tab', 9);
              const focus = await waitFor(state, (value) => value.focus && value.ring && value.tooltip === name);
              await press('Escape', 27);
              const dismissedFocus = await waitFor(state, (value) => value.focus && !value.tooltip);
              await press('Escape', 27);
              const secondEscape = await state();
              // In the link editor, the next Escape closes the editor. Elsewhere it reaches the page.
              const next = page === RICH_TEXT_FIELD_PAGE
                ? secondEscape.areaHidden && !secondEscape.escapes.length
                : secondEscape.escapes.length === 1 && secondEscape.escapes[0] === false;
              report(name + (page === RICH_TEXT_FIELD_PAGE ? ' shows its focus ring and lets the next Escape close the editor'
                : ' shows its focus ring and lets the next Escape reach the page'),
                focus.focus && focus.ring && focus.tooltip === name && focus.tooltipFits && focus.tooltipColors
                && (width !== 375 || focus.fits) && dismissedFocus.focus && !dismissedFocus.tooltip
                && !dismissedFocus.escapes.length && next && sameBoxes(idle, focus) && sameBoxes(idle, dismissedFocus),
              { idle, focus, dismissedFocus, secondEscape });
            }
          } catch (error) {
            report('check the compact controls', false, String(error));
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
