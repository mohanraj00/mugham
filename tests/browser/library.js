import { setTimeout as delay } from 'node:timers/promises';

export const LIBRARY_PAGE = 'examples/apps/library.html';

function readLibrary() {
  const shell = document.querySelector('mu-app-shell');
  const root = shell.shadowRoot;
  const part = (scope, name) => scope.querySelector('[part="' + name + '"]');
  const top = part(root, 'top');
  const main = part(root, 'main');
  const skip = part(root, 'skip');
  const side = part(root, 'side');
  const menu = part(root, 'menu');
  const drawer = root.querySelector('mu-drawer');
  const dialog = drawer.shadowRoot.querySelector('dialog');
  const close = part(drawer.shadowRoot, 'close');
  const crumbs = document.querySelector('mu-breadcrumbs').shadowRoot;
  const pages = document.querySelector('mu-pagination').shadowRoot;
  const current = pages.querySelector('[aria-current="page"]');
  const controls = [
    skip, menu, close, ...shell.querySelectorAll('a[slot="side"]'), ...crumbs.querySelectorAll('a'),
    ...pages.querySelectorAll('button'),
  ].filter((node) => node.getClientRects().length);
  const forced = matchMedia('(forced-colors: active)').matches;
  const probe = document.createElement('span');
  probe.style.forcedColorAdjust = 'none';
  probe.style.color = forced ? 'Highlight' : 'var(--mu-color-focus)';
  probe.style.backgroundColor = forced ? 'Canvas' : 'var(--mu-color-surface)';
  document.body.append(probe);
  const ringColor = getComputedStyle(probe).color;
  const surface = getComputedStyle(probe).backgroundColor;
  probe.remove();

  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const focus = getComputedStyle(active);
  const sideBox = side.getBoundingClientRect();
  const mainBox = main.getBoundingClientRect();
  return {
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    inDrawer: side.parentElement === drawer, modal: dialog.matches(':modal'),
    menuVisible: menu.getClientRects().length > 0, expanded: menu.getAttribute('aria-expanded'),
    besideMain: sideBox.width > 0 && sideBox.right <= mainBox.left && sideBox.top === mainBox.top,
    landmarks: [top, side, main].map((node) => node.localName),
    focus: active.id || active.getAttribute('part'),
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2 && focus.outlineColor === ringColor,
    targets: controls.every((node) => {
      const { width, height } = node.getBoundingClientRect();
      return width >= 44 && height >= 44;
    }),
    surface: getComputedStyle(top).backgroundColor === surface,
    dark: matchMedia('(prefers-color-scheme: dark)').matches, forced,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    noMotion: [top, side, dialog, ...controls].every((node) => {
      const css = getComputedStyle(node);
      return css.animationName === 'none' && css.transitionDuration.split(',').every((time) => parseFloat(time) === 0);
    }),
    hash: location.hash, events: window.libraryPages,
    trail: crumbs.querySelector('ol [aria-current="page"]').textContent,
    separators: [...crumbs.querySelectorAll('[part="separator"]')].map((node) => node.getAttribute('aria-hidden')),
    page: current.textContent, gaps: pages.querySelectorAll('[part="gap"]').length,
    previousDisabled: part(pages, 'previous-page').disabled, nextDisabled: part(pages, 'next-page').disabled,
    firstLoan: document.querySelector('#loan-list li').textContent,
  };
}

