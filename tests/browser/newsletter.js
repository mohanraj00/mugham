export const NEWSLETTER_PAGE = 'examples/apps/newsletter.html';

const STATES = ['Approved', 'Pending approval', 'Rejected'];
const DETAILS = [
  'by Branch reviewer A at 2026-11-26T10:00:00Z',
  'by Branch reviewer B at 2026-11-26T10:10:00Z',
  'by Branch reviewer C at 2026-11-26T10:20:00Z',
];

function readNewsletter() {
  const root = document.querySelector('mu-rich-text').shadowRoot;
  const marks = [...root.querySelectorAll('[part="approval-mark"]')];
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
  const tones = [
    ['var(--mu-color-on-success)', 'var(--mu-color-success)', 'var(--mu-color-on-success)'],
    ['var(--mu-color-on-warning)', 'var(--mu-color-warning)', 'var(--mu-color-on-warning)'],
    ['var(--mu-color-text)', 'var(--mu-color-surface)', 'var(--mu-color-danger)'],
  ];
  return {
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    forced,
    reduced,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    marks: marks.map((mark) => ({
      text: mark.firstElementChild.textContent,
      details: mark.lastElementChild.textContent.trim(),
      name: mark.getAttribute('aria-label'),
      visible: Boolean(mark.getBoundingClientRect().height),
    })),
    colors: marks.every((mark, index) => {
      const style = getComputedStyle(mark.firstElementChild);
      const [text, background, border] = forced ? ['CanvasText', 'Canvas', 'CanvasText'] : tones[index];
      return style.color === color(text) && style.backgroundColor === color(background)
        && style.borderTopColor === color(border) && style.borderTopStyle === 'solid';
    }),
    noMotion: marks.every((mark) => [mark, ...mark.children].every((element) => {
      const style = getComputedStyle(element);
      return style.animationName === 'none' && style.transitionDuration.split(',').every((duration) => parseFloat(duration) === 0);
    })),
  };
}

function fillAgain() {
  const view = document.querySelector('mu-rich-text');
  const revision = view.fillRevision;
  const fill = structuredClone(view.fill);
  fill.data.blocks[1].data.content[0].data.text = 'The reading group meets in Room C on Tuesday.';
  view.fill = fill;
  return revision;
}

function applyLateApprovals(revision) {
  const view = document.querySelector('mu-rich-text');
  let errors = [];
  view.addEventListener('mu-refused', (event) => { errors = event.detail.errors; }, { once: true });
  view.setApprovals([{ block: 1, state: 'approved' }], revision);
  return {
    count: view.shadowRoot.querySelectorAll('[part="approval-mark"]').length,
    revision: view.fillRevision,
    errors,
  };
}

function updateApprovals() {
  const view = document.querySelector('mu-rich-text');
  view.setApprovals([{ block: 0, state: 'approved' }, { block: 2, state: 'rejected' }], view.fillRevision);
  const blocks = view.shadowRoot.querySelector('[part="rich-text"]');
  const second = blocks.querySelectorAll(':scope > p:not([part])')[1];
  return {
    count: blocks.querySelectorAll('[part="approval-mark"]').length,
    second: second.textContent,
    unmarked: !second.previousElementSibling.matches('[part="approval-mark"]'),
  };
}

