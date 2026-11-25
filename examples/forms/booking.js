import { define } from '../../src/components/index.js';
import { createKit, fill, onAction } from '../../src/kit.js';

define();

const { mount } = createKit({ actor: { type: 'agent', id: 'agent-bookings', name: 'Booking helper' } });
const editable = { dates: 'Booking dates', start_time: 'Start time', setup: 'Setup date and time' };
const action = { tool: 'rooms.save_booking', label: 'Save booking', title: 'Room booking', editable };
const form = mount('editable-form', { title: action.title, submit_label: action.label, fields: [
  fill('date-range-field', { name: 'dates', label: editable.dates, value: ['2028-04-10', '2028-04-11'],
    earliest: '2028-04-01', latest: '2028-04-30' }),
  fill('time-field', { name: 'start_time', label: editable.start_time, value: '10:00', earliest: '08:00', latest: '18:00',
    step: 15, hint: 'Use 15-minute steps from 08:00 to 18:00.' }),
  fill('date-time-field', { name: 'setup', label: editable.setup, value: '2028-04-10T09:00', time_zone: 'Europe/Oslo' }),
] }, { action });

const request = document.createElement('section');
request.setAttribute('aria-label', 'Last request');
request.hidden = true;
const log = document.createElement('pre');
request.append(log);
onAction(form, async (_tool, args) => {
  log.textContent = JSON.stringify(args, null, 2);
  request.hidden = false;
  return { ok: true, message: 'The service saved the booking.' };
});
document.getElementById('main').append(form, request);
