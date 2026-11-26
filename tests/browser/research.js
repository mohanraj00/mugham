import { setTimeout as delay } from 'node:timers/promises';

export const RESEARCH_PAGE = 'examples/apps/research.html';

function readResearch() {
  const run = document.querySelector('mu-run-steps')?.shadowRoot;
  const plan = document.querySelector('mu-plan')?.shadowRoot;
  const part = (root, name) => root?.querySelector('[part="' + name + '"]');
  const states = (root) => Array.from(root?.querySelectorAll('[part="state"]') ?? [], (node) => node.textContent);
  const toggle = part(run, 'toggle');
  const panel = part(run, 'panel');
  const advance = document.querySelector('#advance-run');
  const forced = matchMedia('(forced-colors: active)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const color = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  const active = run?.activeElement ?? document.activeElement;
  const focus = getComputedStyle(active);
  const controlStyle = toggle && getComputedStyle(toggle);
  return {
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    forced,
    reduced,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    surface: controlStyle?.backgroundColor === color(forced ? 'ButtonFace' : 'var(--mu-color-surface)')
      && controlStyle?.color === color(forced ? 'ButtonText' : 'var(--mu-color-text)')
      && controlStyle?.borderTopColor === color(forced ? 'ButtonText' : 'var(--mu-color-border)'),
    noMotion: [toggle, advance].every((node) => node && getComputedStyle(node).transitionProperty === 'none'
      && getComputedStyle(node).animationName === 'none'),
    targets: [toggle, advance].every((node) => {
      const sizes = node?.getBoundingClientRect();
      return sizes?.width >= 44 && sizes?.height >= 44;
    }),
    focus: active === toggle ? 'toggle' : active === advance ? 'advance' : '',
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2
      && focus.outlineColor === color(forced ? 'Highlight' : 'var(--mu-color-focus)'),
    expanded: toggle?.getAttribute('aria-expanded'),
    panelVisible: Boolean(panel && !panel.hidden && panel.getClientRects().length),
    args: part(run, 'arguments')?.textContent,
    result: part(run, 'result')?.textContent,
    runStates: states(run),
    taskStates: states(plan),
    runLive: part(run, 'announcement')?.textContent,
    planLive: part(plan, 'announcement')?.textContent,
    sameToggle: toggle === window.researchToggle,
  };
}

export async function researchExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = () => page(`(${readResearch})()`);
  const press = async (name, code, number, text) => {
    await key(session, sessionId, name, code, number, text);
    if (name === 'Escape') {
      // Headless Chrome can hide the page shortly after Escape.
      await delay(150);
      await session.send('Page.bringToFront', {}, sessionId);
    }
  };
  const tab = () => press('Tab', 'Tab', 9);
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const space = () => press(' ', 'Space', 32, ' ');
  const waitFor = async (expression) => {
    const end = performance.now() + 5000;
    do {
      if (await page(expression)) return true;
      await delay(16);
    } while (performance.now() < end);
    return false;
  };
  const check = (view, step, ok, detail) => steps.push({
    page: RESEARCH_PAGE, step: view + ': ' + step, ok: Boolean(ok), detail: JSON.stringify(detail),
  });
  const ax = async () => {
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const exposed = nodes.filter((node) => !node.ignored);
    const has = (role, name) => exposed.some((node) => node.role?.value === role && node.name?.value === name);
    const toggle = exposed.find((node) => node.role?.value === 'button' && node.name?.value === 'Search the catalog');
    const items = exposed.filter((node) => node.role?.value === 'listitem');
    return {
      lists: has('list', 'Research run') && has('list', 'Research plan') && items.length >= 7,
      advance: has('button', 'Advance run'),
      pending: has('StaticText', 'Pending'),
      running: has('StaticText', 'Running') && has('StaticText', 'In progress'),
      expanded: toggle?.properties?.find(({ name }) => name === 'expanded')?.value?.value,
      result: has('StaticText', 'Moss on stone. Shelf B4.'),
    };
  };

  try {
    for (const width of [375, 1280]) {
      await session.send('Emulation.setDeviceMetricsOverride',
        { width, height: 812, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
      for (const [mode, features] of Object.entries(modes)) {
        const view = width + ' CSS pixels, ' + mode;
        try {
          await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
          await open(session, sessionId, `${base}/${RESEARCH_PAGE}?view=${width}-${mode}`, problems);
          const ready = await waitFor(`innerWidth === ${width} && document.querySelector("mu-run-steps")?.dataset.state === "default"
            && document.querySelector("mu-plan")?.dataset.state === "default" && document.querySelector(".examples-frame nav a")`);
          check(view, 'the research page is ready', ready, ready ? undefined : 'The page did not load within the wait limit.');
          if (!ready) continue;
          await page(`(() => {
            document.querySelector('#research-title').focus();
            window.researchToggle = document.querySelector('mu-run-steps').shadowRoot.querySelector('[part="toggle"]');
          })()`);
          await tab();
          const start = await read();
          const startAX = await ax();
          check(view, 'the views fit, use theme colors and have 44 by 44 CSS pixel controls',
            start.width === width && start.scroll <= width && start.targets && start.surface
            && start.forced === (mode === 'forced-colors') && (start.forced || start.dark === (mode === 'dark'))
            && start.reduced === (mode === 'reduced-motion') && (!start.reduced || start.noMotion), start);
          check(view, 'the first fill shows pending states and named lists with a closed disclosure',
            start.runStates.join() === 'Pending,Pending,Pending'
            && start.taskStates.join() === 'Pending,Pending,Pending,Pending'
            && start.runLive === '' && start.planLive === '' && !start.panelVisible
            && startAX.lists && startAX.advance && startAX.pending && startAX.expanded === false, { start, startAX });

          await enter();
          const opened = await read();
          const openAX = await ax();
          steps.push(...await pageRules(session, sessionId, RESEARCH_PAGE + ' with details open at ' + view));
          await press('Escape', 'Escape', 27);
          const escaped = await read();
          await space();
          const closed = await read();
          check(view, 'Tab focuses the disclosure, Enter opens it and Space closes it',
            start.focus === 'toggle' && start.ring && opened.expanded === 'true' && opened.panelVisible
            && opened.focus === 'toggle' && opened.ring && openAX.expanded === true && opened.args?.includes('moss')
            && escaped.expanded === 'true' && escaped.focus === 'toggle'
            && closed.expanded === 'false' && !closed.panelVisible && closed.focus === 'toggle' && closed.ring,
            { opened, openAX, escaped, closed });

          await space();
          // Advance in page code so the disclosure keeps keyboard focus during the fill.
          await page('document.querySelector("#advance-run").click()');
          const announced = await waitFor(`document.querySelector('mu-run-steps').shadowRoot
            .querySelector('[part="announcement"]').textContent.includes('Search the catalog: running')`);
          const running = await read();
          const runningAX = await ax();
          const quiet = await page(`(() => {
            const views = document.querySelectorAll('mu-run-steps, mu-plan');
            const notes = new MutationObserver(() => {});
            for (const view of views) {
              notes.observe(view.shadowRoot.querySelector('[part="announcement"]'), { childList: true, subtree: true });
              view.fill = view.fill;
            }
            const quiet = notes.takeRecords().length === 0;
            notes.disconnect();
            return quiet;
          })()`);
          check(view, 'a new fill updates the text once and keeps the open disclosure and focus',
            announced && quiet && running.runStates.join() === 'Done,Running,Pending'
            && running.taskStates.join() === 'Done,In progress,Pending,Pending' && runningAX.running
            && running.runLive === 'Read the request: done. Search the catalog: running'
            && running.planLive === 'Read the request: done. Find a book: in progress'
            && running.sameToggle && running.focus === 'toggle' && running.ring && running.panelVisible,
            { running, runningAX, quiet, reason: announced ? undefined : 'No state announcement within the wait limit.' });

          await tab();
          const advance = await read();
          await enter();
          const checked = await read();
          const resultAX = await ax();
          await space();
          const failed = await read();
          await enter();
          const done = await read();
          check(view, 'Tab reaches Advance run and its keys show the result and each later state',
            advance.focus === 'advance' && advance.ring && checked.focus === 'advance'
            && checked.runStates.join() === 'Done,Done,Running'
            && checked.taskStates.join() === 'Done,Done,In progress,Skipped'
            && checked.panelVisible && checked.scroll <= width && checked.result === 'Moss on stone. Shelf B4.'
            && resultAX.result && failed.runStates.at(-1) === 'Failed' && failed.taskStates[2] === 'Failed'
            && failed.runLive === 'Check availability: failed' && done.runStates.at(-1) === 'Done'
            && done.taskStates[2] === 'Done' && done.planLive === 'Check availability: done',
            { advance, checked, resultAX, failed, done });

          await page(`(() => {
            const run = document.querySelector('mu-run-steps');
            const fill = structuredClone(run.fill);
            fill.data.steps[1].tool_arguments = 'moss'.repeat(500);
            run.fill = fill;
          })()`);
          const longText = await read();
          check(view, 'long tool text wraps while the disclosure is open',
            longText.panelVisible && longText.scroll <= width && longText.args?.length === 2000,
            { panelVisible: longText.panelVisible, scroll: longText.scroll, length: longText.args?.length });
        } catch (error) {
          check(view, 'complete the research checks', false, String(error));
        }
      }
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Page.bringToFront', {}, sessionId);
  }
  return steps;
}