async function withTimeLimit(run, message, limit = 20000) {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), limit);
    });
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function newsletterExampleChecks(session, sessionId, base, modes, { evaluate, open, pageRules }, problems) {
  const steps = [];
  const check = (view, step, ok, reason, result) => steps.push({
    page: NEWSLETTER_PAGE, step: view + ': ' + step, ok: Boolean(ok),
    detail: JSON.stringify(ok ? result ?? {} : { reason, result }),
  });
  const page = (expression) => evaluate(session, sessionId, expression);
  const send = (method, params = {}) => withTimeLimit(() => session.send(method, params, sessionId),
    'No answer for ' + method + ' within the wait limit.');
  const ax = async () => {
    const { nodes } = await send('Accessibility.getFullAXTree');
    return nodes.filter((node) => !node.ignored);
  };
  const has = (nodes, role, name) => nodes.some((node) => node.role?.value === role && node.name?.value === name);

  try {
    for (const width of [375, 1280]) {
      for (const [mode, features] of Object.entries(modes)) {
        const view = width + ' CSS pixels, ' + mode;
        try {
          await send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: width === 375 });
          await send('Emulation.setEmulatedMedia', { features });
          await withTimeLimit(() => open(session, sessionId, `${base}/${NEWSLETTER_PAGE}?view=${width}-${mode}`, problems),
            'The newsletter page did not open within the wait limit.');
          const ready = await withTimeLimit(() => page(`(async () => {
            const end = performance.now() + 5000;
            do {
              if (innerWidth === ${width} && document.querySelector('mu-rich-text')?.shadowRoot
                ?.querySelector('[part="approval-mark"]')
                && document.querySelector('.examples-frame nav a')) return true;
              await new Promise((resolve) => setTimeout(resolve, 25));
            } while (performance.now() < end);
            return false;
          })()`), 'The newsletter readiness check did not answer in time.');
          check(view, 'the newsletter is ready', ready, 'The newsletter did not load within the wait limit.');
          if (!ready) continue;

          const result = await withTimeLimit(() => page(`(${readNewsletter})()`), 'The newsletter could not be read in time.');
          const words = result.marks.length === 3 && result.marks.every(({ text, name, details, visible }, index) =>
            text === STATES[index] && name === 'Approval: ' + STATES[index] && details === DETAILS[index] && visible);
          check(view, 'each mark shows its state, name, approver and time', words,
            'A mark is missing or has different text or a different name.', result.marks);

          const media = result.forced === (mode === 'forced-colors') && (result.forced || result.dark === (mode === 'dark'))
            && result.reduced === (mode === 'reduced-motion');
          check(view, 'the marks fit and respect the media settings',
            media && result.colors && result.noMotion && result.width === width && result.scroll <= width,
            'The media, colors, motion or page width differ from the expected result.', result);

          const nodes = await ax();
          const names = STATES.filter((state) => has(nodes, 'group', 'Approval: ' + state) && has(nodes, 'StaticText', state));
          check(view, 'each mark has a group role and name in the accessibility tree',
            has(nodes, 'heading', 'Library newsletter') && names.length === STATES.length,
            'The accessibility tree is missing a heading, named group or state text.', names);

          steps.push(...await withTimeLimit(() => pageRules(session, sessionId, NEWSLETTER_PAGE + ' at ' + view),
            'The page rules did not finish within the wait limit.'));
          const revision = await withTimeLimit(() => page(`(${fillAgain})()`), 'The fill update did not finish in time.');
          const fresh = await withTimeLimit(() => page(`(${readNewsletter})()`), 'The new fill could not be read in time.');
          const afterFill = await ax();
          check(view, 'a new fill clears all marks until page code sets them again',
            fresh.marks.length === 0 && STATES.every((state) => !has(afterFill, 'group', 'Approval: ' + state)),
            'A mark stayed on the new fill.', fresh.marks);

          const late = await withTimeLimit(() => page(`(${applyLateApprovals})(${JSON.stringify(revision)})`),
            'The late approval update did not finish in time.');
          const afterLate = await ax();
          check(view, 'a late approval response for the old fill shows no mark',
            late.revision !== revision && late.count === 0
            && late.errors.includes(`revision: stale, the current revision is ${late.revision}`)
            && STATES.every((state) => !has(afterLate, 'group', 'Approval: ' + state)),
            'A late response showed a mark or did not report a stale revision.', late);

          const missing = await withTimeLimit(() => page(`(${updateApprovals})()`), 'The approval update did not finish in time.');
          const changed = await ax();
          check(view, 'page code sets marks again and a block with no approval keeps its text',
            missing.count === 2 && missing.unmarked && missing.second === 'The reading group meets in Room C on Tuesday.'
            && has(changed, 'group', 'Approval: Approved') && has(changed, 'group', 'Approval: Rejected')
            && !has(changed, 'group', 'Approval: Pending approval'),
            'The block text changed or its mark is still present.', missing);
        } catch (error) {
          check(view, 'complete the newsletter checks', false, String(error));
        }
      }
    }
  } finally {
    try {
      await send('Emulation.clearDeviceMetricsOverride');
      await send('Emulation.setEmulatedMedia', { features: modes.light });
      await send('Page.bringToFront');
    } catch (error) {
      check('Cleanup', 'restore the viewport and media', false, String(error));
    }
  }
  return steps;
}
