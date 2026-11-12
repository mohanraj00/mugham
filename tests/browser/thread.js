// In-page checks of mu-thread. tools/browser_check.mjs loads this page in each media mode and reads
// window.muChecks. Each expected result comes from src/thread/README.md, docs/contracts/envelope.md and
// the constitution: an action shows as done only after its receipt, and the content of an agent never
// shows as the content of a person.
import { define } from '../../src/thread/index.js';

define();

const MARKUP = '<img src=x onerror="window.muUnsafe=1"><script>window.muUnsafe=1</script>';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const stage = document.getElementById('stage');
const settle = () => new Promise((done) => setTimeout(done, 0));
const fill = (component, data) => ({ component, version: '0.1.0', data });
const actor = (type, id, name) => ({ mugham: { actor: name ? { type, id, name } : { type, id } } });
const ROBIN = actor('human', 'u-robin', 'Robin');
const SAM = actor('human', 'u-sam', 'Sam');
const CATALOG_AGENT = actor('agent', 'a-catalog', 'Catalog agent');
const RENEW_AGENT = actor('agent', 'a-renew', 'Renewal agent');
const say = (messageId, metadata, text, role = 'user') => [
  { type: 'TEXT_MESSAGE_START', messageId, role, metadata },
  { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text },
  { type: 'TEXT_MESSAGE_END', messageId },
];
const snapshot = (messageId, metadata, content) => ({ type: 'ACTIVITY_SNAPSHOT', messageId, activityType: 'mugham.fill', metadata, content });
const RENEW = { tool: 'library.renew', label: 'Renew', arguments: { loan_id: 'L-0001' } };

function mount() {
  const thread = document.createElement('mu-thread');
  stage.append(thread);
  return thread;
}
const items = (thread) => [...thread.shadowRoot.querySelectorAll('li.message')];
const item = (thread, index) => items(thread)[index];
const header = (node) => node.querySelector('.actor')?.textContent ?? '';
const live = (thread) => thread.shadowRoot.querySelector('[aria-live="polite"]');

