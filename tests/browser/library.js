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
  const waitFor = (expression) => page(`new Promise((done, fail) => {
    const end = performance.now() + 5000;
    function check() {
      if (${expression}) done(true);
      else if (performance.now() < end) setTimeout(check, 16);
      else fail(new Error('The library example did not reach the expected state.'));
    }
    check();
  })`);
  const check = (mode, step, ok, detail) => steps.push({
    page: LIBRARY_PAGE, step: mode + ': ' + step, ok, detail: JSON.stringify(detail),
  });

  try {
    for (const width of [375, 1280]) {
      const phone = width === 375;
      await session.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: phone }, sessionId);
      for (const [mode, features] of Object.entries(modes)) {
        const view = width + ' CSS pixels, ' + mode;
        await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
        await open(session, sessionId, `${base}/${LIBRARY_PAGE}?view=${width}-${mode}`, problems);
        await waitFor(`innerWidth === ${width} && document.querySelector("mu-pagination")?.dataset.state === "default"
          && document.querySelector(".examples-frame nav a")`);
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
          await waitFor(closed);
          const selected = await read();
          check(view, 'Tab reaches a drawer link and Enter follows it, closes the drawer and returns focus',
            link.focus === 'loan-link' && link.ring && !selected.modal && selected.hash === '#loans'
            && selected.focus === 'menu' && selected.ring, { link, selected });

          await enter();
          await press('Escape', 'Escape', 27);
          await waitFor(closed);
          const escaped = await read();
          check(view, 'Escape closes the drawer and returns focus to Menu',
            !escaped.modal && escaped.focus === 'menu' && escaped.ring, escaped);

          await space();
          await enter();
          await waitFor(closed);
          const dismissed = await read();
          check(view, 'the Close menu button closes the drawer and returns focus',
            !dismissed.modal && dismissed.focus === 'menu' && dismissed.ring, dismissed);
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
      }
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await session.send('Emulation.setEmulatedMedia', { features: modes.light }, sessionId);
    await session.send('Page.bringToFront', {}, sessionId);
  }
  return steps;
}
