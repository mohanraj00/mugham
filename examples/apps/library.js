import { define } from '../../src/components/index.js';
import { fill } from '../../src/kit.js';

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
