// The browser check of examples/apps/services.html (#189). Expected results:
// - Each service region is a landmark with the accessible name of its service.
// - Each region reads only from its own fixture API, and shows the data of that API as text.
// - At 1280 px the regions show side by side. At 375 px each region uses the full width, and the page has no
//   horizontal scroll.
// - Hover and keyboard focus do not move the regions. The keyboard order goes through the regions in page order,
//   and each focused control shows a focus ring.
// - In forced colors, each region border uses CanvasText. With reduced motion, the page runs no animation.
// - An action of one region goes only to the API of that region. The action shows pending, then done only after
//   the receipt. A refusal shows the service name and the code of the service.
import { waitFor } from './wait.js';

const PAGE = 'examples/apps/services.html';
const REGIONS = ['catalog', 'loans', 'notices'];
const BASES = {
  catalog: 'https://catalog.example.test/api/', loans: 'https://loans.example.test/v2/', notices: 'https://notices.example.test/',
};
const READS = [BASES.catalog + 'trays', BASES.catalog + 'tools', BASES.loans + 'loans', BASES.notices + 'notices'];
const LINES = {
  catalog: 'Tray T-11: bean seeds|Tray T-12: pea seeds|Hand trowel H-3|Seed tray rack R-1',
  loans: 'Loan L-7: A guide to rain gardens, due 2026-12-04',
  notices: 'Pickup notice N-4 for Tray T-11',
};

function view() {
  // The box in page coordinates, so that a scroll to a focused control does not change it.
  const box = (node) => {
    const { left, top, width, height } = node.getBoundingClientRect();
    return { left: left + scrollX, top: top + scrollY, width, height, bottom: top + scrollY + height };
  };
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const host = (node) => {
    let current = node;
    while (current && !current.closest?.('.region')) current = current.getRootNode().host;
    return current?.closest('.region')?.id ?? '';
  };
  const ring = active ? getComputedStyle(active) : null;
  const regions = [...document.querySelectorAll('.region')];
  const viewport = document.documentElement;
  return {
    ids: regions.map((region) => region.id),
    boxes: regions.map(box),
    lines: Object.fromEntries(regions.map((region) => [region.id,
      [...region.querySelectorAll('li')].map((item) => item.textContent).join('|')])),
    markup: regions.some((region) => region.querySelector('li *')),
    buttons: regions.map((region) => region.querySelector('mu-action-button')?.dataset.state),
    requests: [...window.serviceRequests],
    fits: viewport.scrollWidth <= viewport.clientWidth,
    region: host(active),
    tag: active?.tagName.toLowerCase() ?? '',
    ring: Boolean(ring) && active.matches(':focus-visible') && ring.outlineStyle !== 'none' && parseFloat(ring.outlineWidth) >= 2,
    forced: matchMedia('(forced-colors: active)').matches
      && regions.every((region) => getComputedStyle(region).borderTopColor === color('CanvasText')),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches && document.getAnimations().length === 0,
  };
}

// The click and the first read run in one task, before the receipt of the fixture API can come back.
function press(id) {
  const button = document.getElementById(id).querySelector('mu-action-button');
  window.serviceRequests.length = 0;
  button.shadowRoot.querySelector('[part="button"]').click();
  return button.dataset.state;
}

function outcome(id) {
  const button = document.getElementById(id).querySelector('mu-action-button');
  return { state: button.dataset.state, status: button.shadowRoot.querySelector('[role="status"]').textContent,
    markup: Boolean(button.shadowRoot.querySelector('[role="status"] *')), requests: [...window.serviceRequests] };
}

