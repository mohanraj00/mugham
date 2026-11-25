// The service worker of the offline queue example. The application owns this file. It gives the kit the list of
// the files of the page. The kit keeps only these files, so the page loads offline. It keeps no API response.
// tests/browser/queue.js checks that the list has each file that the page loads.
// tests/worker.test.mjs checks that the list has each kit module.
importScripts('../../src/offline/worker.js');

const PAGE = [
  'queue.html', 'queue.js',
];
const EXAMPLES = [
  'docs.js', 'docs.json', 'examples.json', 'frame.css', 'frame.js', 'page.css',
];
const SRC = [
  'actions/action.js', 'components/chart.js', 'components/data-grid.js', 'components/image.js',
  'components/index.js', 'components/receipt.js', 'components/rich-text.js', 'components/status.js',
  'components/table.js', 'components/upload.js', 'envelope/envelope.js', 'kit.js', 'narration/check.js',
  'offline/queue.js', 'offline/source.js', 'primitives/base.js', 'primitives/fields.js', 'primitives/index.js',
  'primitives/read-more.js', 'render/catalog.js', 'render/dom.js', 'render/registry.js', 'render/resolve.js',
  'render/validate.js', 'styles/page.css', 'thread/index.js', 'tokens/tokens.css',
];
const CATALOG = [
  'action-button.json', 'action-queue.json', 'button.json', 'card-grid.json', 'card.json', 'chart-series.json',
  'chart.json', 'choice-cell.json', 'choice-field.json', 'citation.json', 'data-grid-column.json',
  'data-grid-row.json', 'data-grid.json', 'date-cell.json', 'date-field.json', 'diff-change.json',
  'diff-part.json', 'diff.json', 'editable-form.json', 'excerpt.json', 'fact.json', 'field.json',
  'form-card.json', 'form-line.json', 'form-section.json', 'grid.json', 'image.json', 'long-text-field.json',
  'number-cell.json', 'number-field.json', 'queued-action.json', 'rich-code.json', 'rich-heading.json',
  'rich-link.json', 'rich-list.json', 'rich-paragraph.json', 'rich-quote.json', 'rich-span.json',
  'rich-text.json', 'schema/contract.schema.json', 'schema/defaults.json', 'schema/fill.schema.json',
  'schema/short.schema.json', 'source-status.json', 'stack.json', 'status.json', 'table-row.json', 'table.json',
  'text-cell.json', 'text.json', 'upload.json',
];

mughamOffline.serve(self, { version: 'queue-example-2', files: [...PAGE, ...EXAMPLES.map((name) => '../' + name),
  ...SRC.map((name) => '../../src/' + name), ...CATALOG.map((name) => '../../catalog/' + name)] });
