import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const shell = document.querySelector('mu-app-shell');
shell.fill = fill('app-shell', {
  nav_label: 'Library sections', menu_label: 'Menu', close_label: 'Close menu', skip_label: 'Skip to main content',
});
document.querySelector('mu-breadcrumbs').fill = fill('breadcrumbs', {
  label: 'Breadcrumbs', items: [{ label: 'Staff home', href: '#staff' }, { label: 'Loans' }],
});

const list = document.getElementById('loan-list');
const pagination = document.querySelector('mu-pagination');
const pageSize = 3;
const loans = [
  'A guide to rain gardens', 'The life of pond plants', 'A map of coast trails', 'A field guide to moths',
  'The small orchard', 'Plants for sandy soil', 'How to mend a book', 'A walk through the dunes',
  'A year of cloud notes', 'The beach at low tide', 'Small boats and sails', 'Trees of the north slope',
  'The pond in winter', 'A guide to night birds', 'Rocks of the river bank', 'The meadow after rain',
  'A guide to garden seeds', 'A walk along the marsh', 'Birds at the feeder', 'How to build a nest box',
  'A survey of hill paths', 'The life of a fern', 'A guide to reading maps', 'The orchard in spring',
  'A book of shell shapes', 'The life of a dune', 'A guide to bog plants', 'The trees outside town',
  'Clouds above the hill', 'The river in spring', 'The rock garden', 'A guide to summer stars',
  'A walk beside the canal', 'Seeds from the meadow', 'The lake after dusk', 'A guide to tide pools',
];
const pageCount = Math.ceil(loans.length / pageSize);

function showPage(page) {
  const start = (page - 1) * pageSize;
  list.replaceChildren(...loans.slice(start, start + pageSize).map((title, index) => {
    const row = document.createElement('li');
    row.textContent = title + ' (shelf A' + (start + index + 1) + ')';
    return row;
  }));
  pagination.fill = fill('pagination', { label: 'Loan pages', page, page_count: pageCount });
}

pagination.addEventListener('mu-page-change', (event) => showPage(event.detail.page));
showPage(1);

const wizard = document.getElementById('member-wizard');
const steps = wizard.querySelector('mu-steps');
const progress = document.getElementById('member-progress');
const panels = [...wizard.querySelectorAll('[data-member-step]')];
const headings = panels.map((panel) => panel.querySelector('h3'));
const labels = headings.map((heading) => heading.textContent);
const draft = {};
let review = '';
const { mount } = createKit({ actor: { type: 'human', id: 'library-staff' } });

function mountDraftStep(index, component, data) {
  const parent = panels[index];
  const field = mount(component, data, { parent });
  const next = mount('button', { label: 'Next' }, { parent });
  const advance = () => {
    if (!field.reportValidity()) return;
    draft[data.name] = field.value;
    showMemberStep(index + 1);
  };
  next.addEventListener('mu-press', advance);
  if (component === 'field') {
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      advance();
    });
  }
}

mountDraftStep(0, 'field', { name: 'member_name', label: 'Member name', value: 'Sample Member' });
mountDraftStep(1, 'choice-field', {
  name: 'membership_type', label: 'Membership type', choices: ['Standard', 'Household'], value: 'Standard',
});
for (const index of [1, 2]) {
  const back = mount('button', { label: 'Back', emphasis: 'secondary' }, { parent: panels[index] });
  back.addEventListener('mu-press', () => showMemberStep(index - 1));
}
const add = mount('action-button', { label: 'Add member' }, { parent: panels[2] });
add.id = 'add-member';
onAction(add, async () => {
  await new Promise((done) => setTimeout(done, 400));
  return { ok: true, message: 'Member added.' };
});

function showMemberStep(index, focus = true) {
  if (index === 2) {
    document.getElementById('member-name').textContent = draft.member_name;
    document.getElementById('member-type').textContent = draft.membership_type;
    const values = JSON.stringify(draft);
    if (review !== values) {
      add.action = { tool: 'library.add_member', label: 'Add member', arguments: { ...draft } };
      review = values;
    }
  }
  for (const [number, panel] of panels.entries()) panel.hidden = number !== index;
  steps.fill = fill('steps', { label: 'Member steps', labels, current: index });
  progress.fill = fill('progress', { label: 'Wizard progress', maximum: labels.length, value: index + 1 });
  if (focus) headings[index].focus();
}

steps.addEventListener('mu-step-change', ({ detail: { index } }) => showMemberStep(index));
showMemberStep(0, false);
