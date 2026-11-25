import { define } from '../../src/components/index.js';
import { createKit, fill } from '../../src/kit.js';

define();
const kit = createKit({ actor: { type: 'system', id: 'density-example' } });

const trays = [
  { name: 'Tray A', crop: 'Basil', ready: 8, growing: 4 },
  { name: 'Tray B', crop: 'Peas', ready: 6, growing: 6 },
  { name: 'Tray C', crop: 'Kale', ready: 10, growing: 2 },
  { name: 'Tray D', crop: 'Chard', ready: 5, growing: 7 },
];
const columns = ['Ready', 'Growing'].map((label) => fill('data-grid-column', { key: label.toLowerCase(), label, type: 'number' }));
const rows = trays.map(({ name, ready, growing }) => fill('data-grid-row', {
  key: name.slice(-1).toLowerCase(), label: name,
  cells: [ready, growing].map((value) => fill('number-cell', { value, read_only: true })),
}));
const cards = trays.map(({ name, crop, ready }) => fill('card', {
  title: name, summary: `${crop}. ${ready} plants are ready.`, collapsible: true,
}));

for (const id of ['default', 'compact']) {
  const parent = document.getElementById(id);
  kit.mount('card-grid', { label: 'Trays', cards, collapse_controls: true }, { parent });
  kit.mount('data-grid', { label: 'Plant counts', columns, rows }, { parent });
}
