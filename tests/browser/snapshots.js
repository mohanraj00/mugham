// The flow of examples/tables/snapshots.html against its fixture API, examples/tables/snapshots-api.js. The API runs in the page,
// so the check needs no server. The example only reads, so the check also proves that it sends no action.
// tools/browser_check.mjs imports this check in Node and runs it in headless Chrome.
export async function snapshotChecks(session, sessionId, base, { evaluate, open, sleep }) {
  const page = 'examples/tables/snapshots.html';
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  await open(session, sessionId, `${base}/${page}`);
  await evaluate(session, sessionId, `(window.muActions = 0, document.addEventListener('mu-action', () => { window.muActions += 1; }), true)`);
  const read = () => evaluate(session, sessionId, `(() => {
    const rows = (section) => [...(document.querySelector(section + ' mu-table')?.shadowRoot.querySelectorAll('tbody tr') ?? [])]
      .map((row) => [...row.cells].map((cell) => cell.textContent).join(' / '));
    const diff = document.querySelector('#comparison mu-diff');
    return { collections: rows('#collections'), snapshots: rows('#snapshots'),
      from: document.querySelector('#snapshots [name="from"]')?.value ?? '', to: document.querySelector('#snapshots [name="to"]')?.value ?? '',
      diff: diff ? [...diff.shadowRoot.querySelectorAll('[part="change"]')].map((item) => item.textContent.replace(/\\s+/g, ' ').trim()) : null,
      title: diff?.shadowRoot.querySelector('[part="title"]')?.textContent ?? '',
      impact: [...document.querySelectorAll('#comparison .snap-impact li')].map((item) => item.textContent),
      none: document.getElementById('no-impact')?.textContent ?? '', actions: window.muActions };
  })()`);
  const until = async (test) => {
    let found = await read();
    for (let i = 0; i < 100 && !test(found); i += 1) { await sleep(30); found = await read(); }
    return found;
  };
  const act = (expression) => evaluate(session, sessionId, `(() => { ${expression} return true; })()`);
  const open_ = (name) => act(`[...document.querySelectorAll('#collections button')].find((item) => item.textContent === 'Open ${name}').click();`);
  const compare = (from, to) => act(`
    const from = document.querySelector('#snapshots [name="from"]'); from.value = '${from}';
    const to = document.querySelector('#snapshots [name="to"]'); to.value = '${to}';
    [...document.querySelectorAll('#snapshots button')].find((item) => item.textContent === 'Compare snapshots').click();`);

  let found = await until((value) => value.collections.length === 2);
  check('the table lists the collections from the fixture API', found.collections.join('|') === 'Ingredients / 3 / S-3|Recipes / 2 / S-2', found.collections);
  await open_('Ingredients');
  found = await until((value) => value.snapshots.length === 3);
  check('the table lists the snapshots of a collection, and the pickers start at the first and the last',
    found.snapshots.join('|') === 'S-1 / 2026-09-01 / 4 / First count|S-2 / 2026-10-01 / 5 / Yeast added|S-3 / 2026-11-01 / 4 / Sugar removed'
    && found.from === 'S-1' && found.to === 'S-3', found);
  await compare('S-1', 'S-3');
  found = await until((value) => value.diff?.length);
  check('the diff shows the compare result of two snapshots', found.title === 'Ingredients: S-1 to S-3' && found.diff.length === 5
    && found.diff.some((item) => item.includes('Flour') && item.includes('Changed') && item.includes('1.20 per kg') && item.includes('1.35 per kg'))
    && found.diff.some((item) => item.includes('Sugar') && item.includes('Removed'))
    && found.diff.some((item) => item.includes('Yeast') && item.includes('Added'))
    && found.diff.some((item) => item.includes('Salt') && item.includes('Unchanged')), found);
  check('the impact lists the records that the change affects', found.impact.join('|') === 'Bread loaf (Recipes): Uses Flour (changed), Yeast (added)'
    + '|Shortbread (Recipes): Uses Flour (changed), Sugar (removed), Butter (changed)|Flatbread (Recipes): Uses Flour (changed)', found.impact);
  await compare('S-2', 'S-3');
  found = await until((value) => value.title === 'Ingredients: S-2 to S-3');
  check('a second compare replaces the first result and its impact', found.impact.join('|') === 'Shortbread (Recipes): Uses Sugar (removed), Butter (changed)', found);
  // A comparison that is still pending when the person opens another collection must not show.
  await act(`[...document.querySelectorAll('#snapshots button')].find((item) => item.textContent === 'Compare snapshots').click();
    [...document.querySelectorAll('#collections button')].find((item) => item.textContent === 'Open Recipes').click();`);
  found = await read();
  check('a pending comparison does not show after another collection opens', found.diff === null && !found.snapshots.length, found);
  await until((value) => value.snapshots.length === 2);
  await sleep(400);
  found = await read();
  check('the old comparison does not come back', found.diff === null && !found.impact.length && found.snapshots.length === 2, found);
  found = await until((value) => value.snapshots.length === 2 && value.diff === null);
  check('another collection shows its snapshots and clears the result', found.snapshots.length === 2 && found.from === 'S-1' && found.to === 'S-2' && !found.impact.length, found);
  await compare('S-1', 'S-2');
  found = await until((value) => value.title === 'Recipes: S-1 to S-2');
  check('a change that no record uses shows that no record depends on it', found.none === 'No record depends on the changed records.' && !found.impact.length
    && found.diff.some((item) => item.includes('Flatbread') && item.includes('Added')), found);
  const readOnly = await evaluate(session, sessionId, `(async () => {
    const { SnapshotApi } = await import('/examples/tables/snapshots-api.js');
    return { methods: Object.getOwnPropertyNames(SnapshotApi.prototype).sort(),
      controls: document.querySelectorAll('mu-action-button, mu-editable-form, mu-form-card, mu-upload, form, textarea, input').length, actions: window.muActions };
  })()`);
  check('the example only reads: the API has read methods only, the page has no action control, and no action is sent',
    readOnly.methods.join(',') === 'collections,compare,constructor,impact,snapshots' && readOnly.controls === 0 && readOnly.actions === 0, readOnly);
  return results;
}
