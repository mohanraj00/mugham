import { define } from '../../src/components/index.js';
import { fill, mount } from '../../src/kit.js';

define();

const main = document.getElementById('main');
const tabs = document.querySelector('mu-tabs');
tabs.fill = fill('tabs', {
  label: 'Settings',
  tabs: [
    { label: 'General', name: 'general' },
    { label: 'Notifications', name: 'notifications' },
    { label: 'Access rules', name: 'access_rules' },
  ],
});
mount('text', { text: 'The seed library lends seed trays for two weeks.' }, { parent: tabs, slot: 'general' });

const accordion = document.querySelector('mu-accordion');
accordion.fill = fill('accordion', {
  label: 'Notice settings',
  sections: [
    { label: 'Digest schedule', name: 'digest_schedule' },
    { label: 'Reminders', name: 'reminders' },
  ],
});

const dialog = mount('dialog', { title: 'Review notice settings', close_label: 'Close review' }, { parent: main });
const reviewText = document.createElement('p');
dialog.append(reviewText);
const save = mount('action-button', { label: 'Save settings' }, { parent: dialog });
const message = 'Settings saved.';
const toast = mount('toast', { message }, { parent: main });
const frequency = document.getElementById('digest-frequency');
const result = document.getElementById('save-result');
const labels = new Map([['daily', 'Daily'], ['weekly', 'Weekly']]);

document.getElementById('review-settings').addEventListener('click', () => {
  reviewText.textContent = 'Digest frequency: ' + labels.get(frequency.value) + '.';
  save.action = {
    tool: 'settings.save', label: 'Save settings', arguments: { frequency: frequency.value },
    confirm: { message: 'Save these notice settings?', label: 'Confirm save' },
  };
  dialog.open();
});

// This example uses a fixture in page memory. It gives a receipt for the selected schedule.
save.addEventListener('mu-action', ({ detail: { id, arguments: args } }) => {
  const label = labels.get(args.frequency);
  const receipt = label ? { id, ok: true, message } : { id, ok: false, message: 'Choose a digest frequency.' };
  if (!save.receipt(receipt) || !receipt.ok) return;
  result.textContent = 'Saved digest frequency: ' + label + '.';
  dialog.close();
  toast.fill = fill('toast', { message });
  toast.show();
});
