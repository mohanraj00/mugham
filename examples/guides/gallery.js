// The gallery uses the same synthetic data in each preset and mode.
import { define, MuImage, MuRichText } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';
import { define as defineThread } from '../../src/thread/index.js';

define();
defineThread();
MuImage.allowedOrigins = [location.origin];
MuRichText.headingLevel = 3;

const root = document.documentElement;
const preset = document.getElementById('preset');
const mode = document.getElementById('mode');
function selectAppearance() {
  root.dataset.muTheme = preset.value;
  if (mode.value) root.dataset.muMode = mode.value;
  else delete root.dataset.muMode;
}
preset.addEventListener('change', selectAppearance);
mode.addEventListener('change', selectAppearance);
selectAppearance();

const ACTOR = { type: 'agent', id: 'garden-helper', name: 'Garden helper' };
const { mount } = createKit({ actor: ACTOR });
const cards = document.getElementById('cards');
const forms = document.getElementById('forms');
const records = document.getElementById('records');
const evidence = document.getElementById('evidence');
const conversation = document.getElementById('thread');

const shell = mount('app-shell', {
  nav_label: 'Gallery sections', menu_label: 'Menu', close_label: 'Close menu', skip_label: 'Skip to tray notes',
}, { parent: cards });
mount('text', { text: 'Seed trays' }, { parent: shell, slot: 'top' });
const catalogLink = document.createElement('a');
catalogLink.href = '#cards';
catalogLink.slot = 'side';
catalogLink.textContent = 'Tray notes';
shell.append(catalogLink);
mount('breadcrumbs', { label: 'Tray path', items: [
  { label: 'Seed trays', href: '#cards' }, { label: 'Tray notes' },
] }, { parent: shell });
const pages = mount('pagination', { label: 'Tray pages', page: 2, page_count: 12 }, { parent: shell });
pages.addEventListener('mu-page-change', ({ detail: { page } }) => {
  pages.fill = fill('pagination', { label: 'Tray pages', page, page_count: 12 });
});
const traySteps = { label: 'Tray steps', labels: ['Choose a tray', 'Check the shelf', 'Review'] };
const steps = mount('steps', { ...traySteps, current: 1 }, { parent: shell });
steps.addEventListener('mu-step-change', ({ detail: { index } }) => {
  steps.fill = fill('steps', { ...traySteps, current: index });
});
mount('run-steps', { label: 'Tray run', steps: [
  { id: 'find', name: 'Find the tray', state: 'done', tool_name: 'garden.find_tray',
    tool_arguments: 'Tray: B2', tool_result: 'East shelf' },
  { id: 'check', name: 'Check the tray', state: 'running' },
] }, { parent: shell });
mount('plan', { label: 'Tray plan', tasks: [
  { id: 'count', name: 'Count the seedlings', state: 'in_progress' },
  { id: 'water', name: 'Water the tray', state: 'pending' },
] }, { parent: shell });
mount('progress', { label: 'Trays checked', maximum: 8, value: 5 }, { parent: shell });
mount('empty-state', { title: 'No trays found', text: 'Try another shelf code.' }, { parent: shell });
mount('skeleton', { label: 'Loading trays', lines: 3 }, { parent: shell });
mount('badge', { text: 'Ready to sow', tone: 'success' }, { parent: shell });
mount('avatar', { name: 'Sample Grower' }, { parent: shell, slot: 'top' });

