import { waitFor } from './wait.js';

export const RUN_STEPS_PAGE = 'examples/thread/run-steps.html';

function readRun() {
  const root = document.querySelector('mu-thread')?.shadowRoot?.querySelector('mu-run-steps')?.shadowRoot;
  const rows = [...(root?.querySelectorAll('[part="step"]') ?? [])];
  return {
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    frame: Boolean(document.querySelector('.examples-frame')),
    rows: rows.map((row) => [row.querySelector('[part="name"]').textContent, row.querySelector('[part="state"]').textContent]),
    toolOpen: rows[1]?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded'),
    toolArgs: root?.querySelector('[part="arguments"]')?.textContent,
    toolResult: root?.querySelector('[part="result"]')?.textContent,
    resultElements: root?.querySelector('[part="result"]')?.childElementCount,
    failure: root?.querySelector('[part="detail"]')?.textContent,
  };
}

export async function runStepsExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const expected = [['Check the trays', 'Done'], ['Count seedlings', 'Done'], ['Write the report', 'Failed']];
  const page = (code) => evaluate(session, sessionId, code);
  const read = () => page(`(${readRun})()`);
  try {
    for (const width of [375, 1280]) {
      await session.send('Emulation.setDeviceMetricsOverride',
        { width, height: 812, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
      for (const mode of ['light', 'dark']) {
        const view = `${RUN_STEPS_PAGE} at ${width} CSS pixels in ${mode} mode`;
        await session.send('Emulation.setEmulatedMedia', { features: modes[mode] }, sessionId);
        await open(session, sessionId, `${base}/${RUN_STEPS_PAGE}?view=${width}-${mode}`, problems);
        const ready = (value) => value.width === width && value.dark === (mode === 'dark') && value.frame && value.rows.length === 3;
        const found = await waitFor(read, ready);
        steps.push({ page: view, step: 'show the mapped rows and fit the viewport',
          ok: ready(found) && found.scroll <= width && JSON.stringify(found.rows) === JSON.stringify(expected)
            && found.failure === 'The run ended before this step finished.' && found.toolOpen === 'false', detail: JSON.stringify(found) });
        if (!ready(found)) continue;
        for (const name of await axErrors(session, sessionId, [['list', 'Tray check'], ['button', 'Count seedlings']], view)) {
          steps.push({ page: view, step: `show ${name.role} named ${name.name}`, ok: name.ok });
        }
        await page(`document.querySelector('mu-thread').shadowRoot.querySelector('mu-run-steps').shadowRoot
          .querySelector('[part="toggle"]').focus()`);
        await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
        const opened = await waitFor(read, (value) => value.toolOpen === 'true');
        steps.push({ page: view, step: 'Enter opens the tool details and shows plain text',
          ok: opened.toolOpen === 'true' && opened.toolArgs === '{"tray":"A1"}'
            && opened.toolResult === '<tray>A1 has 12 seedlings.</tray>' && opened.resultElements === 0, detail: JSON.stringify(opened) });
        steps.push(...await pageRules(session, sessionId, view));
      }
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
  }
  return steps;
}
