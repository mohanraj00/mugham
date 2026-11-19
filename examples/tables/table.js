// All rows are synthetic. The page acts as the application and gives each status and the trusted actor.
import { define } from '../../src/components/index.js';
import { createKit, fill } from '../../src/kit.js';

define();
const AUTHOR = { type: 'agent', id: 'agent-garden' };
const { mount } = createKit({ actor: AUTHOR });
const row = (cells, status) => fill('table-row', { cells, ...(status === undefined ? {} : { status }) });
document.getElementById('main').append(
  mount('table', { label: 'Synthetic plots', columns: ['Plot', 'Area', 'Note'],
    rows: [row(['Plot C', 'West', 'Seed tray'], 'Waiting'), row(['Plot A', 'North', 'Water tank'], 'Ready'),
      row(['Plot B', 'East', 'Tool store'])], status_values: ['Ready', 'Waiting'], sort_key: 0 }),
  mount('table', { label: 'No plot records', columns: ['Plot', 'Area', 'Note'], rows: [] }),
);