function readWizard() {
  const wizard = document.getElementById('member-wizard');
  const steps = wizard?.querySelector('mu-steps')?.shadowRoot;
  const progress = wizard?.querySelector('#member-progress')?.shadowRoot;
  const unknown = wizard?.querySelector('#unknown-progress')?.shadowRoot;
  const part = (root, name) => root?.querySelector('[part="' + name + '"]');
  const panel = wizard?.querySelector('[data-member-step]:not([hidden])');
  const form = panel?.querySelector('mu-editable-form')?.shadowRoot;
  const themeColor = (color) => {
    const probe = document.createElement('span');
    probe.style.forcedColorAdjust = 'none';
    probe.style.color = color;
    wizard?.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const focus = getComputedStyle(active);
  const forced = matchMedia('(forced-colors: active)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = part(progress, 'bar');
  const unknownBar = part(unknown, 'bar');
  const indicator = part(unknown, 'indicator');
  const barStyle = bar && getComputedStyle(bar);
  const unknownStyle = unknownBar && getComputedStyle(unknownBar);
  const fillStyle = indicator && getComputedStyle(indicator);
  const stepNodes = [...(steps?.querySelectorAll('li') ?? [])];
  const controls = [...(steps?.querySelectorAll('button') ?? []), part(form, 'button'),
    part(panel?.querySelector('mu-button')?.shadowRoot, 'button'),
    part(panel?.querySelector('mu-action-button')?.shadowRoot, 'button')].filter(Boolean);
  return {
    heading: panel?.querySelector('h3')?.id,
    focusedHeading: active === panel?.querySelector('h3'),
    focus: active?.getAttribute('aria-label') || active?.getAttribute('part'),
    focusedText: active?.textContent?.trim().slice(0, 80),
    radio: active?.type === 'radio' ? active.value : null,
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2
      && focus.outlineColor === themeColor(forced ? 'Highlight' : 'var(--mu-color-focus)'),
    targets: controls.every((node) => {
      const { width, height } = node.getBoundingClientRect();
      return width >= 44 && height >= 44;
    }),
    scroll: document.documentElement.scrollWidth,
    states: stepNodes.map((step) => part(step, 'state')?.textContent),
    positions: stepNodes.map((step) => part(step, 'position')?.textContent),
    current: stepNodes.map((step) => step.getAttribute('aria-current')),
    backButtons: stepNodes.map((step) => Boolean(part(step, 'back'))),
    value: part(progress, 'value')?.textContent,
    position: bar?.position,
    track: barStyle?.backgroundColor === themeColor(forced ? 'Canvas' : 'var(--mu-color-surface)')
      && barStyle?.borderTopColor === themeColor(forced ? 'CanvasText' : 'var(--mu-color-border)'),
    unknown: unknownBar?.getAttribute('aria-valuenow') === null && part(unknown, 'value')?.textContent === 'Unknown',
    fillVisible: indicator?.getBoundingClientRect().width > 0
      && fillStyle?.backgroundColor === themeColor(forced ? 'Highlight' : 'var(--mu-color-accent)')
      && unknownStyle?.backgroundColor === barStyle?.backgroundColor && unknownStyle?.borderTopColor === barStyle?.borderTopColor,
    motion: Boolean(fillStyle) && (reduced ? fillStyle.animationName === 'none' : fillStyle.animationName !== 'none'),
    membership: wizard?.querySelector('#member-type')?.textContent,
    events: window.librarySteps,
    saveStart: window.librarySaveStart,
    result: part(wizard?.querySelector('mu-action-button')?.shadowRoot, 'status')?.textContent,
  };
}

async function wizardChecks(session, sessionId, width, view, { page, tab, press, enter, space, check, waitFor, pageRules }) {
  const read = () => page(`(${readWizard})()`);
  const step = (name, ok, detail) => check(view, name, ok, detail);
  const shiftTab = async () => {
    const tab = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', ...tab }, sessionId);
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...tab }, sessionId);
  };
  const names = ['member-details-title', 'member-type-title', 'member-review-title'];
  const at = (state, index) => state.heading === names[index] && state.targets && state.scroll <= width
    && state.current.join() === names.map((_, item) => item === index ? 'step' : '').join()
    && state.states.join() === names.map((_, item) => item < index ? 'Done' : item === index ? 'Current' : 'Next').join()
    && state.backButtons.join() === names.map((_, item) => item < index).join()
    && state.positions.join() === 'Step 1 of 3,Step 2 of 3,Step 3 of 3' && state.value === (index + 1) + ' of 3'
    && state.position === (index + 1) / 3;
  const ax = async (value) => {
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const exposed = nodes.filter((node) => !node.ignored);
    const known = exposed.find((node) => node.role?.value === 'progressbar' && node.name?.value === 'Wizard progress');
    const unknown = exposed.find((node) => node.role?.value === 'progressbar' && node.name?.value === 'Loading loans');
    const property = (node, name) => node?.properties?.find((entry) => entry.name === name)?.value?.value;
    const progress = [property(known, 'valuemin'), known?.value?.value, property(known, 'valuemax')];
    const unknownOK = Boolean(unknown) && unknown.value === undefined;
    const list = exposed.some((node) => node.role?.value === 'list' && node.name?.value === 'Member steps');
    const browseText = exposed.filter((node) => node.role?.value === 'StaticText').map((node) => node.name?.value).join(' ');
    const currentText = browseText.includes('Step ' + value + ' of 3') && browseText.includes('Current');
    const back = exposed.some((node) => node.role?.value === 'button'
      && /^Step 1 of 3\s*\. Details\s*\. Done$/.test(node.name?.value));
    step('the accessibility tree gives the step position, state and progress range',
      list && currentText && progress.join() === '0,' + value + ',3' && unknownOK && back === (value > 1),
      { expected: value, progress, list, currentText, back, unknown: unknown?.value, unknownOK });
  };

  await page(`(() => {
    window.librarySteps = [];
    const wizard = document.getElementById('member-wizard');
    if (!wizard) return;
    wizard.addEventListener('mu-step-change', (event) => window.librarySteps.push(event.detail.index));
    const save = wizard.querySelector('mu-action-button');
    save?.addEventListener('mu-action', () => {
      window.librarySaveStart = {
        state: save.dataset.state, text: save.shadowRoot?.querySelector('[part="status"]')?.textContent,
      };
    });
    const unknown = document.createElement('mu-progress');
    unknown.id = 'unknown-progress';
    unknown.fill = { component: 'progress', version: '0.1.0', data: { label: 'Loading loans', maximum: 3 } };
    wizard.append(unknown);
    document.getElementById('member-details-title')?.focus();
  })()`);
  const start = await read();
  step('the first step and both bars fit and use the theme and motion settings',
    at(start, 0) && start.track && start.unknown && start.fillVisible && start.motion, start);
  await ax(1);
  await tab();
  const input = await read();
  await tab();
  const next = await read();
  await enter();
  const membership = await read();
  step('Tab reaches the member field and Next, and Enter focuses Membership type',
    input.focus === 'input' && input.ring && next.focus === 'button' && next.focusedText === 'Next' && next.ring
    && at(membership, 1) && membership.focusedHeading && membership.ring, { input, next, membership });
  await ax(2);
  const membershipRules = await pageRules(session, sessionId, LIBRARY_PAGE + ' at Membership type in ' + view);
  await tab();
  const standard = await read();
  await press('ArrowDown', 'ArrowDown', 40);
  const household = await read();
  await tab();
  const continueControl = await read();
  await space();
  const review = await read();
  step('an arrow key selects a membership and Space on Next focuses Review',
    standard.radio === 'Standard' && standard.ring && household.radio === 'Household' && household.ring
    && continueControl.focusedText === 'Next' && continueControl.ring
    && at(review, 2) && review.focusedHeading && review.ring && review.membership === 'Household',
    { standard, household, continueControl, review });
  await ax(3);
  const reviewRules = await pageRules(session, sessionId, LIBRARY_PAGE + ' at Review in ' + view);
  await tab();
  const back = await read();
  await tab();
  const add = await read();
  await enter();
  const received = await waitFor('document.querySelector("#add-member")?.dataset.state === "done"');
  const saved = await read();
  step('Add member shows Pending and shows the result after the receipt',
    add.focusedText === 'Add member' && add.ring && saved.saveStart?.state === 'pending'
    && saved.saveStart.text === 'Pending' && received && saved.result === 'Done: Member added.',
    { add, saved, received, reason: received ? undefined : 'No receipt within the wait limit.' });
  await shiftTab();
  await enter();
  const returned = await read();
  step('Enter on Back focuses Membership type and restores its step state',
    back.focusedText === 'Back' && back.ring && at(returned, 1) && returned.focusedHeading && returned.ring, { back, returned });
  await shiftTab();
  const done = await read();
  await space();
  const details = await read();
  step('Shift+Tab reaches the done step and Space requests it once and focuses Details',
    done.focus === 'back' && done.ring && at(details, 0) && details.focusedHeading && details.ring
    && details.events?.join() === '0', { done, details });
  return [...membershipRules, ...reviewRules];
}

