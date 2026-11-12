// An example of mu-thread. Two people and two agents talk about a synthetic library loan.
// The page acts as the application. tools/thread_server.py streams the events as server-sent events
// and gives the receipt of each action. The transport and the decisions belong to the application.
import { define } from '../src/thread/index.js';

define();

// The application binds the tool of the action part. A fill cannot select a tool.
const RENEW = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };

// The events of a server-sent event source, in order. The page parses the JSON of the transport.
// The source ends at the end event, so the browser does not connect again.
async function* events(url) {
  const source = new EventSource(url);
  const queue = [];
  let wake = null;
  let end = null;
  const next = () => { if (wake) { wake(); wake = null; } };
  source.addEventListener('message', (event) => {
    try {
      queue.push(JSON.parse(event.data));
    } catch {
      queue.push(null);
    }
    next();
  });
  source.addEventListener('end', () => { end = 'ended'; next(); });
  source.addEventListener('error', () => { end ??= 'failed'; next(); });
  try {
    for (;;) {
      while (queue.length) yield queue.shift();
      if (end === 'ended') return;
      if (end === 'failed') throw new Error('the event source failed');
      await new Promise((done) => { wake = done; });
    }
  } finally {
    source.close();
  }
}

const thread = document.querySelector('mu-thread');
thread.bind = (fill) => (fill.component === 'action-button' ? RENEW : undefined);
// The API decides. Its response is the receipt.
thread.perform = async (request) => {
  const response = await fetch('/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error('the API did not accept the request');
  return response.json();
};
thread.read(events('/events'));
