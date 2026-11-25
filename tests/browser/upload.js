// Expected texts, limits and states come from catalog/upload.json and src/components/upload.md.
// tools/browser_check.mjs imports the keyboard checks in Node and loads this page in each media mode.
// The synthetic files that the checks give to a file input. tools/browser_check.mjs writes them to a temporary
// folder, so the repository has no file of them. The API of the example reads only the first bytes of a file.
export const UPLOAD_FILES = Object.freeze({
  'receipt-a.pdf': '%PDF-1.4\n% Synthetic receipt A. Amount: 12 units.\n',
  'receipt-b.pdf': '%PDF-1.4\n% Synthetic receipt B. Amount: 30 units.\n',
  'receipt-a.txt': 'Synthetic receipt A. Amount: 12 units.\n',
  'note.pdf': 'Synthetic text. This file has the name of a PDF document, and it is not one.\n',
});

export async function uploadKeyboardChecks(session, sessionId, { evaluate, key }, page, fixture) {
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const state = () => evaluate(session, sessionId, 'window.muUploadState()');
  // The focus is on the first button of the page. The next Tab stop is the Choose files button.
  await key(session, sessionId, 'Tab', 'Tab', 9);
  let found = await state();
  check('Tab focuses the Choose files button', found.focus === 'Choose files', found);
  // The check takes the file chooser of the browser, so no dialog of the system opens.
  await session.send('Page.setInterceptFileChooserDialog', { enabled: true }, sessionId);
  try {
    const opened = session.once('Page.fileChooserOpened', sessionId, 5000);
    await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
    const chooser = await opened;
    check('Enter opens the file chooser for more than one file', chooser.mode === 'selectMultiple', chooser.mode);
    await session.send('DOM.setFileInputFiles', { files: [fixture], backendNodeId: chooser.backendNodeId }, sessionId);
    found = await state();
    check('The file of the chooser shows as Pending with its name and size', found.rows.join('|') === 'receipt-a.txt 39 bytes Pending'
      && found.requests === 0 && found.focus === 'Choose files', found);
    const again = session.once('Page.fileChooserOpened', sessionId, 5000);
    await key(session, sessionId, ' ', 'Space', 32, ' ');
    check('Space opens the file chooser', (await again).mode === 'selectMultiple', '');
  } finally {
    await session.send('Page.setInterceptFileChooserDialog', { enabled: false }, sessionId);
  }
  await key(session, sessionId, 'Tab', 'Tab', 9);
  found = await state();
  check('Tab moves to the Remove button of the file', found.focus === 'Remove receipt-a.txt', found);
  await key(session, sessionId, 'Tab', 'Tab', 9);
  found = await state();
  check('Tab moves to the Upload button', found.focus === 'Upload', found);
  await key(session, sessionId, 'Enter', 'Enter', 13, '\r');
  found = await state();
  check('Enter on Upload sends one request, and the file shows Uploading', found.requests === 1
    && found.rows.join('|') === 'receipt-a.txt 39 bytes Uploading' && found.state === 'pending', found);
  await evaluate(session, sessionId, 'window.muUploadAnswer()');
  found = await state();
  check('The file shows Done only after the receipt', found.rows.join('|') === 'receipt-a.txt 39 bytes Done Reference: F-0001'
    && found.state === 'done', found);
  return results;
}