export async function servicesExampleChecks(session, id, base, modes, { open, evaluate, key, pageRules, axErrors }, problems) {
  const steps = [];
  const send = (method, params = {}) => session.send(method, params, id);
  const read = (fn, arg) => evaluate(session, id, `(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})`);
  const state = () => read(view);
  const move = ({ x, y }) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const sameBoxes = (a, b) => JSON.stringify(a.boxes) === JSON.stringify(b.boxes);
  let where = PAGE;
  const check = (step, ok, detail) => steps.push({ page: where, step, ok: Boolean(ok), detail: JSON.stringify(detail) });
  try {
    for (const width of [1280, 375]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const mode of ['light', 'forced-colors', 'reduced-motion']) {
        await send('Emulation.setEmulatedMedia', { features: modes[mode] });
        where = `${PAGE} at ${width} px, ${mode}`;
        await open(session, id, base + '/' + PAGE, problems);
        await move({ x: 0, y: 0 });
        const start = await waitFor(state, (value) => value.requests.length === READS.length
          && REGIONS.every((region) => value.lines[region]), { retries: 80 });
        steps.push(...await pageRules(session, id, where));
        for (const item of await axErrors(session, id, [
          ['region', 'Catalog service'], ['region', 'Loans service'], ['region', 'Notices service'],
          ['group', 'Service regions'], ['tablist', 'Catalog views'], ['tab', 'Seed trays'], ['list', 'Current loans'],
          ['button', 'Reserve tray T-12'], ['button', 'Renew loan L-7'], ['button', 'Send the pickup reminder'], ['main', ''],
          // At 375 px the side links are in a drawer that the Menu button opens.
          ...(width === 1280 ? [['navigation', 'Services'], ['link', 'Loans service']] : [['button', 'Menu']]),
        ], where)) check(`The accessibility tree has ${item.role} ${item.name}`, item.ok, item.name);
        check('Each region reads only from its own fixture API and shows the data as text',
          JSON.stringify(start.requests) === JSON.stringify(READS) && !start.markup
          && REGIONS.every((region) => start.lines[region] === LINES[region]), start);
        const lefts = new Set(start.boxes.map((item) => Math.round(item.left))).size;
        const wide = start.boxes.every((item) => Math.round(item.width) === Math.round(start.boxes[0].width));
        check(width === 1280 ? 'The regions show side by side' : 'Each region uses the full width, one below the other',
          start.fits && (width === 1280 ? lefts === 3 : lefts === 1 && wide
            && start.boxes.every((item, index) => index === 0 || item.top >= start.boxes[index - 1].bottom)), start.boxes);
        const button = await evaluate(session, id, `(() => {
          const node = document.querySelector('#loans mu-action-button').getBoundingClientRect();
          return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
        })()`);
        await move(button);
        const hover = await state();
        check('Hover keeps the regions in place', hover.fits && sameBoxes(start, hover)
          && (mode !== 'forced-colors' || hover.forced) && (mode !== 'reduced-motion' || hover.reduced), hover);
        await move({ x: 0, y: 0 });
        // Focus the page heading, then go through the regions with Tab.
        await evaluate(session, id, `(() => {
          const heading = document.querySelector('h1');
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        })()`);
        const order = [];
        let ringed = true;
        const misses = [];
        for (let i = 0; i < 12; i += 1) {
          await key(session, id, 'Tab', 'Tab', 9);
          const focus = await state();
          if (!focus.region) break;
          if (order.at(-1) !== focus.region) order.push(focus.region);
          if (!focus.ring || !sameBoxes(start, focus)) ringed = false;
          if (!ringed) misses.push(focus);
        }
        check('Tab goes through the regions in page order, with a focus ring, and the regions stay in place',
          JSON.stringify(order) === JSON.stringify(REGIONS) && ringed, { order, ringed, miss: misses[0] });
      }
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: modes.light });
    where = `${PAGE} actions`;
    await open(session, id, base + '/' + PAGE, problems);
    await waitFor(state, (value) => value.requests.length === READS.length, { retries: 80 });
    const expected = {
      catalog: ['done', 'Done: Tray T-12 is reserved.', BASES.catalog + 'trays.reserve'],
      loans: ['error', 'Not done: The loan has two renewals. Service: Loans service. Code: renewal-limit.', BASES.loans + 'loans.renew'],
      notices: ['done', 'Done: The reminder is sent.', BASES.notices + 'notices.send'],
    };
    for (const [region, [final, status, url]] of Object.entries(expected)) {
      const first = await read(press, region);
      const result = await waitFor(() => read(outcome, region), (value) => value.state !== 'pending', { retries: 80 });
      check(`The ${region} action goes only to its own API and shows the receipt of that API`, first === 'pending'
        && result.state === final && result.status === status && !result.markup
        && JSON.stringify(result.requests) === JSON.stringify([url]), { first, result });
    }
  } catch (error) {
    check('Read the service regions', false, String(error));
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setEmulatedMedia', { features: modes.light });
  }
  return steps;
}
