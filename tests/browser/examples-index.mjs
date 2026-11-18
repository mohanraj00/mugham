// The browser check of the examples index (issue 99) and of the docs panel (issue 100). tools/browser_check.mjs runs it.
// It opens examples/index.html, filters the list, then follows the link of each example. Each page must load
// with the status 200 and show the frame: the link back to the index, the group, and the previous and next
// example. The main check fails for each console error of a page. The expected names come from
// examples/examples.json, and the expected filter results come from its sentences.
import { readFileSync } from 'node:fs';

const DOCS = JSON.parse(readFileSync(new URL('../../examples/docs.json', import.meta.url), 'utf8'));
const LIST = JSON.parse(readFileSync(new URL('../../examples/examples.json', import.meta.url), 'utf8'));
const EXAMPLES = LIST.groups.flatMap((group) => group.examples.map((example) => ({ ...example, group: group.title })));
// The arguments of each fixture API that an example needs. Each one also serves the example files.
const SERVERS = { 'thread_server.py': ['--port', '0', '--no-delay'], 'approval_server.py': ['--port', '0'],
  'upload_server.py': ['--port', '0'], 'apps_server.py': ['--port', '0'] };
const serverOf = (example) => example.needs?.match(/tools\/([a-z_]+\.py)/)?.[1];

const INDEX = `(() => {
  const items = [...document.querySelectorAll('#groups li')];
  return {
    entries: items.map((item) => ({ name: item.querySelector('a').textContent, href: item.querySelector('a').href,
      text: item.querySelector('p').textContent, shown: item.getClientRects().length > 0 })),
    groups: [...document.querySelectorAll('#groups section')].filter((node) => node.getClientRects().length > 0)
      .map((node) => node.querySelector('h2').textContent),
    count: document.getElementById('count').textContent,
  };
})()`;
const type = (value) => `(() => {
  const input = document.getElementById('filter');
  input.value = ${JSON.stringify(value)};
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`;
const FRAME = `(() => {
  const header = document.querySelector('body > header.examples-frame');
  if (!header) return null;
  const link = (rel) => { const node = header.querySelector('a[rel="' + rel + '"]'); return node ? { text: node.textContent, href: node.href } : null; };
  return { first: document.body.firstElementChild === header, back: header.querySelector('p a').href, where: header.querySelector('p').textContent,
    prev: link('prev'), next: link('next'), need: header.querySelector('p.examples-need')?.textContent ?? null,
    status: performance.getEntriesByType('navigation')[0].responseStatus };
})()`;

// Open each part of the docs panel, then read it. The keys of each part must be the keys of the contract in the
// registry of the page. used has each component that an element of the page shows, in each shadow root.
const PANEL = `(async () => {
  const aside = document.querySelector('body > aside.example-docs');
  if (!aside) return null;
  const parts = [...aside.querySelectorAll(':scope > details')];
  for (const part of parts) part.open = true;
  await new Promise((done) => setTimeout(done, 100));
  const { CONTRACTS } = await import('/src/render/registry.js');
  const used = new Set();
  const walk = (root) => { for (const node of root.querySelectorAll('*')) {
    if (node.tagName === 'MU-THREAD') used.add('thread');
    else if (node.tagName.startsWith('MU-')) used.add(node.constructor.component);
    if (node.shadowRoot) walk(node.shadowRoot);
  } };
  walk(document);
  const main = document.querySelector('body > main').getBoundingClientRect();
  const box = aside.getBoundingClientRect();
  return {
    used: [...used], missing: [...aside.querySelectorAll('[data-missing]')].map((node) => node.dataset.missing),
    beside: box.left >= main.right - 1 && box.top < main.bottom, below: box.top >= main.bottom - 1,
    parts: parts.map((part) => {
      const name = part.dataset.component;
      const element = part.querySelector('summary code').textContent;
      const sample = part.querySelector(':scope > pre');
      return { name, element, defined: Boolean(customElements.get(element)),
        keys: [...part.querySelectorAll(':scope > dl.docs-keys > dt')].map((node) => node.dataset.key),
        contract: name === 'thread' ? [] : Object.keys(CONTRACTS[name]?.data ?? { missing: true }),
        types: [...part.querySelectorAll(':scope > dl.docs-keys > dd')].every((node) => node.textContent.length > 3),
        events: [...part.querySelectorAll(':scope > dl.docs-events > dt')].map((node) => node.textContent),
        actions: part.querySelectorAll(':scope > h4').length >= 2,
        sample: sample ? JSON.parse(sample.textContent).component : null,
        howto: [...part.querySelectorAll(':scope > ol.docs-howto strong')].map((node) => node.textContent.trim()),
        links: [...part.querySelectorAll(':scope > p.docs-links a')].map((node) => node.href) };
    }),
  };
})()`;
const docsOf = (name) => (name === 'thread' ? DOCS.thread : (DOCS.components[name] ?? DOCS.application));

