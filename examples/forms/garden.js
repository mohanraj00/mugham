import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-garden', name: 'Garden helper' } });
const sun = ['Full sun', 'Morning sun', 'Part shade', 'Bright shade', 'Deep shade'];
const plants = [
  'Mist fern', 'Rain bell', 'Dune bell', 'Pebble reed', 'Glass moss', 'Drift vine',
  'Cloud leaf', 'Fog cup', 'Dew plume', 'Stone curl', 'Frost sprig', 'Grove star',
  'Brook frond', 'Pale fan', 'Shade tuft', 'Silt ribbon', 'Loam spike', 'Dawn frill',
  'Cliff flag', 'Ash plume', 'Pool lace', 'Meadow curl', 'Hollow reed', 'Vale fan',
  'Copper frond', 'Sand star', 'Silver sprig', 'Dusky plume', 'Glade ribbon', 'Moon tuft',
];
const editable = { sun: 'Sun levels', plants: 'Plants' };
const action = { tool: 'garden.save_bed', label: 'Save', title: 'Garden bed', editable, icon: 'check', display: 'icon' };
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [
  fill('multi-choice-field', { name: 'sun', label: editable.sun, choices: sun, value: ['Part shade'],
    min_items: 1, hint: 'Choose the sun levels of the bed during the day.' }),
  fill('multi-choice-field', { name: 'plants', label: editable.plants, choices: plants, value: [plants[0], plants[2]],
    max_items: 5, hint: 'Choose up to five plants for the bed.' }),
] }, { action });

const request = document.createElement('section');
request.setAttribute('aria-label', 'Last request');
request.hidden = true;
const log = document.createElement('pre');
request.append(log);
onAction(form, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the garden bed.' };
});
document.getElementById('main').append(form, request);
