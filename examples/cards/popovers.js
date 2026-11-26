import { define } from '../../src/components/index.js';
import { fill, mount } from '../../src/kit.js';

define();

const choices = [
  { label: 'Show cell count', name: 'show_count' },
  { label: 'Show shelf', name: 'show_shelf' },
  { label: 'Show note', name: 'show_note' },
];
const messages = {
  show_count: 'Tray A3 has 12 cells.',
  show_shelf: 'Tray A3 is on the east shelf.',
  show_note: 'Keep tray A3 dry.',
};
const summary = document.getElementById('tray-summary');
const menu = mount('menu', { label: 'Tray options', items: choices }, { parent: document.getElementById('options') });
menu.addEventListener('mu-menu-select', ({ detail }) => {
  summary.textContent = messages[detail.name];
});

const tooltip = mount('tooltip', { text: 'Read the seed and shelf details.' }, { parent: document.getElementById('help') });
const help = document.getElementById('tray-help');
tooltip.append(help);
help.addEventListener('click', () => {
  summary.textContent = 'Tray A3 holds dune bell seeds. It is on the east shelf.';
});

const toast = mount('toast', { message: 'Tray note saved.' }, { parent: document.getElementById('main') });
const result = document.getElementById('save-result');
function showResult(data) {
  result.textContent = data.message;
  toast.fill = fill('toast', data);
  toast.show();
}
document.getElementById('show-toast').addEventListener('click', () => {
  showResult({ message: 'Tray note saved.' });
});
document.getElementById('show-error').addEventListener('click', () => {
  showResult({ message: 'Tray note did not save.', kind: 'error', close_label: 'Close message' });
});