const plot = (title, shelf) => ({ title, facts: [fill('fact', { label: 'Shelf', value: shelf })] });
mount('card-grid', { label: 'Seed trays', cards: [
  fill('card', plot('Rain bell', 'A2')),
  fill('card', plot('Glass moss', 'B1')),
] }, { parent: cards });
const card = mount('card', { ...plot('Dune bell', 'A3'), collapsible: true }, { parent: cards });
mount('action-button', { label: 'Reserve tray' }, {
  parent: card, slot: 'actions', action: { tool: 'garden.reserve', label: 'Reserve tray', arguments: { tray: 'A3' } },
});
const stack = mount('stack', { label: 'Tray note', direction: 'row' }, { parent: cards });
const button = mount('button', { label: 'Show note', emphasis: 'secondary' }, { parent: stack });
const note = mount('text', { text: 'No tray note open.' }, { parent: stack });
button.addEventListener('mu-press', () => {
  note.fill = fill('text', { text: 'Keep the tray in shade.' });
});
for (const [name, title] of [['dialog', 'Tray note'], ['drawer', 'Tray details']]) {
  const trigger = mount('button', { label: 'Open ' + name, emphasis: 'secondary' }, { parent: cards });
  const modal = mount(name, { title, close_label: 'Close ' + name }, { parent: cards });
  mount('text', { text: 'Tray A3 is on the east shelf.' }, { parent: modal });
  trigger.addEventListener('mu-press', () => modal.open());
}
const menu = mount('menu', { label: 'Tray options', items: [{ label: 'Show shelf', name: 'show_shelf' }] }, { parent: cards });
menu.addEventListener('mu-menu-select', () => {
  note.fill = fill('text', { text: 'Tray A3 is on the east shelf.' });
});
const tooltip = mount('tooltip', { text: 'Show a reminder about the tray.' }, { parent: cards });
const showToast = document.createElement('button');
showToast.type = 'button';
showToast.textContent = 'Show tray reminder';
tooltip.append(showToast);
const toast = mount('toast', { message: 'Keep tray A3 dry.' }, { parent: cards });
showToast.addEventListener('click', () => toast.show());
const tabs = mount('tabs', { label: 'Tray locations', tabs: [
  { label: 'East shelf', name: 'east' },
  { label: 'West shelf', name: 'west' },
] }, { parent: cards });
mount('text', { text: 'The Rain bell tray is on shelf A2.' }, { parent: tabs, slot: 'east' });
mount('text', { text: 'The Glass moss tray is on shelf B1.' }, { parent: tabs, slot: 'west' });

const accordion = document.createElement('mu-accordion');
accordion.setAttribute('heading-level', '3');
accordion.fill = fill('accordion', { label: 'Tray care', sections: [
  { label: 'Water', name: 'water' },
  { label: 'Light', name: 'light' },
] });
mount('text', { text: 'Water the trays before noon.' }, { parent: accordion, slot: 'water' });
mount('text', { text: 'Keep the trays in shade.' }, { parent: accordion, slot: 'light' });
cards.append(accordion);

mount('action-queue', { label: 'Action queue', actions: [
  fill('queued-action', { key: 'tray-3', label: 'Reserve a tray', state: 'sent' }),
] }, { parent: cards });
mount('source-status', { label: 'Tray records', state: 'ready', checked: '2028-04-09T08:00:00Z' }, { parent: cards });

const zone = 'Etc/UTC';
const fields = [
  fill('field', { name: 'tray', label: 'Tray label', value: 'A3' }),
  fill('long-text-field', { name: 'notes', label: 'Care notes', value: 'Water before noon.' }),
  fill('number-field', { name: 'seeds', label: 'Seed count', value: 12 }),
  fill('date-field', { name: 'date', label: 'Sow date', value: '2028-04-10' }),
  fill('choice-field', { name: 'shelf', label: 'Shelf', choices: ['A', 'B'], value: 'A' }),
  fill('select-field', { name: 'bed', label: 'Garden bed', choices: ['East', 'West'], value: 'East' }),
  fill('multi-choice-field', { name: 'care', label: 'Care steps', choices: ['Water', 'Thin', 'Check'], value: ['Water'] }),
  fill('toggle-field', { name: 'reminder', label: 'Send a reminder', value: true, display: 'switch' }),
  fill('range-field', { name: 'water', label: 'Water in liters', value: 2, minimum: 0, maximum: 5, step: 1 }),
  fill('date-range-field', { name: 'dates', label: 'Planting dates', value: ['2028-04-10', '2028-04-12'] }),
  fill('time-field', { name: 'time', label: 'Watering time', value: '10:00' }),
  fill('date-time-field', { name: 'delivery', label: 'Tray delivery', value: '2028-04-10T09:00', time_zone: zone }),
];
mount('editable-form', { title: 'Planting plan', fields, submit_label: 'Save plan' }, { parent: forms, action: {
  tool: 'garden.save_plan', title: 'Planting plan', label: 'Save plan',
  editable: Object.fromEntries(fields.map(({ data }) => [data.name, data.label])), time_zones: { delivery: zone },
} });
const line = fill('form-line', { line: '1', field: fill('field', { name: 'label', label: 'Label', value: 'East shed' }) });
mount('form-card', { title: 'Shed record', submit_label: 'Save record',
  sections: [fill('form-section', { title: 'Location', lines: [line] })],
}, { parent: forms, action: { tool: 'garden.save_shed', title: 'Shed record', label: 'Save record', editable: { label: 'Label' } } });
const upload = mount('upload', { label: 'Attach a sample note', help: 'Use a synthetic text file.' }, {
  parent: forms, action: { tool: 'garden.attach', label: 'Attach a sample note', accept: ['.txt'], max_size: 10000, max_files: 1 },
});
upload.addEventListener('mu-upload', (event) => {
  upload.receipt({ id: event.detail.id, ok: true, message: 'Sample received.' });
});
onAction(document.querySelector('main'), async () => ({ ok: true, message: 'Sample saved.' }));