async function run() {
  // Two people and two agents in one thread. Each message shows its actor and the actor type.
  const thread = mount();
  for (const event of [...say('m1', ROBIN, 'Can I keep the moss guide longer?'),
    ...say('m2', SAM, 'I can check the shelf.'),
    { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
    ...say('m3', CATALOG_AGENT, 'The guide is on shelf B-14.', 'assistant'),
    { type: 'RUN_FINISHED', threadId: 't1', runId: 'r1' },
    { type: 'RUN_STARTED', threadId: 't1', runId: 'r2' },
    ...say('m4', RENEW_AGENT, 'I can renew it.', 'assistant'),
    { type: 'RUN_FINISHED', threadId: 't1', runId: 'r2' }]) thread.push(event);
  await settle();
  const headers = items(thread).map(header);
  check('actors: each message shows the actor name and type',
    headers.join('|') === 'Robin Person|Sam Person|Catalog agent Agent|Renewal agent Agent', headers.join('|'));
  const names = items(thread).map((node) => node.querySelector('article').getAttribute('aria-label'));
  check('actors: each article names the actor and the type', names[0] === 'Message from Robin, Person'
    && names[2] === 'Message from Catalog agent, Agent', names.join('|'));
  check('actors: the list has the name Thread', thread.shadowRoot.querySelector('ol').getAttribute('aria-label') === 'Thread');
  check('final: a message with its end marker shows no state text', items(thread).every((node) => node.dataset.state === 'final'
    && !node.querySelector('.state')), items(thread).map((node) => node.dataset.state).join(','));
  check('final: the text shows', item(thread, 0).textContent.includes('Can I keep the moss guide longer?'));

  // The role never changes the actor. An agent with the role "user" still shows as an agent.
  const spoof = mount();
  for (const event of say('s1', actor('agent', 'a-x', 'Robin'), 'I am a person.', 'user')) spoof.push(event);
  await settle();
  check('actors: an agent with the role user shows as an agent', header(item(spoof, 0)) === 'Robin Agent'
    && item(spoof, 0).classList.contains('agent') && !item(spoof, 0).classList.contains('human'), header(item(spoof, 0)));
  const unnamed = mount();
  for (const event of say('n1', actor('system', 'sys-1'), 'The thread is open.')) unnamed.push(event);
  await settle();
  check('actors: an actor with no name shows its id', header(item(unnamed, 0)) === 'sys-1 System', header(item(unnamed, 0)));

  // Partial: a message with no end marker shows as partial, also after the end of its run.
  const partial = mount();
  partial.push({ type: 'RUN_STARTED', threadId: 't2', runId: 'r1' });
  partial.push({ type: 'TEXT_MESSAGE_START', messageId: 'p1', role: 'assistant', metadata: CATALOG_AGENT });
  partial.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'p1', delta: 'Looking ' });
  await settle();
  check('partial: a message with no end marker is partial', item(partial, 0).dataset.state === 'partial'
    && item(partial, 0).querySelector('.state')?.textContent === 'Partial', item(partial, 0).textContent);
  const first = item(partial, 0);
  partial.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'p1', delta: 'at the shelf.' });
  partial.push({ type: 'RUN_FINISHED', threadId: 't2', runId: 'r1' });
  await settle();
  check('partial: the message stays partial after the end of its run', item(partial, 0).dataset.state === 'partial'
    && item(partial, 0).textContent.includes('Looking at the shelf.'), item(partial, 0).textContent);
  check('partial: an update keeps the item of the message', item(partial, 0) === first);
  partial.push({ type: 'TEXT_MESSAGE_END', messageId: 'p1' });
  await settle();
  check('final: the end marker makes the message final', item(partial, 0).dataset.state === 'final'
    && !item(partial, 0).querySelector('.state'), item(partial, 0).dataset.state);

  // Error: RUN_ERROR gives a status part, and the open message stays partial.
  const failed = mount();
  failed.push({ type: 'RUN_STARTED', threadId: 't3', runId: 'r1' });
  failed.push({ type: 'TEXT_MESSAGE_START', messageId: 'e1', role: 'assistant', metadata: RENEW_AGENT });
  failed.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'e1', delta: 'Renewing' });
  failed.push({ type: 'RUN_ERROR', message: 'The service did not answer.', code: 'timeout' });
  await settle();
  const error = item(failed, 0).querySelector('.status.error');
  check('error: RUN_ERROR shows an error', error?.textContent === 'Error: The service did not answer. (timeout)', error?.textContent);
  check('error: the message stays partial', item(failed, 0).dataset.state === 'partial');
  failed.push({ type: 'RUN_STARTED', threadId: 't3', runId: 'r2' });
  failed.push({ type: 'RUN_ERROR', message: 'The agent stopped.' });
  await settle();
  const notice = failed.shadowRoot.querySelector('li.notice');
  check('error: a run error with no open message shows a system notice',
    notice?.textContent.includes('Error: The agent stopped.') && notice.textContent.includes('System'), notice?.textContent);

  // Refused: an undeclared component shows a refusal notice and makes no element.
  const refused = mount();
  refused.push(snapshot('c1', CATALOG_AGENT, { format: 2, fill: fill('banner', { text: 'Sale' }) }));
  refused.push({ type: 'TEXT_MESSAGE_START', messageId: 'c2', role: 'user' });
  await settle();
  const refusal = item(refused, 0).querySelector('.refusal');
  check('refused: an undeclared component shows a refusal notice',
    refusal?.textContent.startsWith('Refused: the thread did not show this part.') && refusal.textContent.includes('component'),
    refusal?.textContent);
  check('refused: the refused component makes no element', !refused.shadowRoot.querySelector('mu-banner'));
  check('refused: the refused part keeps the actor', header(item(refused, 0)) === 'Catalog agent Agent', header(item(refused, 0)));
  const noActor = item(refused, 1);
  check('refused: a message with no actor is refused and shows no actor', noActor.dataset.state === 'refused'
    && noActor.textContent.includes('Refused message') && !noActor.querySelector('.actor')
    && noActor.textContent.includes('metadata.mugham.actor'), noActor.textContent);

  // Untrusted content stays text.
  const unsafe = mount();
  for (const event of say('x1', CATALOG_AGENT, MARKUP)) unsafe.push(event);
  unsafe.push(snapshot('x2', CATALOG_AGENT, { format: 2, fill: fill('card', { title: MARKUP.slice(0, 120) }) }));
  unsafe.push({ type: 'RUN_STARTED', threadId: 't4', runId: 'r1' });
  unsafe.push({ type: 'TEXT_MESSAGE_START', messageId: 'x3', metadata: CATALOG_AGENT });
  unsafe.push({ type: 'RUN_ERROR', message: MARKUP });
  await settle();
  check('text: markup in a text part shows as text', item(unsafe, 0).textContent.includes(MARKUP)
    && !unsafe.shadowRoot.querySelector('img, script'));
  check('text: a card part shows as its element', item(unsafe, 1).querySelector('mu-card')?.dataset.state === 'default');
  check('text: markup in an error shows as text', item(unsafe, 2).textContent.includes(MARKUP));

  // A fill of a component with no element shows a refusal.
  const noElement = mount();
  noElement.push(snapshot('f1', CATALOG_AGENT, { format: 2, fill: fill('fact', { label: 'Shelf', value: 'B-14' }) }));
  await settle();
  check('refused: a fill of a component with no element shows a refusal',
    item(noElement, 0).querySelector('.refusal')?.textContent.includes('fact'), item(noElement, 0).textContent);

  // Actions. The element shows pending until the receipt comes back. Done only after the receipt.
  const acting = mount();
  const calls = [];
  acting.bind = (value) => (value.component === 'action-button' ? RENEW : undefined);
  acting.perform = (request, message) => new Promise((done, fail) => calls.push({ request, message, done, fail }));
  for (const id of ['a1', 'a2', 'a3', 'a4']) acting.push(snapshot(id, RENEW_AGENT, { format: 2, fill: fill('action-button', { label: 'Renew' }) }));
  acting.push(snapshot('a5', RENEW_AGENT, { format: 2, fill: fill('action-button', { label: 'Delete' }) }));
  await settle();
  const button = (index) => item(acting, index).querySelector('mu-action-button');
  const status = (index) => button(index).shadowRoot.querySelector('.status').textContent;
  check('action: a fill with a different label is refused by the element', button(4).dataset.state === 'refused', button(4).dataset.state);
  const element = button(0);
  element.shadowRoot.querySelector('button').click();
  await settle();
  check('pending: an action shows pending before the receipt', element.dataset.state === 'pending' && status(0) === 'Pending', status(0));
  check('pending: the action goes to perform with its message', calls.length === 1 && calls[0].request.tool === 'library.renew'
    && calls[0].request.arguments.loan_id === 'L-0001' && calls[0].message.actor.id === 'a-renew', JSON.stringify(calls[0]?.request));
  acting.push(snapshot('a6', CATALOG_AGENT, { format: 2, fill: fill('card', { title: 'Weather at sea' }) }));
  for (const event of say('a7', SAM, 'Thanks.')) acting.push(event);
  await settle();
  check('pending: new events keep the element and its pending state', button(0) === element && element.dataset.state === 'pending',
    element.dataset.state);
  calls[0].done({ ok: true, message: 'Renewed.', reference: 'R-0042' });
  await settle();
  check('done: the receipt makes the action done', element.dataset.state === 'done' && status(0).startsWith('Done: Renewed.')
    && status(0).includes('Reference: R-0042'), status(0));
  button(1).shadowRoot.querySelector('button').click();
  await settle();
  calls[1].done({ ok: false, message: 'The loan has 3 renewals.' });
  await settle();
  check('error: a failed receipt shows an error', button(1).dataset.state === 'error' && status(1) === 'Not done: The loan has 3 renewals.', status(1));
  button(2).shadowRoot.querySelector('button').click();
  await settle();
  calls[2].fail(new Error('network'));
  await settle();
  check('error: a failed request shows an error', button(2).dataset.state === 'error' && status(2) === 'Not done: The request failed.', status(2));
  button(3).shadowRoot.querySelector('button').click();
  await settle();
  calls[3].done({ ok: true, message: 'x'.repeat(201) });
  await settle();
  check('error: a refused receipt shows an error', button(3).dataset.state === 'error'
    && status(3) === 'Not done: The thread refused the receipt.', status(3));

  // With no perform, the mu-action event goes up to the page, and the page gives the receipt.
  const open = mount();
  open.bind = () => RENEW;
  open.push(snapshot('o1', RENEW_AGENT, { format: 2, fill: fill('action-button', { label: 'Renew' }) }));
  await settle();
  const page = [];
  const listener = (event) => page.push(event);
  document.addEventListener('mu-action', listener);
  const openButton = item(open, 0).querySelector('mu-action-button');
  openButton.shadowRoot.querySelector('button').click();
  await settle();
  document.removeEventListener('mu-action', listener);
  check('pending: with no perform, the page gets the mu-action event', page.length === 1 && openButton.dataset.state === 'pending', page.length);
  openButton.receipt({ id: page[0].detail.id, ok: true });
  check('done: the page can give the receipt', openButton.dataset.state === 'done');

  // The live region announces new messages, and the focus does not move.
  const watched = mount();
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Draft');
  // The input comes before the keyboard target, so the Tab check of the runner starts there.
  document.getElementById('keyboard').before(input);
  input.focus();
  for (const event of say('l1', SAM, 'Here is the shelf code.')) watched.push(event);
  await settle();
  check('live: the region is polite', live(watched)?.getAttribute('role') === 'status');
  check('live: the region announces the new message', live(watched).textContent.includes('Sam, Person'), live(watched).textContent);
  check('live: the focus does not move', document.activeElement === input, document.activeElement?.tagName);
  check('live: the messages are not a live region', !watched.shadowRoot.querySelector('ol[aria-live]'));
  input.remove();

  // read() takes an async source of events. The state shows the end of the source.
  const reading = mount();
  async function* source() {
    yield* say('r1', CATALOG_AGENT, 'One.', 'assistant');
    await settle();
    yield* say('r2', SAM, 'Two.');
  }
  const promise = reading.read(source());
  check('read: the state is reading', reading.state === 'reading' && reading.dataset.state === 'reading', reading.state);
  await promise;
  await settle();
  check('read: the source ends', reading.state === 'ended' && items(reading).length === 2, `${reading.state} ${items(reading).length}`);
  check('read: messages gives a copy of the envelopes', reading.messages.length === 2 && reading.messages[0].actor.id === 'a-catalog');
  const broken = mount();
  async function* fails() {
    yield* say('b1', SAM, 'Start.');
    throw new Error('closed');
  }
  await broken.read(fails());
  await settle();
  check('read: a failed source shows a notice', broken.state === 'failed'
    && broken.shadowRoot.querySelector('.source')?.textContent === 'The source of events failed.', broken.shadowRoot.textContent);

  // The stream errors show as a count and the first error.
  const noisy = mount();
  noisy.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'none', delta: 'x' });
  noisy.push('not an event');
  await settle();
  const errors = noisy.shadowRoot.querySelector('.stream');
  check('error: the stream errors show', errors?.textContent.startsWith('The thread ignored 2 events that are not valid.'), errors?.textContent);

  check('no markup ran', window.muUnsafe === undefined);

  // Media modes. The runner gives the mode in the URL.
  const mode = new URLSearchParams(location.search).get('mode') || 'light';
  const article = item(thread, 0).querySelector('article');
  const style = getComputedStyle(article);
  if (mode === 'forced-colors') {
    check('forced colors: the media query matches', matchMedia('(forced-colors: active)').matches);
    check('forced colors: the message border is visible', style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) >= 1,
      `${style.borderTopStyle} ${style.borderTopWidth}`);
  }
  if (mode === 'reduced-motion') {
    check('reduced motion: no transition on a message', style.transitionDuration.split(',').every((d) => parseFloat(d) === 0), style.transitionDuration);
  }
  if (mode === 'dark') check('dark: the media query matches', matchMedia('(prefers-color-scheme: dark)').matches);
  return mode;
}

// The keyboard part of the check: the runner sends real key events to this target.
const keyboard = document.getElementById('keyboard');
const target = document.createElement('mu-button');
target.fill = fill('button', { label: 'Keyboard target' });
let presses = 0;
target.addEventListener('mu-press', () => { presses += 1; });
keyboard.append(target);
window.muPresses = () => presses;

run().then((mode) => { window.muChecks = { mode, results }; }, (error) => {
  check('the checks ran with no error', false, error && error.stack);
  window.muChecks = { mode: 'error', results };
});
