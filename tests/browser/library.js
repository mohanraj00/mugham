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
    firstLoan: document.querySelector('#loan-list li')?.textContent,
  };
}

function readLoanStatus() {
  const part = (host, name) => host?.shadowRoot?.querySelector('[part="' + name + '"]');
  const shown = (node) => Boolean(node?.getClientRects().length);
  const skeleton = document.querySelector('mu-skeleton');
  const status = part(skeleton, 'status');
  const lines = [...(status?.querySelectorAll('[part="line"]') ?? [])];
  const empty = document.querySelector('mu-empty-state');
  const search = document.getElementById('loan-query');
  const submit = document.getElementById('search-loans');
  const clear = document.getElementById('clear-loan-search');
  const avatar = part(document.querySelector('mu-avatar'), 'initials');
  const list = document.getElementById('loan-list');
  const badges = [...(list?.querySelectorAll('mu-badge') ?? [])].map((badge) => part(badge, 'label'));
  const forced = matchMedia('(forced-colors: active)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const probe = document.createElement('span');
  probe.style.forcedColorAdjust = 'none';
  document.body.append(probe);
  const color = (value) => {
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const focus = getComputedStyle(document.activeElement);
  const result = {
    focus: document.activeElement.id,
    ring: focus.outlineStyle === 'solid' && parseFloat(focus.outlineWidth) >= 2
      && focus.outlineColor === color(forced ? 'Highlight' : 'var(--mu-color-focus)'),
    targets: [search, submit, ...(shown(empty) ? [clear] : [])].every((node) => {
      const box = node?.getBoundingClientRect();
      return box?.width >= 44 && box?.height >= 44;
    }),
    query: search?.value, scroll: document.documentElement.scrollWidth,
    skeleton: shown(skeleton), list: shown(list), empty: shown(empty), pager: shown(document.querySelector('mu-pagination')),
    loadingName: status?.getAttribute('aria-label'),
    lineCount: lines.length,
    linesVisible: lines.every((line) => {
      const style = getComputedStyle(line);
      const box = line.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && line.getAttribute('aria-hidden') === 'true'
        && style.backgroundColor === color(forced ? 'GrayText' : 'var(--mu-color-border)')
        && (reduced || forced ? style.animationName === 'none' : style.animationName !== 'none');
    }),
    title: part(empty, 'title')?.textContent, text: part(empty, 'text')?.textContent,
    emptySurface: Boolean(part(empty, 'title')) && getComputedStyle(part(empty, 'title').parentElement).backgroundColor
      === color(forced ? 'Canvas' : 'var(--mu-color-surface)'),
    badges: badges.map((label) => label?.textContent),
    badgeTheme: badges.every((label) => {
      if (!label) return false;
      const { backgroundColor, borderTopColor, color: foreground } = getComputedStyle(label);
      return forced ? foreground === color('CanvasText') && borderTopColor === color('CanvasText')
        : label.className === 'danger' ? borderTopColor === color('var(--mu-color-danger)')
          : backgroundColor === color('var(--mu-color-' + label.className + ')')
            && foreground === color('var(--mu-color-on-' + label.className + ')');
    }),
    avatar: avatar?.textContent,
    avatarTheme: Boolean(avatar) && getComputedStyle(avatar).backgroundColor
      === color(forced ? 'Canvas' : 'var(--mu-color-surface)'),
    actions: window.libraryLoanActions,
  };
  probe.remove();
  return result;
}

async function loanStatusChecks(session, sessionId, width, view, { page, tab, enter, space, check, waitFor, pageRules, axErrors }) {
  const read = () => page(`(${readLoanStatus})()`);
  const step = (name, ok, detail, reason) => check(view, name, ok, { ...detail, reason: ok ? undefined : reason });
  const rules = [];
  try {
    await page(`(() => {
      window.libraryLoanActions = [];
      document.getElementById('loans')?.addEventListener('mu-action', ({ detail }) => window.libraryLoanActions.push(detail));
      document.querySelector('mu-breadcrumbs')?.shadowRoot?.querySelector('a')?.focus();
    })()`);
    const loaded = await read();
    const loadedRoles = await axErrors(session, sessionId, [
      ['image', 'Sample Reader'], ['StaticText', 'On loan'], ['StaticText', 'Due soon'], ['StaticText', 'Overdue'],
      ['textbox', 'Loan title or shelf'], ['button', 'Search'],
    ], view);
    step('the loan badges show their states and the staff avatar exposes the full name',
      loaded.list && !loaded.skeleton && !loaded.empty && loaded.badges.join() === 'On loan,Due soon,Overdue'
      && loaded.badgeTheme && loaded.avatar === 'SR' && loaded.avatarTheme && loaded.scroll <= width
      && loadedRoles.every(({ ok }) => ok), { loaded, loadedRoles }, 'The loaded loan states or staff name did not match.');
    await tab();
    const search = await read();
    await session.send('Input.insertText', { text: 'No such shelf' }, sessionId);
    await tab();
    const submit = await read();
    step('Tab reaches the named search controls with full targets and focus rings',
      search.focus === 'loan-query' && search.ring && submit.focus === 'search-loans' && submit.ring && submit.targets,
      { search, submit }, 'The search focus order, ring or target size did not match.');
    await enter();
    const loading = await read();
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const names = nodes.filter((node) => !node.ignored && node.name?.value === 'Loading loans');
    step('Enter shows one named status with visible lines that follow the color and motion settings',
      loading.skeleton && !loading.list && !loading.empty && !loading.pager && loading.loadingName === 'Loading loans'
      && loading.lineCount === 3 && loading.linesVisible && loading.scroll <= width
      && names.length === 1 && names[0]?.role?.value === 'status',
      { loading, roles: names.map((node) => node.role?.value) }, 'The loading state or its accessible name did not match.');
    const ready = await waitFor('document.querySelector("mu-empty-state:not([hidden])") !== null');
    const empty = await read();
    const [loadingRole, ...emptyRoles] = await axErrors(session, sessionId, [
      ['status', 'Loading loans'], ['group', 'No loans found'], ['heading', 'No loans found'], ['button', 'Clear search'],
    ], view);
    const ended = loadingRole?.ok === false;
    step('the loading status goes away and the empty result and its action appear',
      ready && !empty.skeleton && !empty.list && !empty.pager && empty.empty && empty.emptySurface
      && empty.text === 'Try another title or shelf code.' && empty.scroll <= width && empty.targets
      && ended && emptyRoles.every(({ ok }) => ok), { empty, emptyRoles, ended },
      ready ? 'The loading status or the empty result did not match the expected state.' : 'No empty result within the wait limit.');
    rules.push(...await pageRules(session, sessionId, LIBRARY_PAGE + ' with no loans in ' + view));
    await tab();
    const focused = await read();
    await space();
    const restored = await read();
    step('Tab reaches Clear search and Space restores the loan list and search focus',
      focused.focus === 'clear-loan-search' && focused.ring && restored.focus === 'loan-query' && restored.ring
      && restored.query === '' && restored.list && restored.pager && !restored.empty && !restored.skeleton
      && restored.badges.join() === 'On loan,Due soon,Overdue' && restored.targets && restored.scroll <= width
      && restored.actions?.length === 0, { focused, restored }, 'The control did not restore the loan list and focus without an action.');
  } catch (error) {
    step('the loan status checks complete', false, {}, error.message);
  }
  return rules;
}

function readWizard() {
  const wizard = document.getElementById('member-wizard');
  const steps = wizard?.querySelector('mu-steps')?.shadowRoot;
  const progress = wizard?.querySelector('#member-progress')?.shadowRoot;
  const unknown = wizard?.querySelector('#unknown-progress')?.shadowRoot;
  const part = (root, name) => root?.querySelector('[part="' + name + '"]');
  const panel = wizard?.querySelector('[data-member-step]:not([hidden])');
  const save = wizard?.querySelector('#add-member');
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
  const buttons = Array.from(panel?.querySelectorAll('mu-button, mu-action-button') ?? [],
    (control) => part(control.shadowRoot, 'button'));
  const controls = [...(steps?.querySelectorAll('button') ?? []), ...buttons].filter(Boolean);
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
    memberName: wizard?.querySelector('#member-name')?.textContent,
    membership: wizard?.querySelector('#member-type')?.textContent,
    events: window.librarySteps,
    requests: window.libraryRequests,
    saveStart: window.librarySaveStart,
    saveArgs: save?.action.arguments,
    saveState: save?.dataset.state,
    result: part(save?.shadowRoot, 'status')?.textContent,
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
  const controlsByStep = [
    [['textbox', 'Member name'], ['button', 'Next']],
    [['group', 'Membership type'], ['radio', 'Standard'], ['radio', 'Household'], ['button', 'Next'], ['button', 'Back']],
    [['button', 'Back'], ['button', 'Add member']],
  ];
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
    const missing = controlsByStep[value - 1].filter(([role, name]) =>
      !exposed.some((node) => node.role?.value === role && node.name?.value === name));
    step('the step controls have names', missing.length === 0, { missing });
  };

  await page(`(() => {
    window.librarySteps = [];
    window.libraryRequests = [];
    const wizard = document.getElementById('member-wizard');
    if (!wizard) return;
    wizard.addEventListener('mu-step-change', (event) => window.librarySteps.push(event.detail.index));
    wizard.addEventListener('mu-action', ({ detail }) => window.libraryRequests.push(detail));
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
  step('the draft steps send no action and Review shows both values',
    review.requests.length === 0 && review.memberName === 'Sample Member' && review.membership === 'Household', review);
  await ax(3);
  const reviewRules = await pageRules(session, sessionId, LIBRARY_PAGE + ' at Review in ' + view);
  await tab();
  const back = await read();
  await tab();
  const add = await read();
  await enter();
  const received = await waitFor('document.querySelector("#add-member")?.dataset.state === "done"');
  const saved = await read();
  const [request] = saved.requests;
  step('Add member shows Pending and shows the result after the receipt',
    add.focusedText === 'Add member' && add.ring && saved.saveStart?.state === 'pending'
    && saved.saveStart.text === 'Pending' && received && saved.result === 'Done: Member added.'
    && saved.requests.length === 1 && request?.tool === 'library.add_member'
    && request.arguments.member_name === 'Sample Member' && request.arguments.membership_type === 'Household',
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
  await tab();
  await page('document.activeElement?.shadowRoot?.activeElement?.select?.()');
  await session.send('Input.insertText', { text: 'Sample Member Two' }, sessionId);
  await enter();
  const edited = await read();
  await tab();
  await tab();
  await enter();
  const revised = await read();
  step('an edit updates the review and the next request arguments',
    at(edited, 1) && edited.focusedHeading && at(revised, 2) && revised.focusedHeading
    && revised.memberName === 'Sample Member Two' && revised.membership === 'Household'
    && revised.saveState === 'default' && revised.result === ''
    && revised.saveArgs?.member_name === 'Sample Member Two' && revised.saveArgs?.membership_type === 'Household'
    && revised.requests.length === 1 && revised.requests[0].arguments.member_name === 'Sample Member',
    { edited, revised });
  return [...membershipRules, ...reviewRules];
}

export async function libraryExampleChecks(session, sessionId, base, modes, { evaluate, open, key, pageRules, axErrors }, problems) {
  const steps = [];
  const page = (expression) => evaluate(session, sessionId, expression);
  const read = () => page(`(${readLibrary})()`);
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
          && document.querySelector("#loan-list mu-badge") && document.querySelector(".examples-frame nav a")`)) {
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
        await page('document.querySelector("#search-loans")?.focus()');
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
        steps.push(...await loanStatusChecks(session, sessionId, width, view, { page, tab, enter, space, check, waitFor, pageRules, axErrors }));
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
