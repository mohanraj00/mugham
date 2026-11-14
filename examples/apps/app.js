// Shared helpers of the example apps. Each app is a page of the application, and tools/apps_server.py is its
// fixture API. The page keeps no state of the API. It shows the records, the events and the receipts that the API gives.

// Reads one JSON record of the fixture API.
export async function api(path) {
  const response = await fetch('/api' + path, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
  return response.json();
}

// Sends one action request. The response of the API is the receipt. The kit does not decide.
export async function post(request) {
  const response = await fetch('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
  return response.json();
}

// Makes one element of the page. Each text goes into a text node, never into markup.
export function node(tag, attributes = {}, ...children) {
  const item = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
  for (const child of children) if (child !== null && child !== undefined) item.append(child);
  return item;
}

// Gives the events of the API to a thread. The API adds new events only at the end of the list, so the feed
// gives the thread each event that it did not give before.
export class Feed {
  #seen = 0;

  constructor(thread, path) {
    this.thread = thread;
    this.path = path;
  }

  async sync() {
    const { events } = await api(this.path);
    for (const event of events.slice(this.#seen)) this.thread.push(event);
    this.#seen = events.length;
  }
}

// Shows an error of the page as an alert. The text is a text node.
export function alert(where, error) {
  where.replaceChildren(node('p', { role: 'alert', class: 'alert' }, 'The page cannot read the API. ' + error.message));
}
