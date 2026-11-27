import { waitFor } from './wait.js';

const PAGE = 'examples/cards/service-status.html';

function view() {
  const root = document.querySelector('mu-service-status').shadowRoot;
  const rows = [...root.querySelectorAll('[part="service"]')];
  const box = (node) => node.getBoundingClientRect().toJSON();
  const trigger = rows[0].querySelector('button');
  const tip = root.getElementById(trigger.getAttribute('aria-describedby'));
  const tipBox = box(tip);
  const triggerBox = box(trigger);
  const focus = getComputedStyle(trigger);
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const viewport = document.documentElement;
  // The tooltip shows when it is not hidden and, in a browser with native popovers, when its popover is open.
  const shown = (panel) => !panel.hidden && (typeof panel.showPopover !== 'function' || panel.matches(':popover-open'));
  return {
    states: rows.map((row) => row.querySelector('[part="state"]').textContent),
    lines: new Set(rows.map((row) => box(row).top)).size,
    boxes: [...rows, document.querySelector('#next-check')].map(box),
    point: { x: triggerBox.x + triggerBox.width / 2, y: triggerBox.y + triggerBox.height / 2 },
    text: shown(tip) ? tip.textContent : '',
    expanded: rows.some((row) => row.querySelector('button')?.hasAttribute('aria-expanded')),
    focused: root.activeElement === trigger,
    ring: trigger.matches(':focus-visible') && focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2,
    fits: viewport.scrollWidth <= viewport.clientWidth && tipBox.left >= 0 && tipBox.top >= 0
      && tipBox.right <= viewport.clientWidth && tipBox.bottom <= viewport.clientHeight,
    forced: matchMedia('(forced-colors: active)').matches
      && rows.every((row) => {
        const state = getComputedStyle(row.querySelector('[part="state"]'));
        return state.color === color('CanvasText') && state.borderTopColor === color('CanvasText');
      })
      && getComputedStyle(tip).color === color('CanvasText') && getComputedStyle(tip).borderTopColor === color('CanvasText'),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches && [trigger, tip].every((node) => {
      const style = getComputedStyle(node);
      return style.animationName === 'none' && style.transitionDuration === '0s';
    }),
  };
}

// The rows of the strip by label: the details that show, and the center of each trigger.
function rows() {
  const root = document.querySelector('mu-service-status').shadowRoot;
  const shown = (panel) => panel && !panel.hidden && (typeof panel.showPopover !== 'function' || panel.matches(':popover-open'));
  const result = {};
  for (const row of root.querySelectorAll('[part="service"]')) {
    const summary = row.querySelector('.summary');
    const panel = row.querySelector('[part="metadata"]');
    const box = summary.getBoundingClientRect();
    result[row.querySelector('[part="label"]').textContent] = {
      text: shown(panel) ? panel.textContent : '', button: summary.localName === 'button',
      expanded: summary.hasAttribute('aria-expanded'), point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    };
  }
  const focused = root.activeElement;
  return {
    order: Object.keys(result), rows: result, open: Object.values(result).filter(({ text }) => text).length,
    focus: document.activeElement === root.host && focused ? focused.querySelector('[part="label"]')?.textContent ?? '' : '',
    focusButton: focused?.localName === 'button',
  };
}

