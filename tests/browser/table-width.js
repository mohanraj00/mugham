import { waitFor } from './wait.js';

const PAGE = 'tests/browser/table-width.html';
// Hand-written from issue 193: the synthetic table has 9 columns, and each column keeps a minimum width.
const COLUMNS = ['Area', 'Name', 'Phase', 'Kind', 'Budget', 'Spend', 'Left', 'Start', 'End'];

// The state of the page that the checks read. Each value comes from the layout of the page.
function view() {
  const table = document.querySelector('mu-table');
  const root = table.shadowRoot;
  const area = root.querySelector('[role="group"]');
  const box = (node) => node.getBoundingClientRect().toJSON();
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const probe = document.createElement('div');
  probe.style.inlineSize = 'calc(var(--mu-size-column-narrow) / 2)';
  document.body.append(probe);
  const minimum = probe.getBoundingClientRect().width;
  probe.remove();
  const heads = [...root.querySelectorAll('thead th')];
  const first = [...root.querySelectorAll('tbody tr:first-child td')];
  // Each text node of a cell gives the rectangles of its lines. One line has one top.
  const lines = (node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let most = 0;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.data.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      most = Math.max(most, new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size);
    }
    return most;
  };
  const ring = getComputedStyle(area);
  const cell = getComputedStyle(first[0]);
  return {
    page: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    area: { scrollWidth: area.scrollWidth, clientWidth: area.clientWidth, scrollLeft: area.scrollLeft },
    minimum,
    widths: heads.map((th) => box(th).width),
    aligned: heads.length === first.length && heads.every((th, index) => {
      const [a, b] = [box(th), box(first[index])];
      return Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1;
    }),
    oneLine: [...heads, ...first].every((node) => lines(node) === 1),
    boxes: [document.getElementById('before'), table, document.getElementById('after')].map(box)
      .concat(heads.map(box)),
    point: (({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 }))(box(area)),
    focused: document.activeElement === table && root.activeElement === area,
    ring: area.matches(':focus-visible') && ring.outlineStyle === 'solid' && parseFloat(ring.outlineWidth) >= 2,
    forced: matchMedia('(forced-colors: active)').matches
      && cell.borderBottomColor === color('CanvasText') && ring.outlineColor === color('Highlight'),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
      && [area, first[0]].every((node) => getComputedStyle(node).transitionDuration === '0s'),
  };
}

export async function tableWidthChecks(session, id, base, modes, { open, evaluate, key, pageRules, axErrors }, problems) {
  const steps = [];
  const send = (method, params = {}) => session.send(method, params, id);
  const read = () => evaluate(session, id, `(${view})()`);
  const move = ({ x, y }) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const same = (a, b) => JSON.stringify(a.boxes) === JSON.stringify(b.boxes);
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
        for (const item of await axErrors(session, id, [
          ['group', 'Synthetic runs'], ['table', 'Synthetic runs'], ...COLUMNS.map((name) => ['columnheader', name]),
        ], where)) check(`The accessibility tree has ${item.role} ${item.name}`, item.ok, item.name);
        const start = await waitFor(read, (value) => value.widths.length === COLUMNS.length);
        check('The page is not wider than the viewport', start.page.scrollWidth <= start.page.clientWidth, start.page);
        check('Each of the 9 columns has at least the minimum width', start.minimum > 0
          && start.widths.length === COLUMNS.length && start.widths.every((value) => value >= start.minimum - 0.5),
        { minimum: start.minimum, widths: start.widths });
        check('Each header cell is above its body cell', start.aligned, start.widths);
        check('Short cell text stays on one line', start.oneLine, start.widths);
        if (width === 375) {
          check('The table scrolls in its own area', start.area.scrollWidth > start.area.clientWidth, start.area);
        }
        await move(start.point);
        const hover = await read();
        check('Hover on the table keeps each box in place', same(start, hover), hover.boxes);
        await move({ x: 0, y: 0 });
        await evaluate(session, id, 'document.getElementById("before").focus({ preventScroll: true })');
        await key(session, id, 'Tab', 'Tab', 9);
        const focus = await waitFor(read, (value) => value.focused);
        check('Tab moves the focus to the table area with a visible ring, and no box moves',
          focus.focused && focus.ring && same(start, focus)
          && (mode !== 'forced-colors' || focus.forced) && (mode !== 'reduced-motion' || focus.reduced), focus);
        if (width === 375) {
          // The headless run does not animate a key scroll, so the check scrolls the focused area directly.
          await evaluate(session, id, 'document.querySelector("mu-table").shadowRoot.querySelector("[role=group]").scrollLeft = 40');
          const scrolled = await read();
          check('The focused area scrolls, and the page does not scroll to the side',
            scrolled.focused && scrolled.area.scrollLeft === 40 && scrolled.page.scrollWidth <= scrolled.page.clientWidth,
            { area: scrolled.area, page: scrolled.page });
        }
      }
    }
  } catch (error) {
    check('Read the table width checks', false, String(error));
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setEmulatedMedia', { features: modes.light });
  }
  return steps;
}