export async function libraryExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = () => page(`(${readLibrary})()`);
  const press = async (name, code, number, text) => {
    await key(session, sessionId, name, code, number, text);
    if (name === 'Escape') {
      await delay(150);
      await session.send('Page.bringToFront', {}, sessionId);
    }
  };
  const tab = () => press('Tab', 'Tab', 9);
  const enter = () => press('Enter', 'Enter', 13, '\r');
  const space = () => press(' ', 'Space', 32, ' ');
  const focusMenu = () => page('document.querySelector("mu-app-shell").shadowRoot.querySelector("[part=menu]").focus()');
  const waitFor = async (expression) => {
    const end = performance.now() + 5000;
    do {
      if (await page(expression)) return true;
      await delay(16);
    } while (performance.now() < end);
    return false;
  };
  const check = (mode, step, ok, detail) => steps.push({
    page: LIBRARY_PAGE, step: mode + ': ' + step, ok: Boolean(ok), detail: JSON.stringify(detail),
  });

  try {
    for (const width of [375, 1280]) {
      const phone = width === 375;
      await session.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: phone }, sessionId);
      for (const [mode, features] of Object.entries(modes)) {
        const view = width + ' CSS pixels, ' + mode;
        await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
        await open(session, sessionId, `${base}/${LIBRARY_PAGE}?view=${width}-${mode}`, problems);
        if (!await waitFor(`innerWidth === ${width} && document.querySelector("mu-pagination")?.dataset.state === "default"
          && document.querySelector("mu-steps")?.dataset.state === "default"
          && document.querySelector(".examples-frame nav a")`)) {
          check(view, 'the library page is ready', false, 'The page did not reach the expected width or load its controls within the wait limit.');
          continue;
        }
        await page(`(() => {
          window.libraryPages = [];
          document.addEventListener('mu-page-change', (event) => window.libraryPages.push(event.detail.page));
          document.querySelector('.examples-frame nav a:last-child').focus();
        })()`);
        await tab();
        const start = await read();
        check(view, 'the shell has three landmarks and fits with 44 by 44 CSS pixel targets',
          start.width === width && start.scroll <= width && start.targets && start.landmarks.join() === 'header,nav,main'
          && start.menuVisible === phone && start.inDrawer === phone && start.besideMain === !phone && !start.modal, start);
        check(view, 'the surface follows the theme and respects reduced motion', start.surface
          && start.forced === (mode === 'forced-colors') && (start.forced || start.dark === (mode === 'dark'))
          && start.reduced === (mode === 'reduced-motion') && (!start.reduced || start.noMotion), start);

        await enter();
        const skipped = await read();
        await tab();
        const crumb = await read();
        check(view, 'Tab shows the skip link and Enter moves focus to the main area',
          start.focus === 'skip' && start.ring && skipped.focus === 'main' && skipped.ring && crumb.focus === 'link' && crumb.ring, {
            start: start.focus, skipped: skipped.focus, crumb: crumb.focus,
          });
        const roles = await axErrors(session, sessionId, [
          ['main', ''], ['navigation', 'Breadcrumbs'], ['list', ''], ['link', 'Staff home'],
          ['navigation', 'Loan pages'], ['button', 'Previous page'], ['button', 'Page 1'], ['button', 'Next page'],
          phone ? ['button', 'Menu'] : ['navigation', 'Library sections'],
        ], view);
        check(view, 'the trail and page controls expose their roles and names',
          roles.every(({ ok }) => ok) && start.trail === 'Loans' && start.separators.join() === 'true', roles);
        steps.push(...await pageRules(session, sessionId, LIBRARY_PAGE + ' at ' + view));
        await tab();
        const first = await read();
        await space();
        const same = await read();
        check(view, 'Tab skips the disabled Previous button and Space on the current page sends no request',
          first.focus === 'page-1' && first.ring && same.page === '1' && same.events.length === 0, { first, same });

        if (phone) {
          await focusMenu();
          const menu = await read();
          await space();
          const opened = await read();
          const drawerRoles = await axErrors(session, sessionId, [
            ['dialog', 'Library sections'], ['navigation', 'Library sections'], ['button', 'Close menu'], ['link', 'Loans'],
          ], view);
          check(view, 'Space opens the drawer with a named dialog and navigation landmark',
            menu.ring && opened.modal && opened.expanded === 'true' && opened.focus === 'close' && opened.ring
            && opened.targets && opened.scroll <= width && (!opened.reduced || opened.noMotion)
            && drawerRoles.every(({ ok }) => ok), { opened, drawerRoles });
          steps.push(...await pageRules(session, sessionId, LIBRARY_PAGE + ' with the drawer open in ' + view));
          await tab();
          const link = await read();
          await enter();
          const closed = 'document.querySelector("mu-app-shell").shadowRoot.querySelector("[part=menu]").getAttribute("aria-expanded") === "false"';
          const closedOnLink = await waitFor(closed);
          const selected = await read();
          check(view, 'Tab reaches a drawer link and Enter follows it, closes the drawer and returns focus',
            closedOnLink && link.focus === 'loan-link' && link.ring && !selected.modal && selected.hash === '#loans'
            && selected.focus === 'menu' && selected.ring, { link, selected });

          await enter();
          await press('Escape', 'Escape', 27);
          const closedOnEscape = await waitFor(closed);
          const escaped = await read();
          check(view, 'Escape closes the drawer and returns focus to Menu',
            closedOnEscape && !escaped.modal && escaped.focus === 'menu' && escaped.ring, escaped);

          await space();
          await enter();
          const closedOnButton = await waitFor(closed);
          const dismissed = await read();
          check(view, 'the Close menu button closes the drawer and returns focus',
            closedOnButton && !dismissed.modal && dismissed.focus === 'menu' && dismissed.ring, dismissed);
        } else {
          await page('document.querySelector("#loan-link").focus()');
          const link = await read();
          check(view, 'the wide side bar link has a focus ring', link.focus === 'loan-link' && link.ring, link);
        }

        await page('document.querySelector("mu-pagination").shadowRoot.querySelector("[part=next-page]").focus()');
        const next = await read();
        await enter();
        const second = await read();
        check(view, 'Enter on Next sends one request and the page code shows the next loans',
          start.previousDisabled && !start.nextDisabled && start.gaps === 1 && next.ring
          && second.page === '2' && second.events.join() === '2' && second.firstLoan !== start.firstLoan
          && second.focus === 'next-page' && second.ring, { next, second });
        await page('document.querySelector("mu-pagination").shadowRoot.querySelector("#page-12").focus()');
        const lastButton = await read();
        await space();
        const last = await read();
        check(view, 'Space on the last number sends one request and disables Next at the end',
          lastButton.ring && last.page === '12' && last.focus === 'page-12' && last.ring && last.nextDisabled
          && last.events.join() === '2,12' && last.targets && last.scroll <= width, last);
        steps.push(...await wizardChecks(session, sessionId, width, view, { page, tab, press, enter, space, check, waitFor, pageRules }));
      }
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Page.bringToFront', {}, sessionId);
  }
  return steps;
}
