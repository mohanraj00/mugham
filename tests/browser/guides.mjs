// The browser check of the guide pages in examples/guides/. tools/browser_check.mjs runs it.
// Each expected result is a statement of a guide in docs/guides/. If a guide and the kit do not agree,
// this check fails, so a guide cannot drift from the kit.

// The kit elements in the document and in each shadow root.
const WALK = `const all = []; const walk = (root) => { for (const node of root.querySelectorAll('*')) {
  if (node.tagName.startsWith('MU-')) all.push(node); if (node.shadowRoot) walk(node.shadowRoot); } }; walk(document);`;

const CONTRACTS = `(() => { ${WALK}
  const cards = [...document.querySelectorAll('mu-card')];
  const counts = [...document.querySelectorAll('mu-app-bird-count')];
  const view = (node) => ({ state: node.dataset.state, text: node.shadowRoot.textContent, bold: Boolean(node.shadowRoot.querySelector('b')) });
  return { elements: all.length, errors: [...document.querySelectorAll('#errors li')].map((node) => node.textContent),
    cards: cards.map(view), counts: counts.map(view) };
})()`;

const ASSEMBLE = `(() => {
  const thread = document.querySelector('mu-thread');
  const root = thread.shadowRoot;
  const action = (node) => node && ({ state: node.dataset.state, status: node.shadowRoot.querySelector('.status').textContent });
  return { thread: thread.dataset.state,
    actors: [...root.querySelectorAll('li.message .actor')].map((node) => node.textContent),
    refusals: [...root.querySelectorAll('.refusal')].map((node) => node.textContent),
    card: root.querySelector('mu-card')?.shadowRoot.textContent || '',
    top: action(document.querySelector('mu-action-button')), inThread: action(root.querySelector('mu-action-button')),
    stack: document.querySelector('mu-stack')?.dataset.state, cards: document.querySelectorAll('mu-grid > mu-card').length };
})()`;
// The click and the read run in one task, before the receipt can come back.
const press = (where) => `(() => {
  const button = ${where};
  button.shadowRoot.querySelector('button').click();
  return { state: button.dataset.state, status: button.shadowRoot.querySelector('.status').textContent };
})()`;

const THEME = `(() => {
  if (!document.querySelector('#forest mu-field')?.shadowRoot?.querySelector('input')) return null;
  const read = (id) => {
    const section = document.getElementById(id);
    const card = section.querySelector('mu-card');
    const article = getComputedStyle(card.shadowRoot.querySelector('article'));
    const button = getComputedStyle(section.querySelector('mu-action-button').shadowRoot.querySelector('button'));
    const input = getComputedStyle(section.querySelector('mu-field').shadowRoot.querySelector('input'));
    return { accent: button.backgroundColor, color: button.color, buttonBorder: button.borderTopColor,
      transition: button.transitionDuration, surface: article.backgroundColor, border: article.borderTopColor,
      radius: article.borderTopLeftRadius, inputBorder: input.borderTopStyle,
      focus: getComputedStyle(section).getPropertyValue('--mu-color-focus').trim() };
  };
  const probe = document.createElement('span');
  document.body.append(probe);
  const system = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const result = { kit: read('kit'), forest: read('forest'), buttonText: system('ButtonText'), canvasText: system('CanvasText') };
  probe.remove();
  return result;
})()`;
const zero = (value) => value.split(',').every((item) => parseFloat(item) === 0);

// Each theme mode, and the colors that the theming guide gives for it.
const THEME_MODES = {
  light: { features: [{ name: 'prefers-color-scheme', value: 'light' }],
    test: (v) => v.kit.accent === 'rgb(31, 95, 191)' && v.forest.accent === 'rgb(43, 106, 60)'
      && v.forest.surface === 'rgb(245, 248, 243)' && v.forest.radius === '4px' && v.kit.radius === '10px' && v.forest.focus === '#2b6a3c' },
  dark: { features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    test: (v) => v.kit.accent === 'rgb(140, 180, 245)' && v.forest.accent === 'rgb(140, 207, 157)'
      && v.forest.surface === 'rgb(17, 26, 20)' && v.forest.focus === '#8ccf9d' },
  'forced-colors': { features: [{ name: 'forced-colors', value: 'active' }],
    test: (v) => ['kit', 'forest'].every((id) => v[id].color === v.buttonText && v[id].buttonBorder === v.buttonText
      && v[id].border === v.canvasText && v[id].inputBorder === 'solid') },
  'reduced-motion': { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    test: (v) => zero(v.kit.transition) && zero(v.forest.transition) },
};

