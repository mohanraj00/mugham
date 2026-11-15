// Expected number rules come from catalog/chart-series.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import chart from '../catalog/chart.json' with { type: 'json' };
import series from '../catalog/chart-series.json' with { type: 'json' };
import { fillErrors } from '../src/render/validate.js';

test('each chart type accepts numbers and refuses non-finite or non-number values', () => {
  for (const type of ['bar', 'line', 'stacked_bar']) {
    const fill = (values) => ({ component: 'chart', version: '0.1.0', slots: { authorship: { type: 'agent', id: 'check' } },
      data: { title: 'Weekly count', type, units: 'tickets', x_label: 'Week', y_label: 'Count', categories: ['Week 1'],
        series: [{ component: 'chart-series', version: '0.1.0', data: { label: 'Received', values } }] } });
    for (const value of [0, -1, 0.25, 1e12, -1e12, Number.MIN_VALUE]) {
      assert.deepEqual(fillErrors(fill([value]), { chart, 'chart-series': series }), []);
    }
    for (const value of ['1', null, true, NaN, Infinity, -Infinity]) {
      assert.deepEqual(fillErrors(fill([value]), { chart, 'chart-series': series }),
        ['data.series[0].data.values[0]: must be a number']);
    }
    assert.deepEqual(fillErrors(fill(Array(51).fill(0)), { chart, 'chart-series': series }),
      ['data.series[0].data.values: more than 50 items']);
  }
});
