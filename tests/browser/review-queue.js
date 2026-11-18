// The flow of examples/tables/review-queue.html against its fixture API, examples/tables/review-queue-api.js. The API runs in the
// page, so the check needs no server. The page acts as the application, and the fixture API decides each action.
// tools/browser_check.mjs imports this check in Node and runs it in headless Chrome.
export async function reviewQueueChecks(session, sessionId, base, { evaluate, open, sleep }) {
  const page = 'examples/tables/review-queue.html';
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  await open(session, sessionId, `${base}/${page}`);
  const read = () => evaluate(session, sessionId, `(() => {
    const table = document.querySelector('mu-table');
    const form = document.querySelector('mu-editable-form');
    const field = form?.shadowRoot.querySelector('[data-state]');
    const buttons = Object.fromEntries([...document.querySelectorAll('mu-action-button')].map((item) => [item.fill.data.label,
      item.dataset.state + '|' + item.shadowRoot.querySelector('.status').textContent]));
    return { rows: table ? [...table.shadowRoot.querySelectorAll('tbody tr')].map((row) => [...row.cells].map((cell) => cell.textContent).join(' / ')) : null,
      picks: [...document.querySelectorAll('.queue-picks button')].map((item) => item.textContent),
      heading: document.querySelector('#detail h2')?.textContent ?? '',
      marked: document.querySelector('mu-excerpt')?.shadowRoot.querySelector('mark')?.textContent ?? '',
      input: field?.shadowRoot.querySelector('input[type="text"]')?.value ?? null,
      form: form ? { state: form.dataset.state, status: form.shadowRoot.querySelector('.status').textContent,
        problem: field?.shadowRoot.querySelector('[part="reason"]')?.textContent ?? '' } : null,
      buttons, decision: document.getElementById('decision')?.textContent ?? '',
      diff: document.querySelector('mu-diff')?.shadowRoot.textContent ?? '',
      empty: document.querySelector('#main > section p')?.textContent ?? '' };
  })()`);
  const until = async (test) => {
    let found = await read();
    for (let i = 0; i < 100 && !test(found); i += 1) { await sleep(30); found = await read(); }
    return found;
  };
  const act = (expression) => evaluate(session, sessionId, `(() => { ${expression} return true; })()`);
  const pick = (index) => act(`document.querySelectorAll('.queue-picks button')[${index}].click();`);
  const press = (label) => act(`[...document.querySelectorAll('mu-action-button')].find((item) => item.fill.data.label === '${label}').shadowRoot.querySelector('button').click();`);
  const edit = (value, type) => act(`
    const form = document.querySelector('mu-editable-form');
    const field = form.shadowRoot.querySelector('[data-state]');
    const input = field.shadowRoot.querySelector('input[type="text"]');
    input.value = '${value}';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    ${type ? `field.shadowRoot.querySelector('input[type="radio"][value="${type}"]').click();` : ''}
    form.shadowRoot.querySelector('form').requestSubmit();`);

  let found = await until((value) => value.rows?.length === 3);
  check('the table lists the 3 open tasks of the fixture API', found.rows?.length === 3 && found.rows[0] === 'R-101 / Invoice total / 114 / Synthetic invoice 2041', found.rows);
  await pick(0);
  found = await read();
  check('the source excerpt shows next to the extracted value', found.heading === 'Task R-101: Invoice total' && found.marked === '144.00' && found.input === '114', found);

  await press('Accept');
  found = await read();
  check('Accept shows Pending before the receipt, and the table has not changed', found.buttons.Accept === 'pending|Pending' && found.rows.length === 3 && !found.decision, found);
  found = await until((value) => value.buttons.Accept.startsWith('error'));
  check('the service refuses a value that is not in the source, and the page shows Not done',
    found.buttons.Accept === 'error|Not done: The value is not in the source. Correct it or reject it.' && found.rows.length === 3 && !found.decision, found);

  await edit('144', null);
  found = await read();
  check('a changed value with no edit type sends no action', found.form.state === 'default' && found.form.problem === 'Choose an edit type.' && !found.decision, found);
  await edit('144', 'correction');
  found = await read();
  check('a correction shows Pending before the receipt', found.form.state === 'pending' && !found.diff && found.rows.length === 3, found);
  found = await until((value) => value.form.state === 'done');
  check('the correction shows Done only after the receipt, with its edit type and reference', found.form.state === 'done'
    && found.form.status === 'Done: The service saved the value as a correction.Reference: RV-0001', found.form);
  found = await until((value) => value.decision && value.rows.length === 2);
  check('the queue drops the task, and the diff shows the old value and the new value', found.rows.join('|') === 'R-102 / Street name / Harbor Road / Synthetic delivery note 88|R-103 / Due date / 2026-12-15 / Synthetic invoice 2041'
    && found.decision === 'R-101: Corrected. Reference: RV-0001.' && found.diff.includes('Extracted: 114') && found.diff.includes('Corrected: 144') && found.diff.includes('Corrected: correction'), found);

  await pick(0);
  await press('Accept');
  found = await until((value) => value.buttons.Accept.startsWith('done'));
  check('Accept shows Done after the receipt for a value that is in the source', found.buttons.Accept === 'done|Done: The service accepted the value.Reference: RV-0002', found.buttons);
  found = await until((value) => value.rows.length === 1);
  check('the accepted task leaves the queue', found.rows[0].startsWith('R-103') && found.decision === 'R-102: Accepted. Reference: RV-0002.' && !found.diff, found);

  await pick(0);
  await press('Reject');
  found = await until((value) => value.buttons.Reject.startsWith('done'));
  check('Reject shows Done after the receipt', found.buttons.Reject === 'done|Done: The service rejected the value.Reference: RV-0003', found.buttons);
  found = await until((value) => value.rows.length === 0);
  check('the queue is empty after the last decision', found.rows.length === 0 && found.empty === 'No open tasks.' && found.decision === 'R-103: Rejected. Reference: RV-0003.', found);
  return results;
}
