// The application reads approval states from a fixture API.
import { define } from '../../src/components/index.js';
import { createKit } from '../../src/kit.js';

define();

const actor = { type: 'agent', id: 'newsletter-agent', name: 'Newsletter assistant' };
const { outer, fill: node } = createKit({ actor });
const newsletter = document.querySelector('mu-rich-text');
newsletter.actor = actor;

const paragraphs = [
  { id: 'hours', text: 'The north branch opens at ten on Saturday.' },
  { id: 'reading', text: 'The reading group meets in Room B on Tuesday.' },
  { id: 'returns', text: 'The return desk moves to the east entrance in December.' },
];

const approvalAPI = {
  async read() {
    return {
      hours: { state: 'approved', by: 'Branch reviewer A', at: '2026-11-26T10:00:00Z' },
      reading: { state: 'pending', by: 'Branch reviewer B', at: '2026-11-26T10:10:00Z' },
      returns: { state: 'rejected', by: 'Branch reviewer C', at: '2026-11-26T10:20:00Z' },
    };
  },
};

newsletter.fill = outer('rich-text', { blocks: paragraphs.map(({ text }) =>
  node('rich-paragraph', { content: [node('rich-span', { text })] })) });
const revision = newsletter.fillRevision;

const approvals = await approvalAPI.read();
newsletter.setApprovals(paragraphs.flatMap(({ id }, block) =>
  Object.hasOwn(approvals, id) ? [{ block, ...approvals[id] }] : []), revision);