async function fillChecks() {
  const host = document.createElement('mu-service-status');
  document.querySelector('main').append(host);
  const apply = (services) => { host.fill = { component: 'service-status', version: '0.1.0', data: { services } }; };
  const search = { label: 'Search', state: 'up', group: 'North' };
  const second = { label: 'Search', state: 'refused', group: 'South' };
  const store = { label: 'Store', state: 'unreachable' };
  apply([search, second, store]);
  const status = host.shadowRoot.querySelector('[role="status"]');
  const initial = status.textContent;
  const observer = new MutationObserver(() => {});
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  const updates = [];
  const record = () => {
    if (observer.takeRecords().length) updates.push(status.textContent);
  };
  apply([second, store, { ...search, checked: '09:30Z', reason: 'Ready' }]);
  record();
  const changed = [{ ...second, state: 'unreachable' }, { ...store, state: 'up' }, search];
  apply(changed);
  record();
  apply(changed);
  record();
  const markup = { group: '<b>North</b>', reason: '<img src=x onerror=alert(1)>', version: '<script>x</script>' };
  apply([...changed, { label: 'Queue', state: 'up', ...markup }]);
  record();
  const root = host.shadowRoot;
  const panel = [...root.querySelectorAll('[part="metadata"]')].at(-1);
  const safe = Object.values(markup).every((value) => panel.textContent.includes(value))
    && !panel.querySelector('b, img, script');
  const live = status.getAttribute('aria-live');
  const regions = root.querySelectorAll('[aria-live]').length;
  const kept = root.querySelector('[role="status"]') === status;
  apply([]);
  record();
  const empty = root.querySelector('[part="empty"]').textContent;
  apply([{ label: 'Search', state: 'unknown' }]);
  const refused = host.dataset.state;
  apply([search]);
  const restored = root.querySelector('[role="status"]').textContent;
  observer.disconnect();
  host.remove();
  return { live, regions, initial, kept, updates, safe, empty, refused, restored };
}

