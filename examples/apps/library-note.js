// The fixture accepts the note and returns a receipt for its request.
import { define } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();

const actor = { type: 'human', id: 'library-reader' };
const { outer, fill } = createKit({ actor });
const form = document.querySelector('mu-editable-form');
form.actor = actor;
form.action = { tool: 'library.save_note', title: 'Reading room note', label: 'Save note', editable: { note: 'Note' } };
form.addEventListener('mu-action', ({ detail }) => {
  document.querySelector('#saved-note').textContent = JSON.stringify(detail.arguments.note, null, 2);
  form.receipt({ id: detail.id, ok: true });
});
form.fill = outer('editable-form', {
  title: 'Reading room note',
  submit_label: 'Save note',
  fields: [fill('rich-text-field', {
    name: 'note', label: 'Note', required: true,
    hint: 'Select text to apply a format.',
    value: fill('rich-text', { blocks: [
      fill('rich-paragraph', { content: [fill('rich-span', { text: 'Leave the reading room ready for the next group.' })] }),
    ] }),
  })],
});
