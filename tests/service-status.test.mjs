import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { fillErrors } from '../src/render/validate.js';

const service = { label: 'Search', state: 'up' };
const fill = (data) => ({ component: 'service-status', version: '0.1.0', data });
const errors = (services) => fillErrors(fill({ services }), CATALOG);

test('service-status accepts each declared state and optional details', () => {
  const markup = '<img src=x onerror=alert(1)>';
  assert.deepEqual(errors([
    service,
    { label: 'Store', state: 'refused', checked: '2026-11-27T09:30Z', reason: markup, group: markup, version: markup },
    { label: 'Queue', state: 'unreachable' },
  ]), []);
  assert.deepEqual(errors([]), []);
  assert.deepEqual(errors(Array(24).fill(service)), []);
});

test('service-status requires a bounded list of service records', () => {
  assert.deepEqual(fillErrors(fill({}), CATALOG), ['data.services: a required field is missing']);
  assert.deepEqual(errors('Search'), ['data.services: must be a list']);
  assert.deepEqual(errors([service, null]), ['data.services[1]: must be an object']);
  assert.deepEqual(errors(Array(25).fill(service)), ['data.services: more than 24 items']);
  assert.deepEqual(errors([{}]), [
    'data.services[0].label: a required field is missing',
    'data.services[0].state: a required field is missing',
  ]);
  assert.deepEqual(errors([{ ...service, state: 'down' }]), ['data.services[0].state: must be one of up, refused, unreachable']);
  assert.deepEqual(errors([{ ...service, url: '/check' }]), ['data.services[0].url: the contract does not declare this field']);
});

test('service-status applies the text limits in code points', () => {
  for (const [key, size] of Object.entries({ label: 80, reason: 200, checked: 40, group: 80, version: 40 })) {
    assert.deepEqual(errors([{ ...service, [key]: '𝔸'.repeat(size) }]), []);
    assert.deepEqual(errors([{ ...service, [key]: '' }]), [`data.services[0].${key}: fewer than 1 characters`]);
    assert.deepEqual(errors([{ ...service, [key]: 1 }]), [`data.services[0].${key}: must be a string`]);
    assert.deepEqual(errors([{ ...service, [key]: '𝔸'.repeat(size + 1) }]), [`data.services[0].${key}: more than ${size} characters`]);
  }
});

test('service-status declares a name, keyboard controls and media support', () => {
  const contract = CATALOG['service-status'];
  assert.equal(contract.ai_content, false);
  assert.deepEqual(contract.accessibility, {
    role: 'group', name: { text: 'Service status' }, keyboard: ['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape'],
    forced_colors: true, reduced_motion: true,
  });
});
