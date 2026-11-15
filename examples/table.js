// All rows are synthetic. The page acts as the application and gives each status and the trusted actor.
import { define } from '../src/components/index.js';

define();
const AUTHOR = { type: 'agent', id: 'agent-garden' };
const row = (cells, status) => ({ component: 'table-row', version: '0.1.0',
  data: { cells, ...(status === undefined ? {} : { status }) } });
function table(data) {
  const node = document.createElement('mu-table');
  node.actor = AUTHOR;
  node.fill = { component: 'table', version: '0.1.0', data, slots: { authorship: AUTHOR } };
  return node;
}
document.getElementById('main').append(
  table({ label: 'Synthetic plots', columns: ['Plot', 'Area', 'Note'],
    rows: [row(['Plot C', 'West', 'Seed tray'], 'Waiting'), row(['Plot A', 'North', 'Water tank'], 'Ready'),
      row(['Plot B', 'East', 'Tool store'])], status_values: ['Ready', 'Waiting'], sort_key: 0 }),
  table({ label: 'No plot records', columns: ['Plot', 'Area', 'Note'], rows: [] }),
);
