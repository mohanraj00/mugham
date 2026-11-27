// Expected roles, keys, markers and refusal texts come from catalog/data-grid.json and src/components/data-grid.md.
// tools/browser_check.mjs imports the keyboard checks in Node and loads this page in each media mode.
export async function dataGridKeyboardChecks(session, sessionId, { evaluate, key }, page) {
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const state = () => evaluate(session, sessionId, 'window.muGridState()');
  const press = async (name, code, text) => { await key(session, sessionId, name, name, code, text); return state(); };
  // The focus is on the first button of the page. The grid is the next Tab stop.
  let found = await press('Tab', 9);
  check('Tab moves the focus to the first cell', found.cell === 'rent kind', found);
  found = await press('ArrowRight', 39);
  check('ArrowRight moves to the next cell', found.cell === 'rent jan', found);
  found = await press('ArrowDown', 40);
  check('ArrowDown moves to the next row', found.cell === 'food jan', found);
  found = await press('End', 35);
  check('End moves to the last cell of the row', found.cell === 'food total', found);
  found = await press('Home', 36);
  check('Home moves to the first cell of the row', found.cell === 'food kind', found);
  found = await press('ArrowUp', 38);
  found = await press('ArrowRight', 39);
  check('ArrowUp and ArrowRight move back to the January cell of Rent', found.cell === 'rent jan', found);
  found = await press('Enter', 13, '\r');
  check('Enter opens the editor with the value', found.editor === '900' && found.requests === 0, found);
  for (const character of '1250') await key(session, sessionId, character, 'Digit' + character, 48 + Number(character), character);
  found = await press('Enter', 13, '\r');
  check('Enter saves the typed value and sends one action', found.editor === null && found.cell === 'rent jan'
    && found.requests === 1 && found.last === '{"row":"rent","column":"jan","value":1250,"budget_id":"B-7"}' && found.text === '1250Pending', found);
  found = await press('ArrowDown', 40);
  found = await press('7', 55, '7');
  check('A typed character opens the editor with that character', found.editor === '7' && found.cell === 'food jan', found);
  await key(session, sessionId, 'Escape', 'Escape', 27);
  // Headless Chrome marks the page hidden after an Escape key event. Show the page again before the next step.
  await session.send('Page.bringToFront', {}, sessionId);
  found = await state();
  check('Escape cancels the editor and keeps the focus on the cell', found.editor === null && found.cell === 'food jan'
    && found.text === '400' && found.requests === 1, found);
  found = await press('Tab', 9);
  check('Tab leaves the grid', found.cell === null, found);
  await evaluate(session, sessionId, 'window.muGridStall()');
  found = await press('Tab', 9);
  check('Tab reaches Retry below a stalled grid', found.focus === 'retry', found);
  found = await press('Tab', 9);
  check('Tab moves from Retry to Cancel', found.focus === 'cancel', found);
  await key(session, sessionId, ' ', 'Space', 32, ' ');
  found = await state();
  check('Space cancels the action and returns focus to the cell', found.cell === 'rent jan' && found.text === '1250Changed', found);
  return results;
}

// The budget example: an edit goes to the application, and the application sends the new total.
export async function budgetExampleChecks(session, sessionId, base, { evaluate, open, sleep, key }) {
  const page = 'examples/tables/budget.html';
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  await open(session, sessionId, `${base}/${page}`);
  const read = () => evaluate(session, sessionId, `(() => {
    const grid = document.querySelector('mu-data-grid');
    const lines = [...grid.shadowRoot.querySelectorAll('tbody tr')];
    return { rows: lines.length, columns: grid.shadowRoot.querySelectorAll('thead th').length, state: grid.dataset.state,
      food: lines[1].querySelector('td').textContent, total: lines[lines.length - 1].querySelector('td').textContent,
      status: grid.shadowRoot.querySelector('[part="status"]').textContent,
      focused: grid.shadowRoot.activeElement === lines[1].querySelector('td') };
  })()`);
  const settled = async () => {
    let found = await read();
    for (let i = 0; i < 40 && found.state === 'pending'; i += 1) { await sleep(50); found = await read(); }
    return found;
  };
  const type = async (text) => {
    for (const character of text) await key(session, sessionId, character, character === '-' ? 'Minus' : 'Digit' + character, character.charCodeAt(0), character);
    await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  };
  let found = await read();
  check('the budget has 6 rows, a total row and 4 month columns', found.rows === 7 && found.columns === 4 && found.food === '410' && found.total === '1575', found);
  await evaluate(session, sessionId, `document.querySelector('mu-data-grid').shadowRoot.querySelectorAll('tbody tr')[1].querySelector('td').focus(), true`);
  await type('500');
  found = await read();
  check('a saved amount shows Pending until the receipt', found.food === '500Pending' && found.state === 'pending' && found.total === '1575', found);
  found = await settled();
  check('after the receipt the application sends the new total and the focus stays', found.food === '500' && found.total === '1665'
    && found.state === 'default' && found.focused, found);
  await type('-5');
  found = await settled();
  check('the application refuses an amount and the cell shows Not done', found.food === '-5Not done' && found.state === 'error'
    && found.status === 'Not done: Food, January. Give an amount from 0 to 100000.' && found.total === '1665', found);
  return results;
}