// The flow of examples/forms/upload.html against the fixture API tools/upload_server.py. base is the address of that
// server. files has the paths of receipt-a.pdf, receipt-b.pdf, receipt-a.txt and note.pdf.
export async function uploadExampleChecks(session, sessionId, base, { evaluate, open, sleep }, files) {
  const page = 'examples/forms/upload.html';
  const results = [];
  const check = (name, ok, detail) => results.push({ page, step: name, ok: Boolean(ok), detail: JSON.stringify(detail) });
  const [first, second, text, note] = files;
  await open(session, sessionId, `${base}/${page}`);
  const read = () => evaluate(session, sessionId, `(async () => {
    const upload = document.querySelector('mu-upload');
    const root = upload.shadowRoot;
    const api = await (await fetch('/api/tickets/T-2041/files')).json();
    return { state: upload.dataset.state, limits: root.querySelector('[part="limits"]').textContent,
      rows: [...root.querySelectorAll('[part="file"]')].map((row) => [...row.querySelectorAll('[part="name"], [part="size"], [part="state"], [part="reference"]')].map((item) => item.textContent)
        .filter(Boolean).join(' ')).sort(),
      problems: [...root.querySelectorAll('[part="problems"] li')].map((item) => item.textContent),
      list: [...document.querySelectorAll('#files li')].map((item) => item.textContent), note: document.getElementById('note').textContent,
      api: api.files.map((file) => file.reference + ' ' + file.name + ' ' + file.size) };
  })()`);
  // Waits until the page shows the list of the API again, and no file waits for a receipt.
  const settled = async (count) => {
    let found = await read();
    for (let i = 0; i < 60 && (found.state === 'pending' || found.list.length !== count); i += 1) { await sleep(50); found = await read(); }
    return found;
  };
  // Gives files to the file input of the control, as the file chooser of the browser does.
  const pick = async (paths) => {
    const { result } = await session.send('Runtime.evaluate',
      { expression: `document.querySelector('mu-upload').shadowRoot.querySelector('input[type="file"]')` }, sessionId);
    await session.send('DOM.setFileInputFiles', { files: paths, objectId: result.objectId }, sessionId);
  };
  const send = () => evaluate(session, sessionId, `document.querySelector('mu-upload').shadowRoot.querySelector('[part="send"]').click(), true`);

  let found = await settled(0);
  check('the page binds the limits and the ticket has no file', found.state === 'default' && found.note === 'The ticket has no file.'
    && found.limits === 'Accepted types: application/pdf, .pdf. Each file: 2 MB maximum. 3 files maximum.' && found.api.length === 0, found);
  await pick([first, second, text]);
  found = await read();
  check('two PDF receipts show Pending, and the control refuses the text file before a request',
    found.rows.join('|') === 'receipt-a.pdf 50 bytes Pending|receipt-b.pdf 50 bytes Pending' && found.api.length === 0
    && found.problems.join('|') === 'receipt-a.txt: This file type is not accepted. Accepted types: application/pdf, .pdf.', found);
  await send();
  found = await settled(2);
  // The API gives the references in the sequence of the requests that it gets.
  const done = /^receipt-a\.pdf 50 bytes Done: The file is on ticket T-2041\. Reference: F-000[12]\|receipt-b\.pdf 50 bytes Done: The file is on ticket T-2041\. Reference: F-000[12]$/;
  check('each receipt shows Done with the reference of the API, and the API keeps the two files', done.test(found.rows.join('|'))
    && found.state === 'done' && found.api.length === 2 && found.api.map((item) => item.slice(0, 6)).join('|') === 'F-0001|F-0002'
    && found.list.length === 2 && found.list.every((item, index) => item === found.api[index].replace(' ', ': ').replace(/ (\d+)$/, ', $1 bytes')), found);
  await pick([first]);
  found = await read();
  check('the control refuses a file that is already in the list', found.rows.length === 2
    && found.problems.join('|') === 'receipt-a.pdf: This file is already in the list.', found);
  await pick([note]);
  await send();
  found = await settled(2);
  check('the API decides: a file that is not a PDF document shows Not done with the reason of the API',
    found.rows.includes('note.pdf 77 bytes Not done: The content of the file is not a PDF document.') && found.state === 'error'
    && found.api.length === 2, found);
  return results;
}

