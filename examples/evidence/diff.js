// An example page with two diffs from an agent. The first diff compares two versions of a synthetic hall booking
// and its house rules. The second diff has more than 20 changes, so each part starts closed. The page acts as the
// application: it knows the actor of the message and gives it to each component. All data are synthetic and neutral.
import { define } from '../../src/components/index.js';

define();

const AGENT = { type: 'agent', id: 'agent-bookings', name: 'Bookings agent' };
const fill = (component, data) => ({ component, version: '0.1.0', data });
const change = (label, kind, before, after) => fill('diff-change', { label, change: kind,
  ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) });

function text(tag, words) {
  const node = document.createElement(tag);
  node.textContent = words;
  return node;
}

function diff(data) {
  const node = document.createElement('mu-diff');
  node.actor = AGENT;
  node.fill = { ...fill('diff', data), slots: { authorship: AGENT } };
  return node;
}

const BOOKING = diff({ title: 'Hall booking B-0042', before_label: 'Version 1', after_label: 'Version 2', parts: [
  fill('diff-part', { title: 'Booking', changes: [
    change('Room', 'unchanged', 'Main hall', 'Main hall'),
    change('Date', 'changed', '2026-12-05', '2026-12-12'),
    change('Guests', 'changed', '40', '55'),
    change('Kitchen', 'added', undefined, 'Yes, from 17:00'),
    change('Stage', 'removed', 'Small stage'),
  ] }),
  fill('diff-part', { title: 'House rules', changes: [
    change('Line 1', 'unchanged', 'Leave the hall clean and tidy.', 'Leave the hall clean and tidy.'),
    change('Line 2', 'changed', 'Music stops at 22:00.', 'Music stops at 23:00 on a Saturday.'),
    change('Line 3', 'added', undefined, 'Put the chairs back on the racks.'),
  ] }),
  fill('diff-part', { title: 'Contacts', changes: [
    change('Keyholder', 'unchanged', 'Hall office', 'Hall office'),
  ] }),
] });

const TIMETABLE = diff({ title: 'Weekly timetable', before_label: 'Autumn', after_label: 'Winter', parts: [
  fill('diff-part', { title: 'Rooms', changes: Array.from({ length: 24 }, (_, index) =>
    change(`Slot ${index + 1}`, 'changed', `Room ${(index % 3) + 1}`, `Room ${((index + 1) % 3) + 1}`)) }),
] });

function message(words, ...parts) {
  const node = document.createElement('article');
  node.setAttribute('aria-label', `Message from ${AGENT.name}`);
  node.append(text('p', `Agent: ${AGENT.name}`), text('p', words), ...parts);
  return node;
}

const main = document.getElementById('main');
main.append(text('h1', 'Mugham diff'),
  message('These are the changes to your booking. Open a part to see its changes.', BOOKING),
  message('The winter timetable moves 24 slots. Each part starts closed, because the diff is large.', TIMETABLE));
