// The browser check of the examples index (issue 99). tools/browser_check.mjs runs it.
// It opens examples/index.html, filters the list, then follows the link of each example. Each page must load
// with the status 200 and show the frame: the link back to the index, the group, and the previous and next
// example. The main check fails for each console error of a page. The expected names come from
// examples/examples.json, and the expected filter results come from its sentences.
import { readFileSync } from 'node:fs';

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
    prev: link('prev'), next: link('next'), status: performance.getEntriesByType('navigation')[0].responseStatus };
})()`;

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

    for (const [index, example] of EXAMPLES.entries()) {
      const name = serverOf(example);
      if (name && !servers[name]) servers[name] = await pythonServer(name, SERVERS[name]);
      const origin = name ? new URL(servers[name].url).origin : base;
      const where = `examples/${example.path}`;
      await open(session, sessionId, `${origin}/${where}`);
      let frame = await evaluate(session, sessionId, FRAME);
      for (let i = 0; i < 100 && frame === null; i += 1) { await sleep(50); frame = await evaluate(session, sessionId, FRAME); }
      const link = (other, word) => (other ? { text: `${word}: ${other.name}`, href: `${origin}/examples/${other.path}` } : null);
      const expected = { first: true, back: `${origin}/examples/index.html`, where: `All examples / ${example.group} / ${example.name}`,
        prev: link(EXAMPLES[index - 1], 'Previous'), next: link(EXAMPLES[index + 1], 'Next'), status: 200 };
      step(where, 'the link of the index opens the page, and the page has the frame', JSON.stringify(frame) === JSON.stringify(expected), frame);
    }
  } finally {
    for (const { server } of Object.values(servers)) server.kill();
  }
  return steps;
}