async function browserChecks() {
  const { MuUpload, bytes } = await import('../../src/components/upload.js');
  const { define } = await import('../../src/thread/index.js');
  const { CATALOG } = await import('../../src/render/catalog.js');
  define();

  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const AUTHOR = { type: 'agent', id: 'agent-desk', name: 'Desk helper' };
  const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
  const BINDING = { tool: 'ticket.attach', arguments: { ticket_id: 'T-2041' }, label: 'Attach receipts', accept: ['application/pdf', '.pdf'], max_size: 1000, max_files: 3 };
  const fill = (data = {}) => ({ component: 'upload', version: '0.1.0', slots: { authorship: AUTHOR },
    data: { label: 'Attach receipts', help: 'Add the receipts of the ticket.', ...data } });
  const pdf = (name, size = 400, type = 'application/pdf') => new File([new Uint8Array(size)], name, { type, lastModified: 1 });
  const stage = document.getElementById('stage');
  const root = (element) => element.shadowRoot;
  const part = (element, name) => root(element).querySelector(`[part="${name}"]`);
  const refusal = (element) => (element.dataset.state === 'refused' ? root(element).querySelector('[role="status"] [part="reason"]')?.textContent : null);
  const thrown = (act) => { try { act(); return ''; } catch (error) { return `${error.name}: ${error.message}`; } };
  function mount(value = fill(), binding = BINDING, parent = stage) {
    const element = new MuUpload();
    element.actor = AUTHOR;
    if (binding) element.action = binding;
    element.requests = [];
    element.receipts = [];
    element.addEventListener('mu-upload', (event) => element.requests.push(event.detail));
    element.addEventListener('mu-receipt', (event) => element.receipts.push(event.detail));
    parent.append(element);
    element.fill = value;
    return element;
  }
  const transfer = (list) => { const data = new DataTransfer(); for (const item of list) data.items.add(item); return data; };
  // The file picker gives its files with a change event. A drop gives its files with a drop event.
  const pick = (element, ...list) => {
    const input = root(element).querySelector('input[type="file"]');
    input.files = transfer(list).files;
    input.dispatchEvent(new Event('change'));
  };
  const drop = (element, ...list) => part(element, 'drop').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer(list), bubbles: true, cancelable: true }));
  const rows = (element) => [...root(element).querySelectorAll('[part="file"]')].map((row) =>
    [...row.querySelectorAll('[part="name"], [part="size"], [part="state"], [part="reference"]')].map((item) => item.textContent).filter(Boolean).join(' '));
  const problems = (element) => [...root(element).querySelectorAll('[part="problems"] li')].map((item) => item.textContent);
  const summary = (element) => root(element).querySelector('[part="status"] p').textContent;
  const send = (element) => part(element, 'send').click();
  const last = (element) => element.requests[element.requests.length - 1];

  // The control shows the label and the help text of the fill, and the limits of the page.
  const upload = mount();
  const input = root(upload).querySelector('input[type="file"]');
  check('control: the fill is valid', upload.dataset.state === 'default' && upload.fill !== null, root(upload).textContent);
  check('control: the group has the label of the fill', part(upload, 'upload')?.getAttribute('role') === 'group'
    && part(upload, 'upload').getAttribute('aria-label') === 'Attach receipts' && part(upload, 'label')?.textContent === 'Attach receipts');
  check('control: the help text shows', part(upload, 'help')?.textContent === 'Add the receipts of the ticket.');
  check('control: the limits of the page show as text', part(upload, 'limits')?.textContent
    === 'Accepted types: application/pdf, .pdf. Each file: 1 kB maximum. 3 files maximum.', part(upload, 'limits')?.textContent);
  check('control: the file picker is a hidden input with the limits of the page', input?.hidden === true && input.multiple === true
    && input.accept === 'application/pdf,.pdf' && getComputedStyle(input).display === 'none');
  check('control: the buttons are Choose files and Upload', part(upload, 'choose')?.textContent === 'Choose files'
    && part(upload, 'choose').getAttribute('aria-disabled') === 'false' && part(upload, 'send')?.textContent === 'Upload'
    && part(upload, 'send').getAttribute('aria-disabled') === 'true');
  check('control: the author shows as text', part(upload, 'authorship')?.textContent === 'Author: agent agent-desk (Desk helper)');
  send(upload);
  check('control: Upload with no file sends no request', upload.requests.length === 0);

  // The control reads only the name, the type and the size of a file. Count each read of the content.
  let reads = 0;
  const spied = [];
  for (const [owner, name] of [[Blob.prototype, 'arrayBuffer'], [Blob.prototype, 'text'], [Blob.prototype, 'stream'], [Blob.prototype, 'slice'],
    [Blob.prototype, 'bytes'], [FileReader.prototype, 'readAsArrayBuffer'], [FileReader.prototype, 'readAsText'], [FileReader.prototype, 'readAsDataURL'],
    [FileReader.prototype, 'readAsBinaryString'], [URL, 'createObjectURL']]) {
    if (typeof owner[name] !== 'function') continue;
    const real = owner[name];
    owner[name] = function spy(...values) { reads += 1; return real.apply(this, values); };
    spied.push(() => { owner[name] = real; });
  }

  // A picker and a drop put valid files in the list. No request starts before a person presses Upload.
  const first = pdf('receipt-a.pdf');
  pick(upload, first);
  check('picker: a valid file shows its name, its size and Pending', rows(upload).join('|') === 'receipt-a.pdf 400 bytes Pending'
    && summary(upload) === '1 file to upload.' && upload.requests.length === 0 && upload.dataset.state === 'default');
  check('picker: the input is empty again, so the same file can be picked again', input.files.length === 0);
  const zone = part(upload, 'drop');
  const over = new DragEvent('dragover', { bubbles: true, cancelable: true });
  zone.dispatchEvent(over);
  check('drop: the zone permits a drop and shows it', over.defaultPrevented && zone.classList.contains('over'));
  const dropped = new DragEvent('drop', { dataTransfer: transfer([pdf('receipt-b.pdf', 999)]), bubbles: true, cancelable: true });
  zone.dispatchEvent(dropped);
  check('drop: a dropped file goes in the list and the browser does not open it', dropped.defaultPrevented && !zone.classList.contains('over')
    && rows(upload).join('|') === 'receipt-a.pdf 400 bytes Pending|receipt-b.pdf 999 bytes Pending' && summary(upload) === '2 files to upload.');
  check('each file has a Remove button with the file name', [...root(upload).querySelectorAll('[part="remove"]')].map((item) => item.getAttribute('aria-label')).join('|')
    === 'Remove receipt-a.pdf|Remove receipt-b.pdf' && part(upload, 'send').getAttribute('aria-disabled') === 'false');

  // The control refuses a file before a request, and the reason shows as text.
  const TYPES = 'This file type is not accepted. Accepted types: application/pdf, .pdf.';
  const REFUSED = [
    [pdf('notes.txt', 10, 'text/plain'), 'notes.txt: ' + TYPES],
    [pdf('notes.pdf', 10, 'text/plain'), 'notes.pdf: ' + TYPES],
    [pdf('receipt.exe', 10), 'receipt.exe: ' + TYPES],
    [pdf('.pdf', 10), '.pdf: ' + TYPES],
    [pdf('no-type.pdf', 10, ''), 'no-type.pdf: ' + TYPES],
    [pdf('large.pdf', 1001), 'large.pdf: This file is larger than the limit of 1 kB.'],
    [first, 'receipt-a.pdf: This file is already in the list.'],
  ];
  for (const [item, reason] of REFUSED) {
    pick(upload, item);
    check(`refused: ${reason}`, problems(upload).join('|') === reason && rows(upload).length === 2 && upload.requests.length === 0, problems(upload).join('|'));
  }
  drop(upload, pdf('receipt-c.PDF'), pdf('receipt-d.pdf'), pdf('notes.txt', 10, 'text/plain'));
  check('refused: a file over the file count, with one reason for each refused file', rows(upload).length === 3
    && rows(upload)[2] === 'receipt-c.PDF 400 bytes Pending'
    && problems(upload).join('|') === 'receipt-d.pdf: Too many files. The limit is 3 files.|notes.txt: Too many files. The limit is 3 files.'
    && upload.requests.length === 0, problems(upload).join('|'));
  check('refused: the reasons are in a status region', part(upload, 'status')?.getAttribute('role') === 'status'
    && part(upload, 'status').contains(part(upload, 'problems')));

  // A person can remove a file before the upload. The focus goes to the next Remove button.
  const removes = () => [...root(upload).querySelectorAll('[part="remove"]')].filter((item) => !item.hidden);
  removes()[1].focus();
  removes()[1].click();
  check('remove: the file leaves the list and the focus goes to the next file', rows(upload).join('|')
    === 'receipt-a.pdf 400 bytes Pending|receipt-c.PDF 400 bytes Pending' && root(upload).activeElement?.getAttribute('aria-label') === 'Remove receipt-c.PDF'
    && problems(upload).length === 0 && summary(upload) === '2 files to upload.' && upload.requests.length === 0);

  // Upload sends one request for each file. The file shows Done only after its receipt.
  send(upload);
  const [one, two] = upload.requests;
  check('upload: one request for each file, with the tool and the arguments of the page', upload.requests.length === 2
    && one.tool === 'ticket.attach' && JSON.stringify(one.arguments) === '{"name":"receipt-a.pdf","size":400,"type":"application/pdf","ticket_id":"T-2041"}'
    && two.arguments.name === 'receipt-c.PDF' && one.id !== two.id && Object.isFrozen(one) && Object.isFrozen(one.arguments), JSON.stringify(one));
  check('upload: the request has the file that the person gave', one.file === first && two.file instanceof File);
  check('upload: each file shows Uploading, and nothing shows Done', rows(upload).join('|') === 'receipt-a.pdf 400 bytes Uploading|receipt-c.PDF 400 bytes Uploading'
    && upload.dataset.state === 'pending' && upload.action.state === 'pending' && removes().length === 0
    && part(upload, 'send').getAttribute('aria-disabled') === 'true' && summary(upload) === 'Uploading 2 files.' && !root(upload).textContent.includes('Done'));
  send(upload);
  check('upload: a second press sends no second request', upload.requests.length === 2);
  check('receipt: a different id, a missing ok and a long message are not receipts', upload.receipt({ id: 'other', ok: true }) === false
    && upload.receipt({ id: one.id }) === false && upload.receipt({ id: one.id, ok: true, message: 'x'.repeat(201) }) === false
    && upload.receipt({ id: one.id, ok: true, reference: 'x'.repeat(81) }) === false && upload.receipt(null) === false
    && rows(upload)[0] === 'receipt-a.pdf 400 bytes Uploading');
  for (const [field, request] of [['message', one], ['reference', two]]) {
    const before = rows(upload).join('|');
    const accepted = upload.receipt({ id: request.id, ok: true, [field]: null });
    check(`receipt: a null ${field} leaves the file pending`, accepted === false
      && rows(upload).join('|') === before && upload.action.state === 'pending' && upload.receipts.length === 0);
  }
  check('receipt: the receipt of the request is accepted', upload.receipt({ id: one.id, ok: true, reference: 'F-0001' }) === true);
  check('receipt: Done and the reference show after the receipt', rows(upload).join('|')
    === 'receipt-a.pdf 400 bytes Done Reference: F-0001|receipt-c.PDF 400 bytes Uploading' && upload.dataset.state === 'pending');
  check('receipt: the control sends a receipt event', upload.receipts.length === 1 && JSON.stringify(upload.receipts[0])
    === JSON.stringify({ id: one.id, name: 'receipt-a.pdf', size: 400, ok: true, message: '', reference: 'F-0001' }));
  check('receipt: a second receipt for one file changes nothing', upload.receipt({ id: one.id, ok: false }) === false && rows(upload)[0].includes('Done'));
  upload.receipt({ id: two.id, ok: false, message: 'The API refused this file.' });
  check('receipt: a refusal of the API shows Not done and the reason', rows(upload)[1] === 'receipt-c.PDF 400 bytes Not done: The API refused this file.'
    && upload.dataset.state === 'error' && upload.action.state === 'default' && removes().length === 1
    && part(upload, 'send').getAttribute('aria-disabled') === 'false' && summary(upload) === 'Done: 1 file. Not done: 1 file.');
  send(upload);
  check('upload: a new press sends the file that is not done again, with a new id', upload.requests.length === 3 && last(upload).arguments.name === 'receipt-c.PDF'
    && last(upload).id !== two.id && rows(upload)[1] === 'receipt-c.PDF 400 bytes Uploading');
  check('receipt: the old id of a file is not valid', upload.receipt({ id: two.id, ok: true }) === false);
  upload.receipt({ id: last(upload).id, ok: true });
  check('each file is Done', upload.dataset.state === 'done' && summary(upload) === 'Done: 2 files.' && removes().length === 0
    && part(upload, 'send').getAttribute('aria-disabled') === 'true');
  check('a file that is Done has no Remove button', [...root(upload).querySelectorAll('[part="remove"]')].every((item) => item.hidden
    && getComputedStyle(item).display === 'none'));
  // New data from the application keeps the files and their states.
  upload.fill = fill({ help: 'Two receipts are here.' });
  check('new data: the files and their states stay', part(upload, 'help').textContent === 'Two receipts are here.'
    && rows(upload).join('|') === 'receipt-a.pdf 400 bytes Done Reference: F-0001|receipt-c.PDF 400 bytes Done' && upload.dataset.state === 'done');
  const doneSend = part(upload, 'send');
  send(upload);
  check('receipt: the done upload button keeps full opacity and sends no more files',
    doneSend.getAttribute('aria-disabled') === 'true' && getComputedStyle(doneSend).opacity === '1' && upload.requests.length === 3);
  check('the control never reads the content of a file', reads === 0, reads);
  check('the control shows no preview', !root(upload).querySelector('img, picture, object, embed, iframe, video, audio, canvas, svg, a'));
  for (const restore of spied) restore();

  // Markup in a file name shows as text and makes no element.
  const marked = mount();
  const name = MARKUP + '.pdf';
  pick(marked, pdf(name), pdf(MARKUP + '.txt', 10, 'text/plain'));
  const reasons = problems(marked);
  send(marked);
  marked.receipt({ id: last(marked).id, ok: false, message: MARKUP, reference: MARKUP.slice(0, 80) });
  check('markup: a file name, a reason, a message and a reference show as text', part(marked, 'name')?.textContent === name
    && part(marked, 'remove').getAttribute('aria-label') === 'Remove ' + name && reasons.join('|') === `${MARKUP}.txt: ${TYPES}`
    && part(marked, 'state').textContent === 'Not done: ' + MARKUP && part(marked, 'reference').textContent === 'Reference: ' + MARKUP.slice(0, 80)
    && last(marked).arguments.name === name);
  check('markup: no element and no handler appears', !root(marked).querySelector('img, script, a, [href], [src], [style], [onerror]') && window.muUnsafe === undefined);
  const text = mount(fill({ label: MARKUP.slice(0, 80), help: MARKUP }), { ...BINDING, label: MARKUP.slice(0, 80) });
  check('markup: a label and a help text show as text', text.dataset.state === 'default' && part(text, 'label').textContent === MARKUP.slice(0, 80)
    && part(text, 'help').textContent === MARKUP && !root(text).querySelector('img, script, a, [href], [src], [style], [onerror]') && window.muUnsafe === undefined);

  // A fill cannot set the limits or the target. The page binds them in code.
  for (const [data, reason] of [
    [{ accept: ['image/png'] }, 'data.accept: the accepted types are not the types that the page binds'],
    [{ accept: ['application/pdf'] }, 'data.accept: the accepted types are not the types that the page binds'],
    [{ accept: ['application/pdf', '.pdf', '.exe'] }, 'data.accept: the accepted types are not the types that the page binds'],
    [{ accept: ['.pdf', '.pdf'] }, 'data.accept: the accepted types are not the types that the page binds'],
    [{ max_size: 1000000000 }, 'data.max_size: the size limit is not the limit that the page binds'],
    [{ max_files: 20 }, 'data.max_files: the file count is not the count that the page binds'],
    [{ target: 'https://example.org/upload' }, 'data.target: the contract does not declare this field'],
    [{ tool: 'ticket.delete' }, 'data.tool: the contract does not declare this field'],
    [{ url: 'https://example.org/upload' }, 'data.url: the contract does not declare this field'],
    [{ max_size: 0 }, 'data.max_size: less than the minimum 1'],
    [{ max_files: 21 }, 'data.max_files: more than the maximum 20'],
  ]) {
    const bad = mount(fill(data));
    check(`fill: ${reason}`, refusal(bad) === 'Refused upload: ' + reason && !root(bad).querySelector('button, input') && bad.fill === null, root(bad).textContent);
  }
  const same = mount(fill({ accept: ['.pdf', 'application/pdf'], max_size: 1000, max_files: 3 }));
  check('fill: a fill can repeat the limits of the page', same.dataset.state === 'default' && part(same, 'limits').textContent.startsWith('Accepted types: application/pdf, .pdf.'));
  const named = mount();
  check('fill: the label of the binding accepts the same label', named.dataset.state === 'default');
  named.fill = fill({ label: 'Send a photo' });
  check('fill: a label that is not the label of the binding is refused', refusal(named) === 'Refused upload: data.label: the label is not the label of the application');

  // The binding: page code gives the tool and the limits. With no binding, the control takes no file.
  const unbound = mount(fill(), null);
  pick(unbound, pdf('receipt-a.pdf'));
  drop(unbound, pdf('receipt-b.pdf'));
  check('binding: a control with no binding takes no file', unbound.dataset.state === 'disabled' && unbound.action.state === 'disabled' && rows(unbound).length === 0
    && part(unbound, 'choose').getAttribute('aria-disabled') === 'true' && part(unbound, 'send').getAttribute('aria-disabled') === 'true'
    && part(unbound, 'limits').textContent === 'This upload is not available.' && unbound.requests.length === 0);
  const LIMITS = 'accept must list 1 to 20 media types or file extensions in lower case, each one time';
  for (const [title, binding, reason] of [
    ['no label', { ...BINDING, label: undefined }, 'the label is necessary, because it names the target of the upload'],
    ['an empty label', { ...BINDING, label: '' }, 'the label must be a text of 1 to 80 characters'],
    ['a target address', { ...BINDING, url: 'https://example.org/upload' }, 'an upload accepts only tool, arguments, label, accept, max_size and max_files'],
    ['a callback', { ...BINDING, send: () => {} }, 'an upload accepts only tool, arguments, label, accept, max_size and max_files'],
    ['no accepted type', { ...BINDING, accept: [] }, LIMITS], ['no accept list', { ...BINDING, accept: undefined }, LIMITS],
    ['each type', { ...BINDING, accept: ['*/*'] }, LIMITS], ['a group of types', { ...BINDING, accept: ['image/*'] }, LIMITS],
    ['a type in upper case', { ...BINDING, accept: ['.PDF'] }, LIMITS], ['a type two times', { ...BINDING, accept: ['.pdf', '.pdf'] }, LIMITS],
    ['a size of 0', { ...BINDING, max_size: 0 }, 'max_size must be an integer from 1 to 1000000000'],
    ['a size that is not an integer', { ...BINDING, max_size: 1.5 }, 'max_size must be an integer from 1 to 1000000000'],
    ['no size', { ...BINDING, max_size: undefined }, 'max_size must be an integer from 1 to 1000000000'],
    ['21 files', { ...BINDING, max_files: 21 }, 'max_files must be an integer from 1 to 20'],
    ['a bound file name', { ...BINDING, arguments: { name: 'x' } }, 'a bound argument cannot have the name of a file value: name'],
    ['no tool', { ...BINDING, tool: '' }, 'the tool name is not valid'], ['a text', 'ticket.attach', 'the action must be an object'],
  ]) {
    check(`binding: ${title} is refused`, thrown(() => { unbound.action = binding; }) === 'TypeError: action: ' + reason && unbound.action.state === 'disabled',
      thrown(() => { unbound.action = binding; }));
  }
  unbound.action = { ...BINDING, max_files: 1 };
  check('binding: a binding of one file gives a picker for one file', unbound.dataset.state === 'default'
    && root(unbound).querySelector('input[type="file"]').multiple === false && part(unbound, 'limits').textContent.endsWith('1 file maximum.'));
  pick(unbound, pdf('receipt-a.pdf'), pdf('receipt-b.pdf'));
  check('binding: the file count applies to one pick', rows(unbound).length === 1 && problems(unbound).join() === 'receipt-b.pdf: Too many files. The limit is 1 file.');
  send(unbound);
  unbound.action = BINDING;
  check('binding: a new binding removes the files of the old binding', rows(unbound).length === 0 && unbound.dataset.state === 'default'
    && unbound.receipt({ id: last(unbound).id, ok: true }) === false);
  const onlyType = mount(fill(), { ...BINDING, accept: ['text/plain'] });
  pick(onlyType, pdf('notes', 10, 'text/plain'), pdf('notes.pdf', 10));
  check('binding: a list of media types only checks the type of the file', rows(onlyType).length === 1 && rows(onlyType)[0].startsWith('notes 10 bytes'));
  const sizes = [[1, '1 byte'], [999, '999 bytes'], [1000, '1 kB'], [1234, '1.2 kB'], [2000000, '2 MB'], [150000000, '150 MB'], [1000000000, '1 GB']];
  check('size: each size shows with a decimal unit', sizes.every(([size, words]) => bytes(size) === words), sizes.map(([size]) => bytes(size)).join('|'));
  const noActor = document.createElement('mu-upload');
  stage.append(noActor);
  noActor.fill = fill();
  check('author: a fill with no bound actor is refused', noActor.dataset.state === 'refused');
  const spoof = mount();
  spoof.fill = { ...fill(), slots: { authorship: { type: 'human', id: 'person-check' } } };
  check('author: a different author is refused', spoof.dataset.state === 'refused');

  // Tokens and media modes. Each file state shows in this mode.
  const css = MuUpload.styles.flatMap((item) => [...item.cssRules].map((rule) => rule.cssText)).join(' ');
  const declared = new Set(CATALOG.upload.tokens.map((token) => '--mu-' + token.replaceAll('.', '-')));
  const used = new Set(css.match(/--mu-[a-z0-9-]+/g) ?? []);
  check('the styles use each declared token and no other token', [...used].every((token) => declared.has(token)) && used.size === declared.size,
    [...used].filter((token) => !declared.has(token)).join(' ') + ' | ' + [...declared].filter((token) => !used.has(token)).join(' '));
  const media = { dark: '(prefers-color-scheme: dark)', 'forced-colors': '(forced-colors: active)', 'reduced-motion': '(prefers-reduced-motion: reduce)' };
  if (media[mode]) check('media: the requested mode is active', matchMedia(media[mode]).matches);
  const probe = document.createElement('span');
  stage.append(probe);
  const resolved = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const states = mount(fill(), { ...BINDING, max_files: 4 });
  pick(states, pdf('done.pdf'), pdf('not-done.pdf'), pdf('uploading.pdf'));
  send(states);
  states.receipt({ id: states.requests[0].id, ok: true, reference: 'F-0001' });
  const doneFile = part(states, 'file');
  const reference = doneFile.querySelector('[part="reference"]');
  const color = resolved(mode === 'forced-colors' ? 'CanvasText' : 'var(--mu-color-success)');
  check('receipt: the done file has a success edge, state text and a copy control next to the reference',
    getComputedStyle(doneFile).borderTopColor === color && getComputedStyle(part(states, 'state')).color === color
    && reference?.textContent === 'Reference: F-0001' && reference.checkVisibility()
    && reference.parentElement.querySelector('[part="copy"]')?.checkVisibility());
  states.receipt({ id: states.requests[1].id, ok: false, message: 'The API refused this file.' });
  pick(states, pdf('pending.pdf'), pdf('notes.txt', 10, 'text/plain'));
  const stateTexts = [...root(states).querySelectorAll('[part="state"]')];
  check(`${mode}: the states Done, Not done, Uploading and Pending show as text`, stateTexts.map((item) => item.textContent).join('|')
    === 'Done|Not done: The API refused this file.|Uploading|Pending' && stateTexts.every((item) => getComputedStyle(item).visibility === 'visible'
      && item.getBoundingClientRect().height > 0) && states.dataset.state === 'pending');
  const sendStyle = getComputedStyle(part(states, 'send'));
  const problemStyle = getComputedStyle(part(states, 'problems'));
  if (mode === 'forced-colors') {
    check('forced colors: the buttons have system colors', sendStyle.color === resolved('ButtonText') && sendStyle.borderTopColor === resolved('ButtonText')
      && getComputedStyle(part(states, 'choose')).color === resolved('ButtonText'));
    check('forced colors: the drop zone, the files and the reasons are visible', getComputedStyle(part(states, 'drop')).borderTopColor === resolved('CanvasText')
      && getComputedStyle(part(states, 'file')).borderTopColor === resolved('CanvasText') && problemStyle.color === resolved('CanvasText')
      && getComputedStyle(stateTexts[1]).color === resolved('CanvasText'));
  } else {
    probe.style.color = 'var(--mu-color-danger)';
    check(`${mode}: the reasons and Not done have the danger color`, problemStyle.color === getComputedStyle(probe).color
      && getComputedStyle(stateTexts[1]).color === getComputedStyle(probe).color && getComputedStyle(stateTexts[0]).color !== getComputedStyle(probe).color);
  }
  if (mode === 'reduced-motion') {
    check('reduced motion: no transition or animation', parseFloat(sendStyle.transitionDuration) === 0 && sendStyle.animationName === 'none');
  }

  // A thread shows an upload. The application gives the binding with bind and sends each file in perform.
  const thread = document.createElement('mu-thread');
  const performed = [];
  const settle = [];
  thread.bind = (value) => (value.component === 'upload' ? BINDING : undefined);
  thread.perform = (value) => new Promise((done) => { performed.push(value); settle.push(done); });
  stage.append(thread);
  const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
  thread.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'upload-message', activityType: 'mugham.fill',
    metadata: { mugham: { actor: AUTHOR } }, content: { format: 2, fill: fill() } });
  await frame();
  const inThread = root(thread).querySelector('mu-upload');
  check('thread: an upload part shows with the binding of the application', inThread?.dataset.state === 'default' && inThread.actor.id === AUTHOR.id);
  const sent = pdf('receipt-a.pdf');
  pick(inThread, sent, pdf('receipt-b.pdf'));
  send(inThread);
  await frame();
  check('thread: each file goes to perform with the request', performed.length === 2 && performed[0].file === sent && performed[0].tool === 'ticket.attach'
    && performed[0].arguments.ticket_id === 'T-2041' && inThread.dataset.state === 'pending');
  settle[0]({ ok: true, reference: 'F-0007' });
  settle[1]({ ok: true, message: 'x'.repeat(201) });
  await frame();
  check('thread: a valid receipt shows Done, and an invalid receipt leaves the file uploading', rows(inThread).join('|')
    === 'receipt-a.pdf 400 bytes Done Reference: F-0007|receipt-b.pdf 400 bytes Uploading', rows(inThread).join('|'));

  // New data keeps the files and the focus on the same control.
  const later = () => new Promise((done) => setTimeout(done, 0));
  const kept = mount();
  pick(kept, pdf('receipt-a.pdf'), pdf('receipt-b.pdf'));
  part(kept, 'send').focus();
  kept.fill = fill({ help: 'Add each receipt one time.' });
  await later();
  check('new fill: the files stay and the focus stays on the Upload button', rows(kept).length === 2 && root(kept).activeElement === part(kept, 'send')
    && part(kept, 'help').textContent === 'Add each receipt one time.');
  root(kept).querySelectorAll('[part="remove"]')[1].focus();
  kept.fill = fill();
  await later();
  check('new fill: the focus stays on the Remove button of the same file', root(kept).activeElement?.getAttribute('aria-label') === 'Remove receipt-b.pdf',
    root(kept).activeElement?.textContent);
  const off = mount(fill(), null);
  const offOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
  part(off, 'drop').dispatchEvent(offOver);
  check('drop: a control with no binding takes the drop event and shows no drop target', offOver.defaultPrevented && !part(off, 'drop').classList.contains('over'));

  // These checks moved the focus. Put the Tab start point before the keyboard target. The upload is the next Tab stop.
  const keyboard = document.getElementById('keyboard');
  const start = document.createElement('span');
  start.tabIndex = -1;
  keyboard.append(start);
  start.focus();
  const target = document.createElement('mu-button');
  target.fill = { component: 'button', version: '0.1.0', data: { label: 'Keyboard target' } };
  let presses = 0;
  target.addEventListener('mu-press', () => { presses += 1; });
  keyboard.append(target);
  const keyed = mount(fill({ label: 'Attach a note' }), { ...BINDING, label: 'Attach a note', accept: ['text/plain', '.txt'] }, keyboard);
  window.muPresses = () => presses;
  window.muUploadState = () => {
    const focused = root(keyed).activeElement;
    return { focus: focused ? focused.getAttribute('aria-label') ?? focused.textContent : null, rows: rows(keyed), requests: keyed.requests.length,
      state: keyed.dataset.state };
  };
  window.muUploadAnswer = () => keyed.receipt({ id: last(keyed).id, ok: true, reference: 'F-0001' });
  window.muChecks = { mode, results };
}

if (typeof window !== 'undefined') await browserChecks();