export async function guideChecks(session, sessionId, base, { evaluate, open, sleep }) {
  const steps = [];
  const accessibility = [];
  const step = (page, name, ok, detail) => steps.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const until = async (expression, test) => {
    let value = await evaluate(session, sessionId, expression);
    for (let i = 0; i < 100 && !test(value); i += 1) {
      await sleep(50);
      value = await evaluate(session, sessionId, expression);
    }
    return value;
  };
  const named = async (page, expected) => {
    const { nodes } = await session.send('Accessibility.getFullAXTree', {}, sessionId);
    const found = nodes.filter((node) => !node.ignored).map((node) => [node.role?.value, node.name?.value]);
    for (const [role, name] of expected) accessibility.push({ where: page, role, name, ok: found.some(([r, n]) => r === role && n === name) });
  };
  const light = [{ name: 'prefers-color-scheme', value: 'light' }];

  // docs/guides/contracts.md
  let page = 'examples/guides/contracts.html';
  await session.send('Emulation.setEmulatedMedia', { features: light }, sessionId);
  await open(session, sessionId, `${base}/${page}`);
  const c = await until(CONTRACTS, (value) => value.counts.length === 2);
  step(page, 'the validator gives each error with a path', JSON.stringify(c.errors) === JSON.stringify([
    'an undeclared component: component: no contract has the name banner',
    'an undeclared field: data.style: the contract does not declare this field',
    'an actions key of format 1: actions: unknown key',
    'no authorship slot: slots.authorship: a required slot is missing',
    'a title that is too long: data.title: more than 120 characters',
  ]), c.errors);
  const [tide, markup, claim] = c.cards;
  step(page, 'the card shows its data and its slots as text', tide?.state === 'default' && tide.text.includes('Tide table for the north pier')
    && tide.text.includes('Author: agent agent-notes (Note helper)') && tide.text.includes('Source: Synthetic tide notes, page 2')
    && tide.text.includes('https://example.org/tides#page-2'), tide);
  step(page, 'markup in a text field shows as text', markup?.state === 'default' && markup.text.includes('<b>Bold tide</b>') && !markup.bold, markup);
  step(page, 'an author that is not the bound actor is refused', claim?.state === 'refused'
    && claim.text === 'Refused card: slots.authorship: the author is not the bound actor', claim);
  step(page, 'the application element renders a valid fill', c.counts[0]?.state === 'default' && c.counts[0].text.includes('42 birds on 2026-11-02'), c.counts[0]);
  step(page, 'the application element refuses a value out of the contract', c.counts[1]?.state === 'refused'
    && c.counts[1].text === 'Refused bird-count: data.count: more than the maximum 300', c.counts[1]);
  step(page, '5 kit elements', c.elements === 5, c.elements);
  await named(page, [['article', 'Tide table for the north pier'], ['button', 'Open source: Synthetic tide notes, page 2'], ['article', 'East marsh']]);

  // docs/guides/assemble.md
  page = 'examples/guides/assemble.html';
  await open(session, sessionId, `${base}/${page}`);
  let a = await until(ASSEMBLE, (value) => value.thread === 'ended');
  step(page, 'the stack holds a grid of two cards', a.stack === 'default' && a.cards === 2, a);
  step(page, 'the action waits for a person', a.top?.state === 'default' && a.top.status === '', a.top);
  const top = await evaluate(session, sessionId, press(`document.querySelector('mu-action-button')`));
  step(page, 'a press shows Pending before the receipt', top.state === 'pending' && top.status === 'Pending', top);
  a = await until(ASSEMBLE, (value) => value.top.state !== 'pending');
  step(page, 'the receipt makes the action done', a.top.state === 'done' && a.top.status === 'Done: The loan is renewed.Reference: R-0001', a.top);
  step(page, 'the thread reads the source to its end', a.thread === 'ended', a.thread);
  step(page, 'each message names its actor', JSON.stringify(a.actors) === JSON.stringify(['Robin Person', ...Array(4).fill('Loan helper Agent')]), a.actors);
  step(page, 'the thread refuses the undeclared component', a.refusals.length === 1 && a.refusals[0].includes('banner'), a.refusals);
  step(page, 'the thread shows the card of the agent', a.card.includes('A short history of maps') && a.card.includes('Author: agent agent-loans (Loan helper)'), a.card);
  const inThread = await evaluate(session, sessionId, press(`document.querySelector('mu-thread').shadowRoot.querySelector('mu-action-button')`));
  step(page, 'the action in the thread shows Pending before the receipt', inThread.state === 'pending', inThread);
  a = await until(ASSEMBLE, (value) => value.inThread.state !== 'pending');
  step(page, 'perform gives the receipt to the action in the thread', a.inThread.state === 'done'
    && a.inThread.status === 'Done: The loan is renewed.Reference: R-0002', a.inThread);
  await named(page, [['group', 'Loans of Robin'], ['group', 'Current loans'], ['article', 'Field guide to moss'], ['list', 'Thread'],
    ['article', 'Message from Robin, Person'], ['article', 'Message from Loan helper, Agent'], ['button', 'Renew']]);

  // docs/guides/theme.md, in the four media modes of the kit checks.
  page = 'examples/guides/theme.html';
  for (const [mode, { features, test }] of Object.entries(THEME_MODES)) {
    await session.send('Emulation.setEmulatedMedia', { features }, sessionId);
    await open(session, sessionId, `${base}/${page}?mode=${mode}`);
    const value = await until(THEME, (item) => item !== null);
    step(page, `${mode}: the theme gives the expected values`, value !== null && test(value), value);
    if (mode === 'light') await named(page, [['article', 'Forest: field guide to moss'], ['textbox', 'Forest shelf code'], ['region', 'Forest theme']]);
  }
  await session.send('Emulation.setEmulatedMedia', { features: light }, sessionId);
  return { steps, accessibility };
}
