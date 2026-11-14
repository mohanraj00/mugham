// The field inspection app, for a phone first. The page registers the checklist contract and its element, then
// shows the inspection thread. An inspector saves the findings in a form and closes the inspection with a confirm
// step. The API checks the findings, gives each receipt and sends the new checklist. All data is synthetic.
import { MuElement, define, provenance, register } from '../../../src/components/index.js';
import { define as defineThread } from '../../../src/thread/index.js';
import { el, sheet } from '../../../src/render/dom.js';
import { Feed, alert, post } from '../app.js';
import CHECK_ITEM from './check-item.json' with { type: 'json' };
import CHECKLIST from './inspection-checklist.json' with { type: 'json' };

const ID = 'I-0417';
const RESULTS = { pass: 'Pass', attention: 'Needs work', fail: 'Fail', open: 'Not checked' };
const CSS = sheet(`
  :host { display: block; }
  section {
    background: var(--mu-color-surface); color: var(--mu-color-text); font: var(--mu-type-body);
    border: 1px solid var(--mu-color-border); border-radius: var(--mu-radius-2); padding: var(--mu-space-3);
    display: flex; flex-direction: column; gap: var(--mu-space-2);
  }
  p { margin: 0; overflow-wrap: anywhere; }
  .title { font-weight: var(--mu-type-weight-strong); }
  .muted { font: var(--mu-type-caption); color: var(--mu-color-text-muted); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--mu-space-2); }
  li { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: var(--mu-space-1) var(--mu-space-3); align-items: baseline;
    border-top: 1px solid var(--mu-color-border); padding-top: var(--mu-space-2); }
  .result { font: var(--mu-type-caption); font-weight: var(--mu-type-weight-strong); border: 1px solid currentColor;
    border-radius: var(--mu-radius-1); padding: 0 var(--mu-space-1); justify-self: start; }
  .attention, .fail { color: var(--mu-color-danger); }
  .open { color: var(--mu-color-text-muted); }
  .pass { color: var(--mu-color-accent); }
  @media (forced-colors: active) { section, li { border-color: CanvasText; } .result, .muted { color: CanvasText; } }
`);

// The element builds its nodes only with el, so each text value of the agent stays text.
class InspectionChecklist extends MuElement {
  static component = 'inspection-checklist';
  static styles = [CSS];

  render(data) {
    const items = data.items.map(({ data: item }) => el('li', {},
      el('span', { class: `result ${item.result}` }, RESULTS[item.result]),
      el('span', {}, el('p', {}, item.label), item.detail ? el('p', { class: 'muted' }, item.detail) : null)));
    return [el('section', { part: 'checklist' }, el('p', { class: 'title' }, data.title), el('p', { class: 'muted' }, data.site),
      el('ul', { 'aria-label': data.title }, ...items), provenance(this.fill.slots))];
  }
}

// A check item shows only in a checklist. It has its own element, because the registration call needs one.
class CheckItem extends MuElement {
  static component = 'check-item';

  render(data) {
    return [el('p', {}, `${data.label}: ${RESULTS[data.result]}`)];
  }
}

define();
defineThread();
register(CHECK_ITEM, CheckItem);
register(CHECKLIST, InspectionChecklist);

// The application binds each tool. The fills of the agent give only the fields and the labels.
const FINDINGS = { tool: 'inspection.save_findings', label: 'Save findings', title: `Findings for ${ID}`, arguments: { inspection_id: ID },
  editable: { pressure: 'Outlet pressure in bar', seal: 'Valve V3 seal', note: 'Note' } };
const CLOSE = { tool: 'inspection.close', label: `Close ${ID}`, description: 'Send the checklist to the maintenance team.',
  arguments: { inspection_id: ID }, confirm: { message: `Close inspection ${ID}? You cannot change the findings after this.`, label: 'Yes, close' } };

const main = document.getElementById('main');
const thread = document.createElement('mu-thread');
const feed = new Feed(thread, `/inspection/${ID}/events`);
thread.bind = (fill) => ({ 'editable-form': FINDINGS, 'action-button': CLOSE })[fill.component];
thread.perform = async (request) => {
  const receipt = await post(request);
  // The receipt goes to the element first. Then the page reads the new events of the API.
  if (receipt.ok) setTimeout(() => feed.sync().catch((error) => alert(main, error)), 0);
  return receipt;
};
main.append(thread);

feed.sync().then(() => { main.dataset.state = 'ready'; }, (error) => alert(main, error));
