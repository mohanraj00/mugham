// An example page with each primitive. All data is synthetic and neutral.
import { define } from '../../src/primitives/index.js';
import { fill, mount } from '../../src/kit.js';

define();

const main = document.getElementById('main');
const stack = mount('stack', { label: 'Loan details', gap: 'medium' }, { parent: main });
mount('text', { text: 'Field guide to moss', variant: 'strong' }, { parent: stack });
mount('text', { text: 'Due on 1 December 2026.' }, { parent: stack });
mount('field', { label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.' }, { parent: stack });
mount('field', { label: 'Branch', value: '', error: 'Give a branch name.' }, { parent: stack });
const row = mount('stack', { label: 'Loan actions', direction: 'row', gap: 'small' }, { parent: stack });
const button = mount('button', { label: 'Renew' }, { parent: row });
mount('button', { label: 'Later', emphasis: 'secondary' }, { parent: row });
mount('button', { label: 'Return', disabled: true }, { parent: row });
const status = mount('text', { text: 'No action yet.', variant: 'caption' }, { parent: stack });
status.id = 'status';
button.addEventListener('mu-press', () => { status.fill = fill('text', { text: 'Renew was pressed.', variant: 'caption' }); });

const grid = mount('grid', { label: 'Reading list', min_column: 'narrow' }, { parent: main });
for (const text of ['Rivers and deltas', 'A short history of maps', 'Weather at sea']) mount('text', { text }, { parent: grid });
mount('text', { text: '<b>This markup shows as text.</b>' }, { parent: main });
mount('text', { text: 'x', style: 'color: red' }, { parent: main });