const grid = mount('grid', { label: 'Bed names', min_column: 'narrow' }, { parent: records });
for (const text of ['East bed', 'West bed']) mount('text', { text, variant: 'strong' }, { parent: grid });
mount('table', { label: 'Seed trays by shelf', columns: ['Tray', 'Shelf'],
  rows: [fill('table-row', { cells: ['Rain bell', 'A2'] }), fill('table-row', { cells: ['Glass moss', 'B1'] })],
}, { parent: records });

const columns = [
  fill('data-grid-column', { key: 'tray', label: 'Tray', type: 'text' }),
  fill('data-grid-column', { key: 'count', label: 'Seeds', type: 'number' }),
  fill('data-grid-column', { key: 'sown', label: 'Sown', type: 'date' }),
  fill('data-grid-column', { key: 'state', label: 'State', type: 'choice', choices: ['Ready', 'Waiting'] }),
];
mount('data-grid', { label: 'Tray records', columns, rows: [fill('data-grid-row', { key: 'a2', label: 'A2', cells: [
  fill('text-cell', { value: 'Rain bell' }),
  fill('number-cell', { value: 12 }),
  fill('date-cell', { value: '2028-04-10' }),
  fill('choice-cell', { value: 'Ready' }),
] })] }, { parent: records });

const citation = { source: 'Garden notes, page 2', locator: 'https://example.org/garden#page-2' };
const passage = 'Keep the tray in shade until the first leaves appear.';
mount('citation', { quote: passage }, { parent: evidence, slots: { citation } });
mount('excerpt', { passage, span_start: 17, span_end: 22 }, { parent: evidence, slots: { citation } });
mount('diff', { title: 'Tray changes', parts: [fill('diff-part', { title: 'Location',
  changes: [fill('diff-change', { label: 'Shelf', change: 'changed', before: 'B1', after: 'A2' })],
})] }, { parent: evidence });
for (const [state, text] of [
  ['passed', 'The tray label is clear.'], ['pending', 'The seed count needs a check.'],
  ['failed', 'The tray is dry.'], ['unknown', 'The sow date is unknown.'],
]) mount('status', { state, text }, { parent: evidence });
mount('image', { url: '/examples/media/floor-plan.svg', alt: 'Two rooms with a door in the shared wall.',
  caption: 'Sample shed plan.', width: 480, height: 320 }, { parent: evidence });
mount('chart', { title: 'Seeds by tray', type: 'bar', categories: ['A2', 'A3'],
  series: [fill('chart-series', { label: 'Seeds', values: [12, 8] })],
  units: 'seeds', x_label: 'Tray', y_label: 'Seed count',
}, { parent: evidence });

const span = (text) => fill('rich-span', { text });
const paragraph = (...content) => fill('rich-paragraph', { content });
mount('rich-text', { blocks: [
  fill('rich-heading', { level: 1, content: [span('Tray care')] }),
  paragraph(span('Use the '), fill('rich-link', { text: 'sample guide', url: 'https://example.org/garden' }), span('.')),
  fill('rich-list', { items: [paragraph(span('Check the soil.')), paragraph(span('Water before noon.'))] }),
  fill('rich-quote', { paragraphs: [paragraph(span('Keep the tray in shade.'))] }),
  fill('rich-code', { text: 'tray = A3' }),
] }, { parent: conversation });

const thread = document.createElement('mu-thread');
conversation.append(thread);
for (const [messageId, actor, delta] of [
  ['person-note', { type: 'human', id: 'gardener' }, 'Where is the Rain bell tray?'],
  ['agent-note', ACTOR, 'The tray is on shelf A2.'],
]) {
  thread.push({ type: 'TEXT_MESSAGE_START', messageId, role: actor.type === 'human' ? 'user' : 'assistant',
    metadata: { mugham: { actor } } });
  thread.push({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta });
  thread.push({ type: 'TEXT_MESSAGE_END', messageId });
}
