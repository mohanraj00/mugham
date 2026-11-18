// An example of a form card in a thread. A person asks for a change, and an agent sends a synthetic membership
// form with 3 sections and 25 fields. The page acts as the application: it gives the binding and the receipt,
// and it computes the read-only fields. A synthetic service gives each receipt after a short delay.
import { define } from '../../src/thread/index.js';

define();

const fill = (component, data) => ({ component, version: '0.1.0', data });
const AGENT = { type: 'agent', id: 'a-forms', name: 'Forms agent' };
const PERSON = { type: 'human', id: 'u-robin', name: 'Robin' };
const FEES = { Basic: 60, Family: 120, Senior: 40 };

// One line of the form. The second argument gives the line number and the read-only flag.
const line = (component, data, extra = {}) => fill('form-line', { ...extra, field: fill(component, data) });
const text = (name, label, value, extra) => line('field', { name, label, ...(value ? { value } : {}) }, extra);
const choice = (name, label, value, choices, extra) => line('choice-field', { name, label, value, choices }, extra);

const SECTIONS = [
  fill('form-section', { title: 'Member', lines: [
    text('member_name', 'Name', 'Robin Vale', { line: '1.1' }),
    text('member_id', 'Member number', 'M-20417', { line: '1.2', read_only: true }),
    line('date-field', { name: 'birth_date', label: 'Date of birth', value: '1990-04-12', typed: true }, { line: '1.3' }),
    text('email', 'Email', 'robin.vale@example.org', { line: '1.4' }),
    text('phone', 'Phone', '', { line: '1.5' }),
    text('street', 'Street', '12 Harbor Road', { line: '1.6' }),
    text('town', 'Town', 'Northfield', { line: '1.7' }),
    text('postcode', 'Postcode', 'NF2 4QA', { line: '1.8' }),
  ] }),
  fill('form-section', { title: 'Household', lines: [
    line('number-field', { name: 'adults', label: 'Adults', value: 2, minimum: 1, maximum: 8, typed: true }, { line: '2.1' }),
    line('number-field', { name: 'children', label: 'Children', value: 1, minimum: 0, maximum: 8 }, { line: '2.2' }),
    line('number-field', { name: 'seniors', label: 'Seniors', value: 0, minimum: 0, maximum: 8 }, { line: '2.3' }),
    line('number-field', { name: 'household_size', label: 'Household size', value: 3, hint: 'Adults, children and seniors.' },
      { line: '2.4', read_only: true }),
    choice('pets', 'Pets', 'No', ['No', 'Yes'], { line: '2.5' }),
    choice('parking', 'Parking', 'None', ['None', 'One car', 'Two cars'], { line: '2.6' }),
    line('long-text-field', { name: 'access_needs', label: 'Access needs', hint: 'For example a ramp or a quiet room.' }, { line: '2.7' }),
    line('date-field', { name: 'start_date', label: 'Start date', value: '2026-12-01', earliest: '2026-11-01', typed: true }, { line: '2.8' }),
  ] }),
  fill('form-section', { title: 'Plan and payment', lines: [
    choice('plan', 'Plan', 'Family', ['Basic', 'Family', 'Senior'], { line: '3.1' }),
    choice('payment', 'Payment', 'Monthly', ['Monthly', 'Yearly'], { line: '3.2' }),
    line('number-field', { name: 'discount', label: 'Discount', value: 0, hint: '10 for a yearly payment.' }, { line: '3.3', read_only: true }),
    line('number-field', { name: 'fee', label: 'Annual fee', value: 120, hint: 'The fee of the plan, less the discount.' },
      { line: '3.4', read_only: true }),
    line('date-field', { name: 'renewal_date', label: 'Renewal date', value: '2027-12-01' }, { line: '3.5', read_only: true }),
    choice('newsletter', 'Newsletter', 'Yes', ['Yes', 'No'], { line: '3.6' }),
    choice('photos', 'Photo consent', 'No', ['Yes', 'No'], { line: '3.7' }),
    text('referral', 'Referral code', ''),
    line('long-text-field', { name: 'notes', label: 'Notes' }),
  ] }),
];
const FORM = { ...fill('form-card', { title: 'Membership form', submit_label: 'Send changes', sections: SECTIONS }), slots: { authorship: AGENT } };

// The application gives the tool, the title, the label of each field that a person can edit, the typed names
// and the person who edits. The read-only fields are not in editable, so a request cannot carry them.
const LINES = SECTIONS.flatMap((item) => item.data.lines.map((entry) => entry.data));
const EDITABLE = Object.fromEntries(LINES.filter((entry) => !entry.read_only).map((entry) => [entry.field.data.name, entry.field.data.label]));
const BINDING = { tool: 'members.update_form', label: 'Send changes', title: 'Membership form', arguments: { form_id: 'F-0001' },
  editable: EDITABLE, typed: ['birth_date', 'adults', 'start_date'], editor: { type: 'human', id: PERSON.id } };

const actor = (value) => ({ metadata: { mugham: { actor: value } } });
const say = (id, who, role, words) => [
  { type: 'TEXT_MESSAGE_START', messageId: id, role, ...actor(who) },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta: words },
  { type: 'TEXT_MESSAGE_END', messageId: id },
];
const EVENTS = [
  ...say('m-1', PERSON, 'user', 'We have one more child now. Can you update my membership form?'),
  { type: 'RUN_STARTED', threadId: 't-members', runId: 'run-1' },
  ...say('m-2', AGENT, 'assistant', 'Here is your form. Edit a value, then send the changes. The service computes the read-only fields.'),
  { type: 'ACTIVITY_SNAPSHOT', messageId: 'm-3', activityType: 'mugham.fill', ...actor(AGENT), content: { format: 2, fill: FORM } },
  { type: 'RUN_FINISHED', threadId: 't-members', runId: 'run-1' },
];

async function* events() {
  for (const event of EVENTS) yield event;
}

// The values that the service knows. It computes the read-only fields from them.
const known = Object.fromEntries(LINES.map((entry) => [entry.field.data.name, entry.field.data.value ?? '']));

const thread = document.querySelector('mu-thread');
thread.bind = (value) => (value.component === 'form-card' ? BINDING : undefined);
// The synthetic service decides. It accepts the changes and gives the new computed values to the card.
thread.perform = async (request) => {
  await new Promise((done) => setTimeout(done, 600));
  Object.assign(known, request.arguments);
  const discount = known.payment === 'Yearly' ? 10 : 0;
  const card = thread.shadowRoot.querySelector('mu-form-card');
  card?.computed({ household_size: known.adults + known.children + known.seniors, discount, fee: FEES[known.plan] - discount });
  return { ok: true, message: 'The service saved the changes.', reference: 'F-0001' };
};
thread.read(events());
