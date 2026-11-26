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

const pending = { message: 'Saving tray note.' };
const toast = mount('toast', pending, { parent: document.getElementById('main') });
const result = document.getElementById('save-result');
let savePending = false;

function requestSave(ok) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      ok,
      message: ok ? 'Tray note saved.' : 'Tray note did not save.',
    }), 250);
  });
}

async function saveNote(succeeds) {
  if (savePending) return;
  savePending = true;
  result.textContent = pending.message;
  toast.fill = fill('toast', pending);

  const { ok, message } = await requestSave(succeeds);
  toast.fill = fill('toast', ok ? { message } : { message, kind: 'error', close_label: 'Close message' });
  toast.show();
  result.textContent = message;
  savePending = false;
}

document.getElementById('show-toast').addEventListener('click', () => saveNote(true));
document.getElementById('show-error').addEventListener('click', () => saveNote(false));
