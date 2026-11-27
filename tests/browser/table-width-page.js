// A synthetic table with 9 columns for the width checks of tests/browser/table-width.js.
import { define } from '../../src/components/index.js';

define();
const AUTHOR = { type: 'agent', id: 'agent-width-check' };
const columns = ['Area', 'Name', 'Phase', 'Kind', 'Budget', 'Spend', 'Left', 'Start', 'End'];
const row = (cells) => ({ component: 'table-row', version: '0.1.0', data: { cells } });
const table = document.createElement('mu-table');
table.actor = AUTHOR;
document.getElementById('stage').append(table);
table.fill = {
  component: 'table', version: '0.1.0', slots: { authorship: AUTHOR },
  data: {
    label: 'Synthetic runs', columns,
    rows: [
      row(['North', 'Seed sort', 'Ready', 'Daily', '5.00', '1.25', '3.75', '08:46', '09:06']),
      row(['South', 'Tray count', 'Waiting', 'Weekly', '2.00', '0.50', '1.50', '09:46', '10:06']),
    ],
  },
};
