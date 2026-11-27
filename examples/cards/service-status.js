import { define } from '../../src/components/index.js';

define();

const services = [
  { label: 'Search', state: 'up', checked: '2026-11-27T09:30Z', group: 'North', version: '1.2.0' },
  { label: 'Store', state: 'refused', reason: 'The service refused the request.', group: 'North' },
  { label: 'Queue', state: 'unreachable', reason: 'No answer came back.' },
];
const strip = document.querySelector('mu-service-status');
const next = document.querySelector('#next-check');

function show(queue) {
  strip.fill = { component: 'service-status', version: '0.1.0', data: { services: [services[0], services[1], queue] } };
}

show(services[2]);
next.addEventListener('click', () => {
  const queue = strip.fill.data.services[2];
  show(queue.state === 'up' ? services[2] : { label: 'Queue', state: 'up', checked: '2026-11-27T09:31Z' });
});
