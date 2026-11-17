// An example page with rich text from an agent, in a thread and in a card. The agent sends a tree of typed
// nodes, never markup. The page acts as the application: it sets the link schemes and the first heading
// level in code. All data is synthetic and neutral.
import { define } from '../src/thread/index.js';
import { MuRichText } from '../src/components/index.js';

define();
// The page has a level 1 heading, so the first heading of a rich text is level 2. Only https links can open.
MuRichText.headingLevel = 2;
MuRichText.linkSchemes = ['https:'];

const AGENT = { type: 'agent', id: 'agent-garden', name: 'Garden helper' };
const PERSON = { type: 'human', id: 'person-robin', name: 'Robin' };
const node = (component, data) => ({ component, version: '0.1.0', data });
const span = (text, mark) => node('rich-span', mark ? { text, mark } : { text });
const paragraph = (...content) => node('rich-paragraph', { content });
const richText = (...blocks) => ({ component: 'rich-text', version: '0.1.0', data: { blocks }, slots: { authorship: AGENT } });

// The answer of the agent: a heading, a list of three steps and one link.
const ANSWER = richText(
  node('rich-heading', { level: 1, content: [span('Plant out tray B2')] }),
  paragraph(span('The seedlings are ready. Do these steps '), span('in the morning', 'emphasis'), span('.')),
  node('rich-list', { ordered: true, items: [
    paragraph(span('Water the tray from below.')),
    paragraph(span('Move each seedling to a pot of '), span('9 cm', 'strong'), span('.')),
    paragraph(span('Write the date on the label, for example '), span('2026-03-20', 'code'), span('.')),
  ] }),
  paragraph(span('The '), node('rich-link', { text: 'synthetic planting guide', url: 'https://example.org/guides/planting' }),
    span(' gives the spacing for each plant.')),
);
// The agent sends markup and a script address. The markup shows as text, and the kit refuses the link.
const MARKUP = richText(paragraph(span('<b>Do not</b> water the leaves. <img src=x onerror=alert(1)>')),
  node('rich-code', { text: 'tray check --all\n<script>alert(1)</script>' }),
  node('rich-quote', { paragraphs: [paragraph(span('A dry leaf has no mold.'))] }));
const SCRIPT = richText(paragraph(node('rich-link', { text: 'Open the guide', url: 'java' + 'script:alert(1)' })));

function text(tag, words) {
  const element = document.createElement(tag);
  element.textContent = words;
  return element;
}

const thread = document.createElement('mu-thread');
const card = document.createElement('mu-card');
card.actor = AGENT;
card.fill = { component: 'card', version: '0.1.0', data: { title: 'Tray B2' }, slots: { authorship: AGENT } };
// The card has one page-owned slot, named actions. Page code can place rich text there.
const note = document.createElement('mu-rich-text');
note.actor = AGENT;
note.fill = richText(paragraph(span('Sown on '), span('2026-02-20', 'strong'), span('. 18 seedlings.')));
note.slot = 'actions';
card.append(note);

document.getElementById('main').append(text('h1', 'Rich text'), thread, text('p', 'A card with rich text:'), card);

const agent = { mugham: { actor: AGENT } };
const snapshot = (messageId, fill) => ({ type: 'ACTIVITY_SNAPSHOT', messageId, activityType: 'mugham.fill', metadata: agent, content: { format: 2, fill } });
thread.read([
  { type: 'RUN_STARTED', threadId: 'garden', runId: 'r1' },
  { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'user', metadata: { mugham: { actor: PERSON } } },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'How do I plant out tray B2?' },
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
  snapshot('m2', ANSWER),
  snapshot('m3', MARKUP),
  snapshot('m4', SCRIPT),
  { type: 'RUN_FINISHED', threadId: 'garden', runId: 'r1' },
]);
