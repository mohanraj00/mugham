// An example page with an upload control: a person attaches synthetic PDF receipts to a ticket.
// The page acts as the application, and tools/upload_server.py is its fixture API. The page binds the tool
// and the limits. The kit sends no data: the page sends each file, and the API decides and gives the receipt.
// All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();

const TICKET = 'T-2041';
const FILES = `/api/tickets/${TICKET}/files`;
const AGENT = { type: 'agent', id: 'agent-desk', name: 'Desk helper' };
// The label names the target of the upload. The application gives it, and a fill cannot show a different label.
const LABEL = `Attach receipts to ticket ${TICKET}`;
const main = document.getElementById('main');

const node = (name, text) => {
  const element = document.createElement(name);
  element.textContent = text;
  return element;
};

const { mount } = createKit({ actor: AGENT });
// The application binds the target and the limits in code.
const upload = mount('upload', { label: LABEL, help: 'Add the PDF receipts of the ticket.' }, {
  action: { tool: 'ticket.attach', arguments: { ticket_id: TICKET }, label: LABEL, accept: ['application/pdf', '.pdf'], max_size: 2000000, max_files: 3 },
});

const list = document.createElement('ul');
list.id = 'files';
const note = node('p', '');
note.id = 'note';
note.setAttribute('role', 'status');

// The list of the ticket comes from the API, not from the page. Each name shows as text.
async function load() {
  try {
    const response = await fetch(FILES);
    if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
    const { files } = await response.json();
    list.replaceChildren(...files.map((file) => node('li', `${file.reference}: ${file.name}, ${file.size} bytes`)));
    note.textContent = files.length ? '' : 'The ticket has no file.';
  } catch (error) {
    note.textContent = 'The fixture API is not available. Run tools/upload_server.py. ' + error.message;
  }
}

// The kit gives one request for each file. The page sends the file with its own transport.
// The file shows Done only after the receipt of the API.
document.addEventListener('mu-upload', async (event) => {
  const { id, arguments: values, file } = event.detail;
  let receipt;
  try {
    const response = await fetch(FILES, { method: 'POST', body: file,
      headers: { 'content-type': values.type, 'x-file-name': encodeURIComponent(values.name), 'x-request-id': id } });
    if (!response.ok) throw new Error(`The API gave the status ${response.status}.`);
    receipt = await response.json();
  } catch (error) {
    receipt = { id, ok: false, message: 'The API gave no receipt. ' + error.message };
  }
  event.target.receipt(receipt);
});

document.addEventListener('mu-receipt', load);

main.append(node('h1', `Ticket ${TICKET}`), node('p', 'A synthetic ticket of a help desk. The fixture API keeps each file in memory only.'),
  upload, node('h2', 'Files on the ticket'), note, list);
load();