export async function exampleIndexChecks(session, sessionId, base, { evaluate, open, sleep, pythonServer }) {
  const page = 'examples/index.html';
  const steps = [];
  const step = (where, name, ok, detail) => steps.push({ page: where, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const shown = (state) => state.entries.filter((entry) => entry.shown).map((entry) => entry.name);
  const servers = {};
  try {
    await open(session, sessionId, `${base}/${page}`);
    let state = await evaluate(session, sessionId, INDEX);
    for (let i = 0; i < 100 && state.entries.length === 0; i += 1) { await sleep(50); state = await evaluate(session, sessionId, INDEX); }
    step(page, 'the index lists each example with a name, one sentence and a link',
      state.entries.length === EXAMPLES.length && state.entries.every((entry, index) => entry.name === EXAMPLES[index].name
        && entry.text === EXAMPLES[index].text && entry.href === `${base}/examples/${EXAMPLES[index].path}` && entry.shown),
      state.entries.map((entry) => entry.name));
    step(page, 'the index shows each group', JSON.stringify(state.groups) === JSON.stringify(LIST.groups.map((group) => group.title)), state.groups);
    step(page, 'the index gives the number of examples', state.count === `${EXAMPLES.length} examples`, state.count);

    await evaluate(session, sessionId, type('Receipt'));
    state = await evaluate(session, sessionId, INDEX);
    step(page, 'the filter keeps only the examples with the word',
      JSON.stringify(shown(state)) === JSON.stringify(['Upload', 'Thread']) && state.count === `2 of ${EXAMPLES.length} examples`
        && JSON.stringify(state.groups) === JSON.stringify(['Inputs and forms', 'Chat thread']), { shown: shown(state), count: state.count, groups: state.groups });
    await evaluate(session, sessionId, type('grid budget'));
    state = await evaluate(session, sessionId, INDEX);
    step(page, 'the filter needs each word', JSON.stringify(shown(state)) === JSON.stringify(['Data grid']), shown(state));
    await evaluate(session, sessionId, type('no-such-word'));
    state = await evaluate(session, sessionId, INDEX);
    step(page, 'the filter tells when no example has the word',
      shown(state).length === 0 && state.groups.length === 0 && state.count === 'No example has this word. Remove a word from the filter.', state.count);
    await evaluate(session, sessionId, type(''));
    state = await evaluate(session, sessionId, INDEX);
    step(page, 'an empty filter shows each example again', shown(state).length === EXAMPLES.length && state.count === `${EXAMPLES.length} examples`, state.count);

    let marked = 0;
    let noted = 0;
    for (const [index, example] of EXAMPLES.entries()) {
      const name = serverOf(example);
      if (name && !servers[name]) servers[name] = await pythonServer(name, SERVERS[name]);
      const origin = name ? new URL(servers[name].url).origin : base;
      const where = `examples/${example.path}`;
      await open(session, sessionId, `${origin}/${where}`);
      let frame = await evaluate(session, sessionId, FRAME);
      for (let i = 0; i < 100 && frame === null; i += 1) { await sleep(50); frame = await evaluate(session, sessionId, FRAME); }
      // A link to an example with a different fixture API tells the need. The page of such an example tells
      // how to start its API, because a different server gives the page with no data.
      const mark = (other) => (other.needs && other.needs !== example.needs ? ' (needs its fixture API)' : '');
      const link = (other, word) => (other ? { text: `${word}: ${other.name}${mark(other)}`, href: `${origin}/examples/${other.path}` } : null);
      const need = example.needs
        ? `This example reads a fixture API. If the page shows no data, run ${example.needs}. Then open the address that the command gives.` : null;
      const expected = { first: true, back: `${origin}/examples/index.html`, where: `All examples / ${example.group} / ${example.name}`,
        prev: link(EXAMPLES[index - 1], 'Previous'), next: link(EXAMPLES[index + 1], 'Next'), need, status: 200 };
      step(where, 'the link of the index opens the page, and the page has the frame', JSON.stringify(frame) === JSON.stringify(expected), frame);
      marked += [frame?.prev, frame?.next].filter((item) => item?.text.endsWith(' (needs its fixture API)')).length;
      if (frame?.need) noted += 1;

      // The docs panel. A wide screen shows it next to the example, and a narrow screen shows it below.
      const wide = index === 0 || example.path === 'apps/support/';
      if (wide) await session.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
      const panel = await evaluate(session, sessionId, PANEL);
      step(where, 'the docs panel has one part for each component of the page, and no doc is missing',
        panel !== null && JSON.stringify(panel.parts.map((part) => part.name)) === JSON.stringify(example.components)
          && panel.missing.length === 0 && panel.used.every((name) => example.components.includes(name)),
        panel && { parts: panel.parts.map((part) => part.name), missing: panel.missing, used: panel.used });
      for (const part of panel?.parts ?? []) {
        const docs = docsOf(part.name);
        const links = [docs.doc.path, DOCS.guides[docs.guide].path].map((path) => DOCS.repository + path);
        step(where, `the part of ${part.name} gives the element, the keys of the contract, the events, the actions, the sample and the links`,
          part.defined && part.element === (docs.element ?? `mu-app-${part.name}`) && part.types && part.actions
            && JSON.stringify(part.keys) === JSON.stringify(part.contract)
            && JSON.stringify(part.events) === JSON.stringify(docs.events.map(([name]) => name))
            && part.sample === (docs.sample ? part.name : null)
            && JSON.stringify(part.howto) === JSON.stringify((docs.howto ?? []).map(([title]) => title + '.'))
            && JSON.stringify(part.links) === JSON.stringify(links), part);
      }
      if (wide) {
        step(where, 'a wide screen shows the docs panel next to the example', panel?.beside === true, { beside: panel?.beside });
        await session.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }, sessionId);
        const narrow = await evaluate(session, sessionId, PANEL);
        step(where, 'a narrow screen shows the docs panel below the example', narrow?.below === true, { below: narrow?.below });
        await session.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
      }
    }
    const fixtures = EXAMPLES.filter((example) => example.needs).length;
    step(page, 'each example with a fixture API tells how to start it, and each link across two servers tells the need',
      fixtures >= 5 && noted === fixtures && marked >= fixtures, { fixtures, noted, marked });
  } finally {
    for (const { server } of Object.values(servers)) server.kill();
  }
  return steps;
}
