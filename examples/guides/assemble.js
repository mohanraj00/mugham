// The code of docs/guides/assemble.md. The page acts as the application. All data is synthetic and neutral.
import { define } from '../../src/components/index.js';
import { createKit, fill, mount, onAction } from '../../src/kit.js';
import { define as defineThread } from '../../src/thread/index.js';
import EVENTS from './assemble-events.json' with { type: 'json' };

// Step 2: define the elements. The components define also defines the primitives.
define();
defineThread();

// Step 3: a stack that holds a grid of two cards.
const AGENT = { type: 'agent', id: 'agent-loans', name: 'Loan helper' };
const kit = createKit({ actor: AGENT });

const stack = mount('stack', { label: 'Loans of Robin', gap: 'large' });
const grid = mount('grid', { label: 'Current loans', min_column: 'medium' }, { parent: stack });
const card = (title, date, shelf) => kit.mount('card', {
  title, date, date_label: 'Due', facts: [fill('fact', { label: 'Shelf', value: shelf })],
}, { parent: grid });
const moss = card('Field guide to moss', '2026-12-01', 'B-14');
card('A short history of maps', '2026-12-09', 'A-31');

// Step 4: an action button. The application binds the tool in code. The fill gives only the label.
const renewAction = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };
const renew = mount('action-button', { label: 'Renew' }, { parent: moss, slot: 'actions', action: renewAction });

// A synthetic API. A real page sends the request to the API of its application, and that API decides.
// The response is the receipt.
let receipts = 0;
async function api(request) {
  await new Promise((done) => setTimeout(done, 300));
  receipts += 1;
  return { id: request.id, ok: true, message: 'The loan is renewed.', reference: 'R-' + String(receipts).padStart(4, '0') };
}

// Step 5: send the request and give the receipt to the element.
onAction(renew, (tool, args, id, request) => api(request));

// Action labels in docs/guides/agents.md. A synthetic value stands in for the model response.
const replyAction = {
  tool: 'library.send_reply', label: 'Send reply', title: 'Reply about loan L-0001',
  arguments: { loan_id: 'L-0001' }, editable: { reply: 'Reply' },
};
const modelData = { reply: 'Your loan is due on 2026-12-01.' };
const replyForm = kit.mount('editable-form', {
  title: replyAction.title,
  submit_label: replyAction.label,
  fields: [fill('field', { name: 'reply', label: replyAction.editable.reply, value: modelData.reply })],
}, { parent: stack, action: replyAction });
onAction(replyForm, (tool, args, id, request) => ({ id: request.id, ok: true, message: 'The synthetic API received the reply.' }));

const thread = document.querySelector('mu-thread');
thread.before(stack);

// Step 6: the thread. The application binds the tool of each action part, and perform sends the request.
thread.bind = (part) => (part.component === 'action-button'
  ? { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0002' } } : undefined);
thread.perform = (request) => api(request);

// The event source. A real page reads its transport, for example server-sent events. This one gives
// synthetic AG-UI 1.0 events with a short delay, so the messages stream in.
async function* source(events) {
  for (const event of events) {
    await new Promise((done) => setTimeout(done, 40));
    yield event;
  }
}
thread.read(source(EVENTS));
