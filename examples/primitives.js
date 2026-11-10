// An example page with each primitive. All data is synthetic and neutral.
import { define } from '../src/primitives/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });

function make(tag, value, ...children) {
  const node = document.createElement(tag);
  node.fill = value;
  node.append(...children);
  return node;
}

const button = make('mu-button', fill('button', { label: 'Renew' }));
const secondary = make('mu-button', fill('button', { label: 'Later', emphasis: 'secondary' }));
const disabled = make('mu-button', fill('button', { label: 'Return', disabled: true }));
const status = make('mu-text', fill('text', { text: 'No action yet.', variant: 'caption' }));
status.id = 'status';
button.addEventListener('mu-press', () => { status.fill = fill('text', { text: 'Renew was pressed.', variant: 'caption' }); });

document.getElementById('main').append(
  make('mu-stack', fill('stack', { label: 'Loan details', gap: 'medium' }),
    make('mu-text', fill('text', { text: 'Field guide to moss', variant: 'strong' })),
    make('mu-text', fill('text', { text: 'Due on 1 December 2026.' })),
    make('mu-field', fill('field', { label: 'Shelf code', value: 'B-14', hint: 'A letter and a number.' })),
    make('mu-field', fill('field', { label: 'Branch', value: '', error: 'Give a branch name.' })),
    make('mu-stack', fill('stack', { label: 'Loan actions', direction: 'row', gap: 'small' }), button, secondary, disabled),
    status),
  make('mu-grid', fill('grid', { label: 'Reading list', min_column: 'narrow' }),
    make('mu-text', fill('text', { text: 'Rivers and deltas' })),
    make('mu-text', fill('text', { text: 'A short history of maps' })),
    make('mu-text', fill('text', { text: 'Weather at sea' }))),
  make('mu-text', fill('text', { text: '<b>This markup shows as text.</b>' })),
  make('mu-text', fill('text', { text: 'x', style: 'color: red' })));
