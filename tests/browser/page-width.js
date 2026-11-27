import { waitFor } from './wait.js';

const PAGE = 'tests/browser/page-width.html';

// The state of the page that the checks read. Each value comes from the layout of the page.
function view() {
  const $ = (id) => document.getElementById(id);
  const box = (node) => node.getBoundingClientRect().toJSON();
  const root = document.documentElement;
  const scroller = $('box');
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const ring = getComputedStyle(scroller);
  const cell = getComputedStyle(document.querySelector('#table td'));
  return {
    page: { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth },
    table: { width: box($('table')).width, display: getComputedStyle($('table')).display },
    scroller: { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth, scrollLeft: scroller.scrollLeft },
    token: { scrollWidth: $('token').scrollWidth, clientWidth: $('token').clientWidth },
    heading: getComputedStyle($('heading')).overflowWrap,
    code: { wrap: getComputedStyle($('code')).overflowWrap, scrolls: $('code').scrollWidth > $('code').clientWidth },
    boxes: ['token', 'before', 'box', 'code', 'after'].map((id) => box($(id))),
    point: (({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 }))(box(scroller)),
    focused: document.activeElement === scroller,
    ring: scroller.matches(':focus-visible') && ring.outlineStyle === 'solid' && parseFloat(ring.outlineWidth) >= 2,
    forced: matchMedia('(forced-colors: active)').matches
      && cell.borderBottomColor === color('CanvasText') && ring.outlineColor === color('Highlight'),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
      && [scroller, document.body].every((node) => getComputedStyle(node).transitionDuration === '0s'),
  };
}

export async function pageWidthChecks(session, id, base, modes, { open, evaluate, key, pageRules, axErrors }, problems) {
  const steps = [];
  const send = (method, params = {}) => session.send(method, params, id);
  const read = () => evaluate(session, id, `(${view})()`);
  const move = ({ x, y }) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const press = (name, code) => key(session, id, name, name, code);
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
        steps.push(...await pageRules(session, id, where));
        // Hand-written from the markup: the table keeps its role, its name from the caption and its header cells.
        for (const item of await axErrors(session, id, [
          ['region', 'Sample table'], ['table', 'Synthetic samples'], ['columnheader', 'Sample'], ['columnheader', 'Digest'],
          ['columnheader', 'Publications'], ['cell', 'sample-field-guide'], ['cell', 'sample-site-notes'],
        ], where)) check(`The accessibility tree has ${item.role} ${item.name}`, item.ok, item.name);
        const start = await read();
        check('The page is not wider than the viewport', start.page.scrollWidth <= start.page.clientWidth, start.page);
        check('The table keeps its table display', start.table.display === 'table', start.table);
        check('The long token breaks inside its paragraph', start.token.scrollWidth <= start.token.clientWidth, start.token);
        check('The heading keeps its words, and the code block scrolls in place',
          start.heading === 'normal' && start.code.wrap === 'normal' && (width !== 375 || start.code.scrolls), start);
        if (width === 375) {
          check('The wide table scrolls in its own box', start.table.width > 343
            && start.scroller.scrollWidth > start.scroller.clientWidth, { table: start.table, scroller: start.scroller });
        }
        await move(start.point);
        const hover = await read();
        check('Hover on the box keeps each block in place', sameBoxes(start, hover), hover.boxes);
        await move({ x: 0, y: 0 });
        await evaluate(session, id, 'document.getElementById("before").focus({ preventScroll: true })');
        await press('Tab', 9);
        const focus = await waitFor(read, (value) => value.focused);
        check('Tab moves the focus to the box with a visible ring, and no block moves',
          focus.focused && focus.ring && sameBoxes(start, focus)
          && (mode !== 'forced-colors' || focus.forced) && (mode !== 'reduced-motion' || focus.reduced), focus);
        if (width === 375) {
          // The headless run does not animate a key scroll, so the check scrolls the focused box directly. A person
          // scrolls it with the arrow keys, as the theme guide says.
          await evaluate(session, id, 'document.getElementById("box").scrollLeft = 40');
          const scrolled = await read();
          check('The focused box is a scroll container, and the page does not scroll to the side',
            scrolled.focused && scrolled.scroller.scrollLeft === 40 && scrolled.page.scrollWidth <= scrolled.page.clientWidth,
            { focused: scrolled.focused, scroller: scrolled.scroller, page: scrolled.page });
        }
      }
    }
  } catch (error) {
    check('Read the page width checks', false, String(error));
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setEmulatedMedia', { features: modes.light });
  }
  return steps;
}