async function browserChecks() {
  const { MuDataGrid } = await import('../../src/components/data-grid.js');
  const { define } = await import('../../src/thread/index.js');
  const { CATALOG } = await import('../../src/render/catalog.js');
  define();

  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const AUTHOR = { type: 'agent', id: 'agent-budget', name: 'Budget helper' };
  const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
  // The application binds the tool, and the key, the label and the type of each row and column that a person can edit.
  const BINDING = { tool: 'budget.set_cell', arguments: { budget_id: 'B-7' }, title: 'Synthetic budget', rows: { rent: 'Rent', food: 'Food' },
    columns: { kind: { label: 'Kind', type: 'choice', choices: ['Fixed', 'Variable'] }, jan: { label: 'January', type: 'number' },
      due: { label: 'Due date', type: 'date' }, note: { label: 'Note', type: 'text' } } };
  const node = (component, data) => ({ component, version: '0.1.0', data });
  const column = (key, label, type, more = {}) => node('data-grid-column', { key, label, type, ...more });
  const cell = (type, value, more = {}) => node(`${type}-cell`, value === undefined ? more : { value, ...more });
  const row = (key, label, ...cells) => node('data-grid-row', { key, label, cells });
  const fill = (data) => ({ component: 'data-grid', version: '0.1.0', data, slots: { authorship: AUTHOR } });
  const COLUMNS = [column('kind', 'Kind', 'choice', { choices: ['Fixed', 'Variable'] }), column('jan', 'January', 'number'),
    column('due', 'Due date', 'date'), column('note', 'Note', 'text'), column('total', 'Total', 'number', { read_only: true })];
  const locked = { read_only: true };
  const budget = (rent = 900, total = 1300) => fill({ label: 'Synthetic budget', columns: COLUMNS, rows: [
    row('rent', 'Rent', cell('choice', 'Fixed'), cell('number', rent), cell('date', '2026-12-01'), cell('text', 'Paid by transfer'), cell('number', rent)),
    row('food', 'Food', cell('choice', 'Variable'), cell('number', 400), cell('date'), cell('text'), cell('number', 400)),
    row('total', 'Total', cell('choice', undefined, locked), cell('number', total, locked), cell('date', undefined, locked), cell('text', undefined, locked), cell('number', total)),
  ] });
  const stage = document.getElementById('stage');
  const root = (element) => element.shadowRoot;
  const tick = () => new Promise((done) => setTimeout(done, 0));
  const waitFor = async (test) => {
    for (let i = 0; i < 100; i += 1) {
      if (test()) return true;
      await new Promise((done) => setTimeout(done, 20));
    }
    return false;
  };
  const refusal = (element) => (element.dataset.state === 'refused' ? root(element).querySelector('[part="details"] > div')?.textContent : null);
  const thrown = (act) => { try { act(); return ''; } catch (error) { return `${error.name}: ${error.message}`; } };
  function mount(value, binding = BINDING, parent = stage) {
    const element = new MuDataGrid();
    element.actor = AUTHOR;
    if (binding) element.action = binding;
    element.requests = [];
    element.addEventListener('mu-action', (event) => element.requests.push(event.detail));
    parent.append(element);
    element.fill = value;
    return element;
  }
  // The cell of a row key and a column key, by its place in the grid.
  const at = (element, rowKey, columnKey) => {
    const data = element.fill.data;
    const line = root(element).querySelectorAll('tbody tr')[data.rows.findIndex((item) => item.data.key === rowKey)];
    return line.querySelectorAll('td')[data.columns.findIndex((item) => item.data.key === columnKey)];
  };
  const active = (element) => root(element).activeElement;
  const where = (element) => {
    const td = active(element)?.closest('td');
    if (!td) return null;
    const data = element.fill.data;
    const line = td.parentElement;
    return data.rows[[...line.parentElement.children].indexOf(line)].data.key + ' ' + data.columns[[...line.querySelectorAll('td')].indexOf(td)].data.key;
  };
  const press = (element, name, more = {}) => active(element).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));
  const editor = (element) => root(element).querySelector('input');
  const status = (element) => root(element).querySelector('[part="status"]').textContent;
  // Opens the editor of a cell, types the text and presses Enter.
  const edit = (element, rowKey, columnKey, text) => {
    at(element, rowKey, columnKey).focus();
    press(element, 'Enter');
    editor(element).value = text;
    press(element, 'Enter');
  };
  const last = (element) => element.requests[element.requests.length - 1];
  const answer = (element, ok = true, more = {}) => element.receipt({ id: last(element).id, ok, ...more });

  // The grid has the roles of the ARIA grid pattern. Each header and each value is text.
  const grid = mount(budget());
  const table = root(grid).querySelector('table');
  check('grid: the fill is valid', grid.dataset.state === 'default' && grid.fill !== null, root(grid).textContent);
  check('grid: the title of the application shows above the grid', root(grid).querySelector('[part="title"]')?.textContent === 'Synthetic budget'
    && getComputedStyle(root(grid).querySelector('[part="title"]')).display !== 'none');
  check('grid: the group and the grid have the label', root(grid).querySelector('[part="data-grid"]')?.getAttribute('aria-label') === 'Synthetic budget'
    && table.getAttribute('role') === 'grid' && table.getAttribute('aria-label') === 'Synthetic budget' && table.getAttribute('aria-readonly') === 'false');
  check('grid: each column has a column header', [...table.querySelectorAll('thead th[scope="col"]')].map((item) => item.textContent).join('|')
    === 'Kind|January|Due date|Note|Total');
  check('grid: each row has a row header', [...table.querySelectorAll('tbody th[scope="row"]')].map((item) => item.textContent).join('|') === 'Rent|Food|Total');
  check('grid: each row has one cell for each column', table.querySelectorAll('tbody td').length === 15);
  check('grid: each value shows as text', [...table.querySelectorAll('tbody tr:first-child td')].map((item) => item.textContent).join('|')
    === 'Fixed|900|2026-12-01|Paid by transfer|900' && at(grid, 'food', 'due').textContent === '');
  check('grid: one cell has the Tab stop', table.querySelectorAll('td[tabindex="0"]').length === 1 && at(grid, 'rent', 'kind').tabIndex === 0
    && table.querySelectorAll('tbody td[tabindex="-1"]').length === 14);
  check('grid: a read-only column and a read-only cell are read-only', at(grid, 'rent', 'total').getAttribute('aria-readonly') === 'true'
    && at(grid, 'total', 'jan').getAttribute('aria-readonly') === 'true' && at(grid, 'rent', 'jan').getAttribute('aria-readonly') === 'false');
  check('grid: the author shows as text', root(grid).querySelector('[part="authorship"]')?.textContent === 'Author: agent agent-budget (Budget helper)');
  check('grid: a number cell aligns its text to the end', getComputedStyle(at(grid, 'rent', 'jan')).textAlign === 'end');

  // Keyboard: the arrow keys, Home and End move the focus and the Tab stop.
  at(grid, 'rent', 'kind').focus();
  const moves = [['ArrowRight', {}, 'rent jan'], ['ArrowDown', {}, 'food jan'], ['ArrowLeft', {}, 'food kind'], ['ArrowLeft', {}, 'food kind'],
    ['ArrowUp', {}, 'rent kind'], ['ArrowUp', {}, 'rent kind'], ['End', {}, 'rent total'], ['ArrowRight', {}, 'rent total'], ['Home', {}, 'rent kind'],
    ['End', { ctrlKey: true }, 'total total'], ['ArrowDown', {}, 'total total'], ['Home', { ctrlKey: true }, 'rent kind']];
  for (const [name, more, expected] of moves) {
    press(grid, name, more);
    check(`keyboard: ${more.ctrlKey ? 'Control+' : ''}${name} gives ${expected}`, where(grid) === expected && active(grid).tabIndex === 0
      && table.querySelectorAll('td[tabindex="0"]').length === 1, where(grid));
  }

  // Enter opens the editor with the value. Escape cancels. Enter saves and sends one action.
  at(grid, 'rent', 'jan').focus();
  press(grid, 'Enter');
  check('editor: Enter opens the editor with the value', editor(grid)?.value === '900' && active(grid) === editor(grid)
    && editor(grid).getAttribute('aria-label') === 'Rent, January' && editor(grid).selectionEnd === 3);
  editor(grid).value = '950';
  press(grid, 'Escape');
  check('editor: Escape cancels and the focus goes back to the cell', !editor(grid) && where(grid) === 'rent jan'
    && at(grid, 'rent', 'jan').textContent === '900' && grid.requests.length === 0);
  press(grid, '1');
  check('editor: a typed character opens the editor with that character', editor(grid)?.value === '1' && active(grid) === editor(grid));
  press(grid, 'Escape');
  press(grid, 'a', { ctrlKey: true });
  check('editor: a key with Control opens no editor', !editor(grid));
  edit(grid, 'rent', 'jan', '900');
  check('editor: a save of the same value sends no action', grid.requests.length === 0 && grid.dataset.state === 'default' && !editor(grid));
  edit(grid, 'rent', 'jan', ' 1250 ');
  const request = last(grid);
  check('action: a saved change sends one action with the row, the column and the value', grid.requests.length === 1
    && request.tool === 'budget.set_cell' && JSON.stringify(request.arguments) === '{"row":"rent","column":"jan","value":1250,"budget_id":"B-7"}'
    && typeof request.id === 'string' && Object.isFrozen(request), JSON.stringify(request));
  check('action: the changed cell shows Pending and the focus stays on it', at(grid, 'rent', 'jan').textContent === '1250Pending'
    && at(grid, 'rent', 'jan').querySelector('[part="changed"]')?.textContent === 'Pending' && grid.dataset.state === 'pending'
    && grid.action.state === 'pending' && where(grid) === 'rent jan');
  // A second change waits for the receipt of the first change.
  edit(grid, 'food', 'jan', '450');
  check('action: a change during a pending request shows Changed and waits', grid.requests.length === 1
    && at(grid, 'food', 'jan').textContent === '450Changed' && at(grid, 'food', 'jan').dataset.state === 'changed');
  check('receipt: a receipt with a different id changes nothing', grid.receipt({ id: 'other', ok: true }) === false
    && at(grid, 'rent', 'jan').textContent === '1250Pending' && grid.requests.length === 1);
  check('receipt: the receipt of the request is accepted', answer(grid) === true);
  check('receipt: the marker goes away only after the receipt', at(grid, 'rent', 'jan').textContent === '1250'
    && at(grid, 'rent', 'jan').dataset.state === 'default' && !at(grid, 'rent', 'jan').querySelector('[part="changed"]'));
  check('receipt: the next change goes in the next request', grid.requests.length === 2 && last(grid).arguments.row === 'food'
    && last(grid).arguments.value === 450 && at(grid, 'food', 'jan').textContent === '450Pending' && grid.dataset.state === 'pending');
  answer(grid, false, { message: 'The month is closed.' });
  check('receipt: a refusal of the API shows Not done and the reason', at(grid, 'food', 'jan').textContent === '450Not done'
    && grid.dataset.state === 'error' && status(grid) === 'Not done: Food, January. The month is closed.'
    && root(grid).querySelector('[part="status"]').classList.contains('error'));
  edit(grid, 'food', 'jan', '450');
  check('receipt: a save of the same value sends the change again', grid.requests.length === 3 && last(grid).arguments.value === 450
    && at(grid, 'food', 'jan').textContent === '450Pending' && grid.dataset.state === 'pending');
  answer(grid, false);
  edit(grid, 'food', 'jan', '400');
  check('a change back to the confirmed value removes the marker and sends no action', grid.requests.length === 3
    && at(grid, 'food', 'jan').textContent === '400' && grid.dataset.state === 'default');

  // More than one change of one cell before the receipt: the last saved value is the value that stays.
  const quick = mount(budget());
  edit(quick, 'rent', 'jan', '1000');
  const beforeReceipt = last(quick);
  edit(quick, 'rent', 'jan', '1100');
  edit(quick, 'rent', 'jan', '900');
  check('quick changes: a change back to the old value stays while a request of the cell is pending', quick.requests.length === 1
    && at(quick, 'rent', 'jan').textContent === '900Changed' && quick.dataset.state === 'pending');
  answer(quick);
  check('quick changes: after the receipt the last saved value goes in the next request', quick.requests.length === 2
    && last(quick).key !== beforeReceipt.key && last(quick).arguments.value === 900
    && at(quick, 'rent', 'jan').textContent === '900Pending' && status(quick) === '');
  answer(quick);
  check('quick changes: the cell shows the last saved value', at(quick, 'rent', 'jan').textContent === '900' && quick.dataset.state === 'default'
    && quick.requests.length === 2);
  edit(quick, 'rent', 'jan', '1000');
  edit(quick, 'rent', 'jan', '900');
  answer(quick, false, { message: 'The month is closed.' });
  check('quick changes: after a refusal a change back to the confirmed value sends no request', quick.requests.length === 3
    && at(quick, 'rent', 'jan').textContent === '900' && quick.dataset.state === 'default');
  edit(quick, 'food', 'jan', '500');
  edit(quick, 'food', 'jan', '600');
  edit(quick, 'food', 'jan', '500');
  answer(quick);
  check('quick changes: a change to the value that the receipt confirmed sends no request', quick.requests.length === 4
    && at(quick, 'food', 'jan').textContent === '500' && quick.dataset.state === 'default');

  const paused = mount(budget());
  edit(paused, 'rent', 'jan', '950');
  edit(paused, 'food', 'jan', '450');
  const pausedSent = last(paused);
  paused.noReceipt(pausedSent.id);
  const oldRetry = root(paused).querySelector('[part="retry"]');
  paused.fill = fill({ ...budget().data, columns: [] });
  oldRetry.click();
  const accepted = paused.receipt({ id: pausedSent.id, ok: true });
  const settled = await waitFor(() => paused.action.state !== 'pending' || paused.requests.length > 1);
  check('a refused grid accepts a receipt and sends no saved edit or retry', settled && accepted
    && paused.dataset.state === 'refused' && paused.requests.length === 1, paused.requests.length);
  paused.fill = budget();
  const resumed = await waitFor(() => paused.requests.length > 1);
  check('a valid fill resumes a saved change', resumed && paused.requests.length === 2 && last(paused).arguments.row === 'food'
    && last(paused).arguments.value === 450 && at(paused, 'food', 'jan').textContent === '450Pending', paused.requests.length);
  if (resumed) answer(paused);

  // A new fill can make a cell read-only while its request is pending. The marker stays until the receipt.
  const lockedRent = (rent = 900) => { const value = budget(rent); value.data.rows[0].data.cells[1].data.read_only = true; return value; };
  const held = mount(budget());
  edit(held, 'rent', 'jan', '950');
  edit(held, 'food', 'jan', '450');
  held.fill = lockedRent();
  await tick();
  check('read-only during a request: the cell keeps its value and Pending', at(held, 'rent', 'jan').textContent === '950Pending'
    && at(held, 'rent', 'jan').getAttribute('aria-readonly') === 'true' && held.dataset.state === 'pending' && held.requests.length === 1);
  answer(held, false, { message: 'The month is closed.' });
  check('read-only during a request: a refused receipt shows Not done on the cell', at(held, 'rent', 'jan').textContent === '950Not done'
    && held.requests.length === 2 && last(held).arguments.row === 'food');
  answer(held);
  check('read-only during a request: the state of the grid is error', held.dataset.state === 'error' && at(held, 'food', 'jan').textContent === '450');
  held.fill = lockedRent();
  await tick();
  check('read-only during a request: the same data keeps Not done', at(held, 'rent', 'jan').textContent === '950Not done');
  held.fill = lockedRent(901);
  await tick();
  check('read-only during a request: new data of the application replaces the value that is not done', at(held, 'rent', 'jan').textContent === '901'
    && held.dataset.state === 'default', at(held, 'rent', 'jan').textContent + ' ' + held.dataset.state);
  edit(held, 'food', 'jan', '460');
  held.fill = (() => { const value = budget(); value.data.columns = COLUMNS.map((item, index) => (index === 1 ? column('jan', 'January', 'number', { read_only: true }) : item)); return value; })();
  await tick();
  check('read-only during a request: a read-only column also keeps Pending', at(held, 'food', 'jan').textContent === '460Pending' && held.dataset.state === 'pending');
  answer(held);
  check('read-only during a request: a receipt with ok removes the marker', at(held, 'food', 'jan').textContent === '460' && held.dataset.state === 'default');
  edit(held, 'rent', 'due', '2027-02-01');
  edit(held, 'rent', 'note', 'Late');
  held.fill = (() => { const value = budget(); value.data.rows[0].data.cells[3].data.read_only = true; return value; })();
  await tick();
  check('read-only during a request: a change with no request does not stay on a read-only cell', at(held, 'rent', 'note').textContent === 'Paid by transfer'
    && at(held, 'rent', 'due').textContent === '2027-02-01Pending');
  answer(held);
  check('read-only during a request: no request has the change of the read-only cell', held.requests.length === 4 && held.dataset.state === 'default');

  // The grid refuses a value of the wrong type and shows the reason as text. The editor stays open.
  const REASONS = [['jan', 'twelve', 'Give a number, for example 12 or 12.5.'], ['due', '2026-02-30', 'Give a date that exists, as YYYY-MM-DD, for example 2026-12-01.'],
    ['due', '12/01/2026', 'Give a date that exists, as YYYY-MM-DD, for example 2026-12-01.'], ['kind', 'Other', 'Give one of these choices: Fixed, Variable.'],
    ['note', 'x'.repeat(501), 'Give a text of 500 characters at most.']];
  for (const [key, text, reason] of REASONS) {
    const before = grid.requests.length;
    edit(grid, 'rent', key, text);
    check(`wrong type: ${key} refuses ${text.slice(0, 12)}`, editor(grid)?.getAttribute('aria-invalid') === 'true' && active(grid) === editor(grid)
      && status(grid) === reason && editor(grid).getAttribute('aria-describedby') === root(grid).querySelector('[part="status"]').id
      && grid.requests.length === before, status(grid));
    press(grid, 'Escape');
  }
  const VALID = [['due', '2027-01-15', '2027-01-15'], ['kind', 'Variable', 'Variable'], ['note', ' Paid in cash ', ' Paid in cash '], ['jan', '12.5', 12.5], ['note', '', '']];
  for (const [key, text, value] of VALID) {
    edit(grid, 'rent', key, text);
    check(`right type: ${key} accepts ${JSON.stringify(text)}`, last(grid).arguments.column === key && last(grid).arguments.value === value, JSON.stringify(last(grid).arguments));
    answer(grid);
  }
  check('each change has its own request id', new Set(grid.requests.map((item) => item.id)).size === grid.requests.length);
  // A choice editor tells the choices. The arrow keys give the next and the previous choice.
  at(grid, 'food', 'kind').focus();
  press(grid, 'Enter');
  check('choice: the editor tells the choices', status(grid) === 'Choices: Fixed, Variable.' && editor(grid).value === 'Variable');
  press(grid, 'ArrowDown');
  const down = editor(grid).value;
  press(grid, 'ArrowUp');
  check('choice: ArrowDown and ArrowUp give the next and the previous choice', down === 'Fixed' && editor(grid).value === 'Variable' && where(grid) === 'food kind');
  press(grid, 'Escape');
  // A choice is exact text. A choice with a space at its start or its end stays as it is.
  const SPACED = ['Fixed', ' Fixed ', ' Open'];
  const spaced = mount(fill({ label: 'Synthetic budget', columns: [column('kind', 'Kind', 'choice', { choices: SPACED })],
    rows: [row('rent', 'Rent', cell('choice', 'Fixed'))] }), { ...BINDING, columns: { kind: { label: 'Kind', type: 'choice', choices: SPACED } } });
  edit(spaced, 'rent', 'kind', ' Fixed ');
  check('choice: a choice with spaces is saved as the exact text', last(spaced).arguments.value === ' Fixed ', JSON.stringify(last(spaced)?.arguments));
  answer(spaced);
  edit(spaced, 'rent', 'kind', 'Fixed  ');
  check('choice: a typed text with more spaces gives the choice that agrees without them', last(spaced).arguments.value === 'Fixed' && spaced.requests.length === 2);
  answer(spaced);
  at(spaced, 'rent', 'kind').focus();
  press(spaced, 'Enter');
  press(spaced, 'ArrowDown');
  press(spaced, 'Enter');
  check('choice: the arrow keys save the exact choice', last(spaced).arguments.value === ' Fixed ' && spaced.requests.length === 3);
  answer(spaced);
  at(spaced, 'rent', 'kind').focus();
  press(spaced, 'Enter');
  press(spaced, 'ArrowDown');
  const third = editor(spaced).value;
  press(spaced, 'ArrowDown');
  const again = editor(spaced).value;
  press(spaced, 'ArrowUp');
  press(spaced, 'ArrowUp');
  check('choice: the arrow keys go through choices that differ only by spaces', third === ' Open' && again === 'Fixed' && editor(spaced).value === ' Fixed ',
    JSON.stringify([third, again, editor(spaced).value]));
  press(spaced, 'Escape');
  edit(spaced, 'rent', 'kind', 'Open');
  check('choice: a typed text that differs from one choice only by spaces gives that choice', last(spaced).arguments.value === ' Open' && spaced.requests.length === 4);
  answer(spaced);
  edit(spaced, 'rent', 'kind', 'Closed');
  check('choice: a text that is not a choice is refused', status(spaced) === 'Give one of these choices: Fixed,  Fixed ,  Open.' && spaced.requests.length === 4, status(spaced));
  press(spaced, 'Escape');
  // A read-only cell opens no editor.
  at(grid, 'total', 'jan').focus();
  press(grid, 'Enter');
  check('read-only: Enter opens no editor and the reason shows', !editor(grid) && status(grid) === 'This cell is read-only.');
  press(grid, '5');
  check('read-only: a typed character opens no editor', !editor(grid) && at(grid, 'total', 'jan').textContent === '1300');
  // A pointer: the first click moves the focus, and a click on the focused cell opens the editor.
  const click = (td) => { td.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); td.focus(); td.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
  click(at(grid, 'food', 'note'));
  check('pointer: the first click moves the focus and opens no editor', where(grid) === 'food note' && !editor(grid) && at(grid, 'food', 'note').tabIndex === 0);
  click(at(grid, 'food', 'note'));
  check('pointer: a click on the focused cell opens the editor', editor(grid) !== null && active(grid) === editor(grid));
  // The focus leaves the editor: a valid value is saved, and a value that is not valid is not saved.
  editor(grid).value = 'Market';
  at(grid, 'rent', 'kind').focus();
  check('blur: a valid value is saved', last(grid).arguments.column === 'note' && last(grid).arguments.value === 'Market' && where(grid) === 'rent kind');
  answer(grid);
  at(grid, 'food', 'jan').focus();
  press(grid, 'Enter');
  editor(grid).value = 'many';
  const count = grid.requests.length;
  at(grid, 'rent', 'kind').focus();
  check('blur: a value that is not valid is not saved and the reason shows', grid.requests.length === count && at(grid, 'food', 'jan').textContent === '400'
    && status(grid) === 'Not saved. Give a number, for example 12 or 12.5.' && !editor(grid));

  // New values from the application show, and the focus stays on the same cell.
  const live = mount(budget());
  at(live, 'food', 'jan').focus();
  edit(live, 'rent', 'jan', '1000');
  answer(live);
  at(live, 'food', 'jan').focus();
  live.fill = budget(1000, 1400);
  await tick();
  check('new values: the application sends a new total and the grid shows it', at(live, 'total', 'jan').textContent === '1400'
    && at(live, 'rent', 'jan').textContent === '1000' && at(live, 'rent', 'total').textContent === '1000');
  check('new values: the focus stays on the same cell', where(live) === 'food jan' && active(live).localName === 'td' && active(live).tabIndex === 0);
  press(live, 'Enter');
  editor(live).value = '47';
  live.fill = budget(1000, 1401);
  await tick();
  check('new values: an open editor keeps its text', editor(live)?.value === '47' && active(live) === editor(live) && where(live) === 'food jan'
    && at(live, 'total', 'jan').textContent === '1401' && live.requests.length === 1);
  press(live, 'Enter');
  check('new values: the kept editor saves', last(live).arguments.row === 'food' && last(live).arguments.value === 47);
  live.fill = budget(1000, 1402);
  await tick();
  check('new values: a pending change keeps its value and its marker', at(live, 'food', 'jan').textContent === '47Pending' && live.dataset.state === 'pending');
  answer(live);
  check('new values: the receipt removes the marker after new data', at(live, 'food', 'jan').textContent === '47' && live.dataset.state === 'default');
  live.fill = budget(1000, 1403);
  await tick();
  check('new values: the data of the application replaces a confirmed value', at(live, 'food', 'jan').textContent === '400');

  // Markup in each header and each cell shows as text and makes no element.
  const marked = mount(fill({ label: MARKUP.slice(0, 120), columns: [column('a', MARKUP.slice(0, 80), 'text'), column('b', MARKUP.slice(0, 80), 'choice', { choices: [MARKUP.slice(0, 80)] })],
    rows: [row('r', MARKUP.slice(0, 80), cell('text', MARKUP), cell('choice', MARKUP.slice(0, 80)))] }),
  { tool: 'budget.set_cell', title: MARKUP.slice(0, 120), rows: { r: MARKUP.slice(0, 80) }, columns: { a: { label: MARKUP.slice(0, 80), type: 'text' },
    b: { label: MARKUP.slice(0, 80), type: 'choice', choices: [MARKUP.slice(0, 80)] } } });
  check('markup: each header and each cell shows as text', marked.dataset.state === 'default'
    && root(marked).querySelector('thead th').textContent === MARKUP.slice(0, 80) && root(marked).querySelector('tbody th').textContent === MARKUP.slice(0, 80)
    && at(marked, 'r', 'a').textContent === MARKUP && at(marked, 'r', 'b').textContent === MARKUP.slice(0, 80));
  edit(marked, 'r', 'a', MARKUP + '!');
  at(marked, 'r', 'b').focus();
  press(marked, 'Enter');
  check('markup: a typed value, the editor and the status show as text', at(marked, 'r', 'a').textContent === MARKUP + '!Pending'
    && last(marked).arguments.value === MARKUP + '!' && status(marked) === `Choices: ${MARKUP.slice(0, 80)}.`);
  check('markup: no element and no handler appears', !root(marked).querySelector('img, script, a, [href], [src], [style], [onerror]') && window.muUnsafe === undefined);
  press(marked, 'Escape');
  marked.receipt({ id: last(marked).id, ok: false, message: MARKUP });
  check('markup: a receipt message shows as text', status(marked).endsWith(MARKUP) && !root(marked).querySelector('img, script') && window.muUnsafe === undefined);

  // The element refuses data that the contract format cannot check.
  const base = budget().data;
  const REFUSED = [
    [{ ...base, columns: [] , rows: [] }, 'data.columns: at least one column is necessary'],
    [{ ...base, columns: [COLUMNS[1], COLUMNS[1], ...COLUMNS.slice(2)] }, 'data.columns[1].data.key: two columns have the same key'],
    [{ ...base, columns: [column('kind', 'Kind', 'choice'), ...COLUMNS.slice(1)] }, 'data.columns[0].data.choices: a choice column needs its choices'],
    [{ ...base, columns: [column('kind', 'Kind', 'choice', { choices: [] }), ...COLUMNS.slice(1)] }, 'data.columns[0].data.choices: a choice column needs its choices'],
    [{ ...base, columns: [column('kind', 'Kind', 'choice', { choices: ['Fixed', 'Fixed'] }), ...COLUMNS.slice(1)] }, 'data.columns[0].data.choices: two choices are the same'],
    [{ ...base, columns: [COLUMNS[0], column('jan', 'January', 'number', { choices: ['1'] }), ...COLUMNS.slice(2)] }, 'data.columns[1].data.choices: only a choice column has choices'],
    [{ ...base, rows: [base.rows[0], base.rows[0]] }, 'data.rows[1].data.key: two rows have the same key'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice', 'Fixed'))] }, 'data.rows[0].data.cells: the cell count must equal the column count'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice', 'Fixed'), cell('text', '900'), cell('date'), cell('text'), cell('number'))] }, 'data.rows[0].data.cells[1].component: must be number-cell'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice', 'Other'), cell('number'), cell('date'), cell('text'), cell('number'))] }, 'data.rows[0].data.cells[0].data.value: the value is not one of the choices'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice'), cell('number', '900'), cell('date'), cell('text'), cell('number'))] }, 'data.rows[0].data.cells[1].data.value: must be a number'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice'), cell('number'), cell('date', '2026-02-30'), cell('text'), cell('number'))] }, 'data.rows[0].data.cells[2].data.value: must be a date as YYYY-MM-DD'],
    [{ ...base, rows: [row('rent', 'Rent', cell('choice'), cell('number'), cell('date'), node('button', { label: 'x' }), cell('number'))] }, 'data.rows[0].data.cells[3].component: must be text-cell or number-cell or date-cell or choice-cell'],
    [{ ...base, formula: '=SUM(A1:A2)' }, 'data.formula: the contract does not declare this field'],
  ];
  for (const [data, reason] of REFUSED) {
    const bad = mount(fill(data));
    check(`refused: ${reason}`, refusal(bad) === 'data-grid: ' + reason && !root(bad).querySelector('table') && bad.fill === null, root(bad).textContent);
  }

  // The binding: the application gives only the tool and its arguments. With no binding, the grid is read-only.
  const unbound = mount(budget(), null);
  at(unbound, 'rent', 'jan').focus();
  press(unbound, 'Enter');
  check('binding: a grid with no binding is read-only and sends no action', unbound.dataset.state === 'disabled' && !editor(unbound)
    && root(unbound).querySelectorAll('td[aria-readonly="false"]').length === 0 && root(unbound).querySelector('table').getAttribute('aria-readonly') === 'true'
    && status(unbound) === 'This cell is read-only.' && unbound.requests.length === 0);
  press(unbound, 'ArrowRight');
  check('binding: the keys move the focus in a read-only grid', where(unbound) === 'rent due');
  unbound.action = BINDING;
  check('binding: a binding makes the cells editable', unbound.dataset.state === 'default' && at(unbound, 'rent', 'jan').getAttribute('aria-readonly') === 'false');
  const KEYS = 'a data grid accepts only tool, arguments, title, rows and columns';
  const TITLE = 'title must be the title of the grid, with 1 to 120 characters';
  const ROWS = 'rows must map each editable row key to its label';
  const COLUMN_RULE = 'columns must map each editable column key to its label and its type, with the choices of a choice column';
  for (const [name, binding, reason] of [['a label', { ...BINDING, label: 'Save' }, KEYS],
    ['an icon', { ...BINDING, icon: 'check' }, KEYS], ['a display', { ...BINDING, display: 'icon' }, KEYS],
    ['a confirm step', { ...BINDING, confirm: { message: 'Save?', label: 'Yes' } }, KEYS], ['editable names', { ...BINDING, editable: { value: 'Value' } }, KEYS],
    ['a bound row argument', { ...BINDING, arguments: { row: 'rent' } }, 'a bound argument cannot be editable: row'],
    ['no tool', { ...BINDING, tool: undefined }, 'the tool name is not valid'], ['a text', 'budget.set_cell', 'the action must be an object'],
    ['no title', { ...BINDING, title: undefined }, TITLE], ['an empty title', { ...BINDING, title: '' }, TITLE],
    ['a title of 121 characters', { ...BINDING, title: 'x'.repeat(121) }, TITLE], ['a title that is not text', { ...BINDING, title: 7 }, TITLE],
    ['no rows', { ...BINDING, rows: undefined }, ROWS], ['a list of rows', { ...BINDING, rows: ['rent'] }, ROWS],
    ['a row with no label', { ...BINDING, rows: { rent: '' } }, ROWS], ['a row label that is not text', { ...BINDING, rows: { rent: 7 } }, ROWS],
    ['no columns', { ...BINDING, columns: undefined }, COLUMN_RULE], ['a column with only a label', { ...BINDING, columns: { jan: 'January' } }, COLUMN_RULE],
    ['a column with a type that the grid does not have', { ...BINDING, columns: { jan: { label: 'January', type: 'formula' } } }, COLUMN_RULE],
    ['a choice column with no choices', { ...BINDING, columns: { kind: { label: 'Kind', type: 'choice' } } }, COLUMN_RULE],
    ['a number column with choices', { ...BINDING, columns: { jan: { label: 'January', type: 'number', choices: ['1'] } } }, COLUMN_RULE],
    ['a column with a different key', { ...BINDING, columns: { jan: { label: 'January', type: 'number', read_only: false } } }, COLUMN_RULE]]) {
    check(`binding: ${name} is refused`, thrown(() => { unbound.action = binding; }) === 'TypeError: action: ' + reason && unbound.action.state === 'default',
      thrown(() => { unbound.action = binding; }));
  }
  check('binding: a refused binding changes nothing', at(unbound, 'rent', 'jan').getAttribute('aria-readonly') === 'false' && unbound.dataset.state === 'default');
  edit(unbound, 'rent', 'jan', '901');
  unbound.action = { ...BINDING, arguments: { budget_id: 'B-8' } };
  check('binding: a new binding removes the changes of the old binding', at(unbound, 'rent', 'jan').textContent === '900' && unbound.dataset.state === 'default'
    && unbound.receipt({ id: last(unbound).id, ok: true }) === false);
  // The application gives the meaning of each key that a request sends. A fill cannot give a different label or type.
  const relabel = (change) => { const data = structuredClone(budget().data); change(data); return fill(data); };
  for (const [name, value, reason] of [
    ['a different label for the grid', relabel((data) => { data.label = 'Budget of a different group'; }), 'data.label: the label is not the title of the application'],
    ['a different label for a bound row', relabel((data) => { data.rows[0].data.label = 'Food'; }), 'data.rows[0].data.label: the label is not the label of the application'],
    ['a different label for a bound column', relabel((data) => { data.columns[1].data.label = 'February'; }), 'data.columns[1].data.label: the label is not the label of the application'],
    ['a different type for a bound column', relabel((data) => { data.columns[3].data.type = 'date'; for (const item of data.rows) item.data.cells[3] = cell('date'); }),
      'data.columns[3].data.type: the type is not the type of the application'],
    ['different choices for a bound column', relabel((data) => { data.columns[0].data.choices = ['Fixed', 'Variable', 'Other']; }),
      'data.columns[0].data.choices: the choices are not the choices of the application'],
    ['the choices of a bound column in a different order', relabel((data) => { data.columns[0].data.choices = ['Variable', 'Fixed']; }),
      'data.columns[0].data.choices: the choices are not the choices of the application'],
  ]) {
    const bad = mount(value);
    check(`policy: ${name} is refused`, refusal(bad) === 'data-grid: ' + reason && !root(bad).querySelector('table'), root(bad).textContent);
  }
  const extra = mount(relabel((data) => {
    data.columns.splice(4, 0, column('feb', 'January', 'number'));
    for (const item of data.rows) item.data.cells.splice(4, 0, cell('number', 1));
    data.rows.push(row('bonus', 'Rent', cell('choice', 'Fixed'), cell('number', 5), cell('date'), cell('text'), cell('number', 5), cell('number', 5)));
  }));
  check('policy: a row and a column that the application does not bind are read-only', extra.dataset.state === 'default'
    && at(extra, 'bonus', 'jan').getAttribute('aria-readonly') === 'true' && at(extra, 'rent', 'feb').getAttribute('aria-readonly') === 'true'
    && at(extra, 'rent', 'jan').getAttribute('aria-readonly') === 'false');
  at(extra, 'bonus', 'jan').focus();
  press(extra, 'Enter');
  press(extra, '7');
  at(extra, 'rent', 'feb').focus();
  press(extra, 'Enter');
  check('policy: a cell with a key that the application does not bind opens no editor and sends no action', !editor(extra)
    && status(extra) === 'This cell is read-only.' && extra.requests.length === 0);
  const proto = mount(relabel((data) => { data.rows.push(row('constructor', 'Rent', cell('choice'), cell('number', 5), cell('date'), cell('text'), cell('number', 5))); }));
  check('policy: a key with the name of an object member is not a bound key', at(proto, 'constructor', 'jan').getAttribute('aria-readonly') === 'true');
  const empty = mount(fill({ label: 'Synthetic budget', columns: COLUMNS, rows: [] }));
  check('empty: a grid with no rows shows a text', empty.dataset.state === 'empty' && root(empty).querySelector('[part="empty"]')?.textContent === 'No rows. Change the request, or try again later.'
    && root(empty).querySelectorAll('thead th').length === 5);
  const noActor = document.createElement('mu-data-grid');
  stage.append(noActor);
  noActor.fill = budget();
  check('author: a fill with no bound actor is refused', noActor.dataset.state === 'refused');
  const spoof = mount(budget());
  spoof.fill = { ...budget(), slots: { authorship: { type: 'human', id: 'person-check' } } };
  check('author: a different author is refused', spoof.dataset.state === 'refused');

  // A grid of 50 rows and 12 columns. The grid scrolls inside its own area, and the row headers stay in view.
  const MONTHS = Array.from({ length: 12 }, (_, index) => column(`m${index + 1}`, `Month ${index + 1}`, 'number'));
  const large = document.createElement('div');
  large.style.width = '320px';
  stage.append(large);
  const big = mount(fill({ label: 'Large synthetic budget', columns: MONTHS,
    rows: Array.from({ length: 50 }, (_, index) => row(`r${index + 1}`, `Line ${index + 1}`, ...MONTHS.map((_, month) => cell('number', index * 12 + month)))) }),
  { tool: 'budget.set_cell', title: 'Large synthetic budget', rows: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`r${index + 1}`, `Line ${index + 1}`])),
    columns: Object.fromEntries(MONTHS.map((item) => [item.data.key, { label: item.data.label, type: 'number' }])) }, large);
  const area = root(big).querySelector('[part="scroll"]');
  check('large: 50 rows and 12 columns show', root(big).querySelectorAll('tbody td').length === 600 && big.dataset.state === 'default');
  check('large: the grid scrolls inside its own area', area.scrollWidth > area.clientWidth && area.scrollHeight > area.clientHeight
    && area.getBoundingClientRect().width <= 320 && document.documentElement.scrollWidth <= document.documentElement.clientWidth, `${area.scrollWidth} ${area.clientWidth}`);
  at(big, 'r1', 'm1').focus();
  press(big, 'End', { ctrlKey: true });
  const corner = root(big).querySelector('thead td').getBoundingClientRect();
  const header = root(big).querySelector('tbody tr:last-child th').getBoundingClientRect();
  const focused = active(big).getBoundingClientRect();
  const box = area.getBoundingClientRect();
  check('large: Control+End moves to the last cell and the area scrolls to it', where(big) === 'r50 m12' && area.scrollLeft > 0 && area.scrollTop > 0
    && focused.right <= box.right + 1 && focused.bottom <= box.bottom + 1, `${focused.right} ${box.right}`);
  check('large: the row headers and the column headers stay in view', Math.abs(header.left - box.left) <= 2 && Math.abs(corner.top - box.top) <= 2
    && getComputedStyle(root(big).querySelector('tbody th')).position === 'sticky', `${header.left} ${box.left}`);
  press(big, 'Home');
  const first = active(big).getBoundingClientRect();
  check('large: a focused cell is not below the fixed row header', where(big) === 'r50 m1' && first.left >= header.right - 1, `${first.left} ${header.right}`);
  press(big, 'Home', { ctrlKey: true });
  const top = active(big).getBoundingClientRect();
  check('large: a focused cell is not below the fixed column header', where(big) === 'r1 m1' && top.top >= corner.bottom - 1, `${top.top} ${corner.bottom}`);
  edit(big, 'r25', 'm6', '77');
  check('large: an edit in the large grid sends its action', last(big).arguments.row === 'r25' && last(big).arguments.column === 'm6' && last(big).arguments.value === 77);

  // Tokens and media modes.
  const css = MuDataGrid.styles.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ');
  const declared = new Set(CATALOG['data-grid'].tokens.map((token) => '--mu-' + token.replaceAll('.', '-')));
  const used = new Set(css.match(/--mu-[a-z0-9-]+/g) ?? []);
  check('the styles use each declared token and no other token', [...used].every((token) => declared.has(token)) && used.size === declared.size,
    [...used].filter((token) => !declared.has(token)).join(' ') + ' | ' + [...declared].filter((token) => !used.has(token)).join(' '));
  const media = { dark: '(prefers-color-scheme: dark)', 'forced-colors': '(forced-colors: active)', 'reduced-motion': '(prefers-reduced-motion: reduce)' };
  if (media[mode]) check('media: the requested mode is active', matchMedia(media[mode]).matches);
  const probe = document.createElement('span');
  stage.append(probe);
  const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const done = mount(budget());
  edit(done, 'rent', 'jan', '901');
  answer(done, true, { reference: 'R-0001' });
  const doneStatus = root(done).querySelector('[part="status"]');
  const doneStyle = getComputedStyle(doneStatus);
  const doneColor = resolved(mode === 'forced-colors' ? 'CanvasText' : 'var(--mu-color-success)');
  const reference = root(done).querySelector('[part="reference"]');
  check('receipt: the done style, reference and copy control show below the grid',
    doneStatus.textContent === 'Done: Rent, January.' && doneStatus.checkVisibility()
    && doneStyle.color === doneColor && doneStyle.borderInlineStartColor === doneColor
    && reference?.textContent === 'Reference: R-0001' && reference.checkVisibility()
    && reference.parentElement.querySelector('[part="copy"]')?.checkVisibility());
  edit(done, 'rent', 'jan', '902');
  check('receipt: a new edit can go to the application after a receipt', done.requests.length === 2 && done.dataset.state === 'pending');
  // Each state in this mode: default, changed, pending, error, read-only and the open editor.
  const states = mount(budget());
  edit(states, 'rent', 'jan', '901');
  edit(states, 'food', 'jan', '401');
  edit(states, 'rent', 'note', 'Late');
  answer(states, false, { message: 'The month is closed.' });
  at(states, 'food', 'note').focus();
  press(states, 'Enter');
  const marker = (rowKey, columnKey) => at(states, rowKey, columnKey).querySelector('[part="changed"]');
  check(`${mode}: the states error, pending and changed show their text markers`, marker('rent', 'jan')?.textContent === 'Not done'
    && marker('food', 'jan')?.textContent === 'Pending' && marker('rent', 'note')?.textContent === 'Changed' && states.dataset.state === 'pending');
  check(`${mode}: each marker is visible text`, [marker('rent', 'jan'), marker('food', 'jan'), marker('rent', 'note')].every((item) => {
    const style = getComputedStyle(item);
    return style.display !== 'none' && style.visibility === 'visible' && item.getBoundingClientRect().height > 0;
  }));
  const cellStyle = getComputedStyle(at(states, 'rent', 'kind'));
  if (mode === 'forced-colors') {
    check('forced colors: the cells and the editor have system borders', cellStyle.borderBlockEndColor === resolved('CanvasText')
      && getComputedStyle(editor(states)).borderTopColor === resolved('CanvasText') && cellStyle.backgroundColor === resolved('Canvas'));
    check('forced colors: the markers and the read-only cells use CanvasText', getComputedStyle(marker('rent', 'jan')).color === resolved('CanvasText')
      && getComputedStyle(at(states, 'total', 'jan')).color === resolved('CanvasText'));
  } else {
    probe.style.color = 'var(--mu-color-danger)';
    check(`${mode}: the Not done marker has the danger color and the other markers do not`, getComputedStyle(marker('rent', 'jan')).color === getComputedStyle(probe).color
      && getComputedStyle(marker('food', 'jan')).color !== getComputedStyle(probe).color);
  }
  if (mode === 'reduced-motion') {
    check('reduced motion: no transition or animation', parseFloat(cellStyle.transitionDuration) === 0 && cellStyle.animationName === 'none');
  }
  press(states, 'Escape');

  const pending = mount(budget());
  const exit = (element, name) => root(element).querySelector(`[part="${name}"]`);
  const afterPatience = () => new Promise((done) => setTimeout(done, 20));
  pending.patience = 1;
  edit(pending, 'rent', 'jan', '910');
  const firstTry = last(pending);
  check('pending: a try in flight has no exits', pending.dataset.wait === 'sent'
    && exit(pending, 'retry').hidden && exit(pending, 'cancel').hidden);
  await afterPatience();
  const retry = exit(pending, 'retry');
  const cancel = exit(pending, 'cancel');
  check(`${mode}: a try with no receipt shows the reason and both exits`, pending.dataset.wait === 'stalled'
    && exit(pending, 'pending').textContent === 'Pending: No receipt came back.' && at(pending, 'rent', 'jan').textContent === '910Pending'
    && !root(pending).textContent.includes('Done') && [retry, cancel].every((button) => button.checkVisibility()
      && button.getBoundingClientRect().height >= 44));
  retry.focus();
  retry.click();
  const secondTry = last(pending);
  check('retry: the key and arguments stay, the id changes and focus goes to the cell', secondTry.key === firstTry.key
    && secondTry.id !== firstTry.id && secondTry.arguments === firstTry.arguments && where(pending) === 'rent jan');
  check('receipt: a foreign id with the same key leaves the grid pending', !pending.receipt({ id: 'other', key: firstTry.key, ok: true })
    && pending.dataset.wait === 'sent');
  edit(pending, 'food', 'jan', '410');
  await afterPatience();
  cancel.focus();
  cancel.click();
  check('cancel: the edit stays Changed and the next cell goes out', pending.requests.length === 3 && last(pending).arguments.row === 'food'
    && at(pending, 'rent', 'jan').textContent === '910Changed' && where(pending) === 'rent jan' && status(pending).startsWith('Canceled.'));
  check('cancel: late receipts change nothing', !pending.receipt({ id: firstTry.id, ok: true })
    && !pending.receipt({ key: secondTry.key, ok: true }) && at(pending, 'rent', 'jan').textContent === '910Changed');
  answer(pending);
  edit(pending, 'rent', 'jan', '910');
  check('cancel: a new save of the same value has a new key', pending.requests.length === 4 && last(pending).key !== firstTry.key);
  answer(pending);

  const newer = mount(budget());
  edit(newer, 'rent', 'jan', '930');
  const sent = last(newer);
  edit(newer, 'rent', 'jan', '940');
  check('a newer edit of the same cell waits while the first try is pending', newer.requests.length === 1
    && at(newer, 'rent', 'jan').textContent === '940Changed' && newer.dataset.wait === 'sent');
  newer.hold({ key: sent.key, wait: 'stalled' });
  exit(newer, 'retry').click();
  const retried = last(newer);
  check('retry sends the first edit again and the newer edit still waits', newer.requests.length === 2
    && retried.key === sent.key && retried.id !== sent.id && retried.arguments.value === 930
    && at(newer, 'rent', 'jan').textContent === '940Changed');
  newer.hold({ key: sent.key, wait: 'stalled' });
  exit(newer, 'cancel').click();
  const next = last(newer);
  check('cancel sends the newer edit of the same cell with a new key', newer.requests.length === 3
    && next.key !== sent.key && next.arguments.row === 'rent' && next.arguments.column === 'jan'
    && next.arguments.value === 940 && at(newer, 'rent', 'jan').textContent === '940Pending'
    && newer.dataset.state === 'pending' && newer.dataset.wait === 'sent');
  check('a late receipt for the canceled edit leaves the newer edit Pending', !newer.receipt({ id: retried.id, key: sent.key, ok: true })
    && at(newer, 'rent', 'jan').textContent === '940Pending');
  answer(newer);

  const offline = mount(budget());
  const { queueActions } = await import('../../src/kit.js');
  const { memoryStore, openQueue } = await import('../../src/offline/queue.js');
  const store = memoryStore();
  const sentOffline = [];
  const queue = await openQueue({ store, principal: 'person-check', online: () => false, locks: null,
    send: (request) => { sentOffline.push(request); return { ok: true }; } });
  const stopQueue = queueActions(offline, queue);
  edit(offline, 'rent', 'jan', '920');
  await tick();
  check('queue: a queued change shows its reason and only Cancel', offline.dataset.wait === 'queued'
    && exit(offline, 'pending').textContent === 'Pending: Waiting for a connection.'
    && exit(offline, 'retry').hidden && exit(offline, 'cancel').checkVisibility());
  exit(offline, 'cancel').click();
  await tick();
  check('queue: Cancel removes the record and leaves the edit Changed', !offline.dataset.wait && sentOffline.length === 0
    && (await store.all()).length === 0 && at(offline, 'rent', 'jan').textContent === '920Changed'
    && status(offline) === 'Canceled. The request did not leave this device.');
  stopQueue();
  queue.close();

  // A thread shows a data grid. The application binds the tool and gives the receipt. A new snapshot gives new values.
  const thread = document.createElement('mu-thread');
  const performed = [];
  let settle = null;
  thread.bind = (value) => (value.component === 'data-grid' ? BINDING : undefined);
  thread.perform = (value) => new Promise((done) => { performed.push(value); settle = done; });
  stage.append(thread);
  const snapshot = (value) => ({ type: 'ACTIVITY_SNAPSHOT', messageId: 'grid-message', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: value } });
  const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
  thread.push(snapshot(budget()));
  await frame();
  const inThread = root(thread).querySelector('mu-data-grid');
  check('thread: a data grid part shows with the binding of the application', inThread?.dataset.state === 'default' && inThread.actor.id === AUTHOR.id
    && inThread.action.state === 'default');
  edit(inThread, 'rent', 'jan', '1100');
  await tick();
  check('thread: a saved change goes to perform', performed.length === 1 && performed[0].arguments.value === 1100 && inThread.dataset.state === 'pending');
  thread.push(snapshot(budget(1100, 1500)));
  await frame();
  check('thread: new data waits for the receipt', at(inThread, 'total', 'jan').textContent === '1300' && at(inThread, 'rent', 'jan').textContent === '1100Pending');
  settle({ ok: true });
  await frame();
  await frame();
  check('thread: after the receipt the same element shows the new total and keeps the focus', root(thread).querySelector('mu-data-grid') === inThread
    && at(inThread, 'total', 'jan').textContent === '1500' && at(inThread, 'rent', 'jan').textContent === '1100' && where(inThread) === 'rent jan'
    && inThread.dataset.state === 'default', at(inThread, 'total', 'jan').textContent + ' ' + where(inThread));

  // These checks moved the focus. Put the Tab start point before the keyboard target. The grid is the next Tab stop.
  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  start.focus();
  const target = document.createElement('mu-button');
  target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target);
  const keyed = mount(budget(), BINDING, keyboard);
  window.muPresses = () => presses;
  window.muGridState = () => ({ cell: where(keyed), editor: editor(keyed) ? editor(keyed).value : null, requests: keyed.requests.length,
    last: keyed.requests.length ? JSON.stringify(last(keyed).arguments) : null, text: active(keyed)?.closest('td')?.textContent ?? null,
    focus: active(keyed)?.getAttribute('part') });
  window.muGridStall = () => {
    keyed.noReceipt(last(keyed).id);
    at(keyed, 'rent', 'jan').focus();
  };
  window.muChecks = { mode, results };
}

if (typeof window !== 'undefined') await browserChecks();
