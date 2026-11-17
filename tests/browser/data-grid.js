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
  return results;
}

// The budget example: an edit goes to the application, and the application sends the new total.
export async function budgetExampleChecks(session, sessionId, base, { evaluate, open, sleep, key }) {
  const page = 'examples/budget.html';
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
  const BINDING = { tool: 'budget.set_cell', arguments: { budget_id: 'B-7' } };
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
  const refusal = (element) => (element.dataset.state === 'refused' ? root(element).querySelector('[role="status"]')?.textContent : null);
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
    rows: [row('r', MARKUP.slice(0, 80), cell('text', MARKUP), cell('choice', MARKUP.slice(0, 80)))] }));
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
    check(`refused: ${reason}`, refusal(bad) === 'Refused data-grid: ' + reason && !root(bad).querySelector('table') && bad.fill === null, root(bad).textContent);
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
  for (const [name, binding, reason] of [['a label', { ...BINDING, label: 'Save' }, 'a data grid accepts only a tool and its arguments'],
    ['a confirm step', { ...BINDING, confirm: { message: 'Save?', label: 'Yes' } }, 'a data grid accepts only a tool and its arguments'],
    ['editable names', { ...BINDING, editable: { value: 'Value' } }, 'a data grid accepts only a tool and its arguments'],
    ['a bound row', { tool: 'budget.set_cell', arguments: { row: 'rent' } }, 'a bound argument cannot be editable: row'],
    ['no tool', { arguments: {} }, 'the tool name is not valid'], ['a text', 'budget.set_cell', 'the action must be an object']]) {
    check(`binding: ${name} is refused`, thrown(() => { unbound.action = binding; }) === 'TypeError: action: ' + reason && unbound.action.state === 'default');
  }
  edit(unbound, 'rent', 'jan', '901');
  unbound.action = { tool: 'budget.set_cell', arguments: { budget_id: 'B-8' } };
  check('binding: a new binding removes the changes of the old binding', at(unbound, 'rent', 'jan').textContent === '900' && unbound.dataset.state === 'default'
    && unbound.receipt({ id: last(unbound).id, ok: true }) === false);
  const empty = mount(fill({ label: 'Synthetic budget', columns: COLUMNS, rows: [] }));
  check('empty: a grid with no rows shows a text', empty.dataset.state === 'empty' && root(empty).querySelector('[part="empty"]')?.textContent === 'No rows.'
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
    rows: Array.from({ length: 50 }, (_, index) => row(`r${index + 1}`, `Line ${index + 1}`, ...MONTHS.map((_, month) => cell('number', index * 12 + month)))) }), BINDING, large);
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
    last: keyed.requests.length ? JSON.stringify(last(keyed).arguments) : null, text: active(keyed)?.closest('td')?.textContent ?? null });
  window.muChecks = { mode, results };
}

if (typeof window !== 'undefined') await browserChecks();