export async function serviceStatusChecks(session, id, base, modes, { open, evaluate, key, pageRules, axErrors }, problems) {
  const steps = [];
  const send = (method, params = {}) => session.send(method, params, id);
  const read = (fn) => evaluate(session, id, `(${fn})()`);
  const move = ({ x, y }) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  // A key with text, for example Enter with '\r', makes Chrome send the click of a button.
  const press = (name, code, text) => key(session, id, name, name, code, text);
  const sameBoxes = (a, b) => JSON.stringify(a.boxes) === JSON.stringify(b.boxes);
  let where = PAGE;
  const check = (step, ok, detail) => steps.push({ page: where, step, ok: Boolean(ok), detail: JSON.stringify(detail) });
  try {
    for (const width of [1280, 375]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 880, deviceScaleFactor: 1, mobile: false });
      for (const mode of ['light', 'forced-colors', 'reduced-motion']) {
        await send('Emulation.setEmulatedMedia', { features: modes[mode] });
        where = `${PAGE} at ${width} px, ${mode}`;
        await open(session, id, base + '/' + PAGE, problems);
        await move({ x: 0, y: 0 });
        const state = () => read(view);
        const readRows = () => read(rows);
        await waitFor(() => evaluate(session, id,
          'Boolean(document.querySelector("mu-service-status")?.shadowRoot?.querySelector("[part=trigger]"))'), Boolean);
        steps.push(...await pageRules(session, id, where));
        for (const item of await axErrors(session, id, [
          ['group', 'Service status'], ['button', 'Search Up'], ['button', 'Store Refused'], ['button', 'Queue Unreachable'],
        ], where)) check(`The accessibility tree has ${item.role} ${item.name}`, item.ok, item.name);
        const start = await state();
        check('The three states are visible as text and the list fits the width',
          start.states.join(', ') === 'Up, Refused, Unreachable' && start.fits
          && start.lines === (width === 375 ? 2 : 1), start);
        await move(start.point);
        const hover = await waitFor(state, (value) => value.text);
        check('Hover shows the check details and keeps the controls in place',
          hover.text.includes('Checked: 2026-11-27T09:30Z') && !hover.expanded && hover.fits && sameBoxes(start, hover)
          && (mode !== 'forced-colors' || hover.forced) && (mode !== 'reduced-motion' || hover.reduced), hover);
        await move({ x: 0, y: 0 });
        await waitFor(state, (value) => !value.text);
        // Focus the heading before the strip. A new node there changes the page gaps, so the boxes move.
        await evaluate(session, id, `(() => {
          const before = document.querySelector('mu-service-status').previousElementSibling;
          before.tabIndex = -1;
          before.focus({ preventScroll: true });
        })()`);
        await press('Tab', 9);
        const focus = await waitFor(state, (value) => value.focused && value.text);
        await press('Escape', 27);
        const escaped = await waitFor(state, (value) => !value.text);
        await press('Enter', 13, '\r');
        const reopened = await waitFor(state, (value) => value.text);
        check('Tab shows details, Escape hides them and Enter shows them again',
          focus.focused && focus.ring && focus.text === hover.text && focus.fits && sameBoxes(start, focus)
          && escaped.focused && !escaped.text && sameBoxes(start, escaped)
          && reopened.focused && reopened.text === hover.text && sameBoxes(start, reopened), { focus, escaped, reopened });

        // Hand-written from #197: a reorder during hover leaves the moved row fully shown or fully closed, and a
        // click on its trigger then shows its details.
        const strip = 'document.querySelector("mu-service-status")';
        await evaluate(session, id, `${strip}.shadowRoot.activeElement?.blur()`);
        await move({ x: 0, y: 0 });
        // The fill [Store, Search, Queue] keeps Store and Queue in place and moves the Search row.
        const before = await readRows();
        await move(before.rows.Search.point);
        const hovered = await waitFor(readRows, (value) => value.rows.Search.text);
        await evaluate(session, id, `(() => {
          const host = ${strip};
          const [search, store, queue] = host.fill.data.services;
          host.fill = { ...host.fill, data: { services: [store, search, queue] } };
        })()`);
        const moved = await readRows();
        await evaluate(session, id, `[...${strip}.shadowRoot.querySelectorAll('[part="service"] button')]
          .find((button) => button.querySelector('[part="label"]').textContent === 'Search').click()`);
        const clicked = await waitFor(readRows, (value) => value.rows.Search.text);
        check('A reorder during hover leaves the details shown or closed, and a click shows them again',
          hovered.rows.Search.text.includes('Checked: 2026-11-27T09:30Z')
          && moved.order.join(',') === 'Store,Search,Queue' && moved.open <= 1
          && (moved.rows.Search.text === '' || moved.rows.Search.text === hovered.rows.Search.text)
          && clicked.rows.Search.text === hovered.rows.Search.text && clicked.open === 1
          && Object.values(moved.rows).every(({ expanded }) => !expanded), { hovered, moved, clicked });

        // Hand-written from #197: if a fill makes the focused row again, the focus moves to the new row.
        await move({ x: 0, y: 0 });
        await evaluate(session, id, `${strip}.shadowRoot.querySelectorAll('[part="service"] button')[2].focus()`);
        const queueFocused = await waitFor(readRows, (value) => value.focus === 'Queue');
        const refill = (queue) => evaluate(session, id, `(() => {
          const host = ${strip};
          const [first, second] = host.fill.data.services;
          host.fill = { ...host.fill, data: { services: [first, second, ${JSON.stringify(queue)}] } };
        })()`);
        await refill({ label: 'Queue', state: 'unreachable' });
        const plain = await readRows();
        await refill({ label: 'Queue', state: 'unreachable', reason: 'No answer came back.' });
        const again = await waitFor(readRows, (value) => value.rows.Queue.text);
        check('The focus stays on a row that a fill makes again, and the new trigger shows its details',
          queueFocused.focus === 'Queue' && queueFocused.focusButton
          && plain.focus === 'Queue' && !plain.rows.Queue.button
          && again.focus === 'Queue' && again.focusButton && again.rows.Queue.text === 'Reason: No answer came back.',
          { queueFocused, plain, again });
      }
    }
    const result = await read(fillChecks);
    check('The same polite status announces each change once', result.live === 'polite' && result.kept
      && result.regions === 1 && result.initial === '' && result.updates.length === 1
      && result.updates[0] === 'Search (South): Unreachable. Store: Up.', result);
    check('Details stay text, and the component handles an empty list and a refused fill',
      result.safe && result.empty === 'No services. Check again later.' && result.refused === 'refused' && result.restored === '', result);
  } catch (error) {
    check('Read the service status strip', false, String(error));
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setEmulatedMedia', { features: modes.light });
  }
  return steps;
}
