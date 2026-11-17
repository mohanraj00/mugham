// The JavaScript validator gives the same result as tools/catalog.py for the data grid contracts.
// tests/test_data_grid.py has the same cases. The element rules are in tests/browser/data-grid.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';

const CELLS = ['text-cell', 'number-cell', 'date-cell', 'choice-cell'];
const node = (component, data) => ({ component, version: '0.1.0', data });
const COLUMNS = [node('data-grid-column', { key: 'kind', label: 'Kind', type: 'choice', choices: ['Fixed', 'Variable'] }),
  node('data-grid-column', { key: 'jan', label: 'January', type: 'number' })];
const row = (...cells) => node('data-grid-row', { key: 'rent', label: 'Rent', cells });
const ROW = row(node('choice-cell', { value: 'Fixed' }), node('number-cell', { value: 900 }));
const errors = (change = {}) => fillErrors({ component: 'data-grid', version: '0.1.0',
  data: { label: 'Synthetic budget', columns: COLUMNS, rows: [ROW], ...change }, slots: { authorship: { type: 'agent', id: 'agent-check' } } }, CATALOG);

test('each data grid contract is valid', () => {
  for (const name of ['data-grid', 'data-grid-column', 'data-grid-row', ...CELLS]) assert.deepEqual(contractErrors(CATALOG[name], CATALOG), [], name);
});

test('a grid with typed cells is valid, also with empty cells and with no rows', () => {
  assert.deepEqual(errors(), []);
  assert.deepEqual(errors({ rows: [row(node('choice-cell', {}), node('number-cell', { read_only: true }))] }), []);
  assert.deepEqual(errors({ rows: [] }), []);
});

test('a cell value has the type of its contract', () => {
  const at = 'data.rows[0].data.cells[1]';
  for (const [cell, error] of [
    [node('number-cell', { value: '900' }), `${at}.data.value: must be a number`],
    [node('date-cell', { value: '2026-02-30' }), `${at}.data.value: must be a date as YYYY-MM-DD`],
    [node('text-cell', { value: 900 }), `${at}.data.value: must be a string`],
    [node('text-cell', { value: 'x'.repeat(501) }), `${at}.data.value: more than 500 characters`],
    [node('number-cell', { value: 900, formula: '=A1' }), `${at}.data.formula: the contract does not declare this field`],
    [node('button', { label: 'x' }), `${at}.component: must be ${CELLS.join(' or ')}`],
  ]) assert.deepEqual(errors({ rows: [row(ROW.data.cells[0], cell)] }), [error]);
});

test('the limits and the undeclared fields are refused', () => {
  assert.deepEqual(errors({ columns: Array(31).fill(COLUMNS[1]) }), ['data.columns: more than 30 items']);
  assert.deepEqual(errors({ rows: Array(201).fill(ROW) }), ['data.rows: more than 200 items']);
  assert.deepEqual(errors({ columns: [node('data-grid-column', { key: 'x', label: 'X', type: 'formula' })] }),
    ['data.columns[0].data.type: must be one of text, number, date, choice']);
  assert.deepEqual(errors({ tool: 'budget.delete' }), ['data.tool: the contract does not declare this field']);
});
