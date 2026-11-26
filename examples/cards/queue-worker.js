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
  'actions/action.js', 'components/chart.js', 'components/data-grid.js', 'components/dialog.js', 'components/image.js',
  'components/index.js', 'components/navigation.js', 'components/panels.js', 'components/pending.js', 'components/popovers.js', 'components/progress.js', 'components/receipt.js', 'components/rich-text.js', 'components/status.js',
  'components/table.js', 'components/upload.js', 'envelope/envelope.js', 'kit.js', 'narration/check.js',
  'offline/queue.js', 'offline/source.js', 'primitives/base.js', 'primitives/choice-list.js', 'primitives/date-time-fields.js',
  'primitives/fields.js', 'primitives/index.js',
  'primitives/multi-choice-field.js',
  'primitives/range-field.js', 'primitives/read-more.js', 'primitives/select-field.js',
  'render/catalog.js', 'render/dom.js', 'render/range.js', 'render/registry.js', 'render/resolve.js',
  'render/validate.js', 'styles/page.css', 'thread/index.js', 'tokens/tokens.css',
];
const CATALOG = [
  'accordion.json', 'action-button.json', 'action-queue.json', 'app-shell.json', 'breadcrumbs.json', 'button.json', 'card-grid.json', 'card.json', 'chart-series.json',
  'chart.json', 'choice-cell.json', 'choice-field.json', 'citation.json', 'data-grid-column.json',
  'data-grid-row.json', 'data-grid.json', 'date-cell.json', 'date-field.json', 'date-range-field.json', 'date-time-field.json', 'diff-change.json',
  'diff-part.json', 'diff.json', 'dialog.json', 'drawer.json', 'editable-form.json', 'excerpt.json', 'fact.json', 'field.json',
  'form-card.json', 'form-line.json', 'form-section.json', 'grid.json', 'image.json', 'long-text-field.json', 'menu.json', 'multi-choice-field.json',
  'number-cell.json', 'number-field.json', 'pagination.json', 'progress.json', 'queued-action.json', 'range-field.json', 'rich-code.json', 'rich-heading.json',
  'rich-link.json', 'rich-list.json', 'rich-paragraph.json', 'rich-quote.json', 'rich-span.json',
  'rich-text.json', 'schema/contract.schema.json', 'schema/defaults.json', 'schema/fill.schema.json',
  'schema/short.schema.json', 'select-field.json', 'source-status.json', 'stack.json', 'status.json', 'steps.json', 'table-row.json', 'table.json',
  'tabs.json', 'text-cell.json', 'text.json', 'time-field.json', 'toast.json', 'toggle-field.json', 'tooltip.json', 'upload.json',
];

mughamOffline.serve(self, { version: 'queue-example-14', files: [...PAGE, ...EXAMPLES.map((name) => '../' + name),
  ...SRC.map((name) => '../../src/' + name), ...CATALOG.map((name) => '../../catalog/' + name)] });
