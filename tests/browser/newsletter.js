import { setTimeout as delay } from 'node:timers/promises';

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

function removeApproval() {
  const view = document.querySelector('mu-rich-text');
  const fill = structuredClone(view.fill);
  delete fill.data.blocks[1].data.approval;
  view.fill = fill;
  const blocks = view.shadowRoot.querySelector('[part="rich-text"]');
  return {
    count: blocks.querySelectorAll('[part="approval-mark"]').length,
    second: blocks.children[1].textContent,
    unmarked: blocks.children[1].matches('p'),
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
              if (innerWidth === ${width} && document.querySelector('mu-rich-text')?.dataset.state === 'default'
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
          const missing = await withTimeLimit(() => page(`(${removeApproval})()`), 'The fill update did not finish in time.');
          const changed = await ax();
          check(view, 'a block with no approval keeps its text without a mark',
            missing.count === 2 && missing.unmarked && missing.second === 'The reading group meets in Room B on Tuesday.'
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
