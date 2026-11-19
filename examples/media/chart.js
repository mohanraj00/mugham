// All counts are synthetic. The page gives the trusted actor.
import { define } from '../../src/components/index.js';
import { createKit, fill } from '../../src/kit.js';

define();
const AUTHOR = { type: 'agent', id: 'agent-counts' };
const { mount } = createKit({ actor: AUTHOR });
const series = (label, values) => fill('chart-series', { label, values });
for (const [type, title, data] of [
  ['bar', 'Synthetic weekly tickets', [series('Received', [12, 8, 15]), series('Closed', [9, 10, 11])]],
  ['line', 'Synthetic weekly visits', [series('North area', [18, 14, 21]), series('South area', [12, 16, 19])]],
  ['stacked_bar', 'Synthetic weekly tasks', [series('Group A', [6, 8, 5]), series('Group B', [4, 3, 7])]],
]) {
  mount('chart', {
    title, type, categories: ['Week 1', 'Week 2', 'Week 3'], series: data,
    units: 'count', x_label: 'Week', y_label: 'Count',
  }, { parent: document.getElementById('main') });
}
