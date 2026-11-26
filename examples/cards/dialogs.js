import { define } from '../../src/components/index.js';
import { mount, onAction } from '../../src/kit.js';

define();

const main = document.getElementById('main');
const dialog = mount('dialog', { title: 'Release tray A3', close_label: 'Close dialog' }, { parent: main });
const note = document.createElement('p');
note.textContent = 'Release this reservation to make tray A3 available.';
dialog.append(note);
mount('action-button', { label: 'Release tray' }, {
  parent: dialog,
  action: {
    tool: 'tray.release', label: 'Release tray', arguments: { tray: 'A3' },
    confirm: { message: 'Release the reservation for tray A3?', label: 'Release reservation' },
  },
});
onAction(dialog, () => ({ ok: true, message: 'Tray A3 is available.', reference: 'A3' }));

const drawer = mount('drawer', { title: 'Tray details', close_label: 'Close drawer' }, { parent: main });
const details = document.createElement('p');
details.textContent = 'Tray A3 is on the east shelf and holds 12 cells.';
const closeDetails = document.createElement('button');
closeDetails.type = 'button';
closeDetails.textContent = 'Close details';
closeDetails.addEventListener('click', () => drawer.close());
drawer.append(details, closeDetails);

document.getElementById('open-dialog').addEventListener('click', () => dialog.open());
document.getElementById('open-drawer').addEventListener('click', () => drawer.open());
