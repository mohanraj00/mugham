// The fixture API of the review queue example. It holds synthetic review tasks in memory. The service decides:
// the kit and the page only show the answer. Each call gives a copy of the data after a short delay, as a
// network call does. A real service has its own API, and a dashboard calls that API instead of this module.

const TASKS = [
  { id: 'R-101', field: 'Invoice total', kind: 'number', extracted: 114,
    document: 'Synthetic invoice 2041', locator: 'https://example.org/invoices/2041#total',
    passage: 'Invoice 2041. Subtotal 120.00. Tax 24.00. Total due 144.00 by 2026-12-15.', span_start: 52, span_end: 58 },
  { id: 'R-102', field: 'Street name', kind: 'text', extracted: 'Harbor Road',
    document: 'Synthetic delivery note 88', locator: 'https://example.org/notes/88#address',
    passage: 'Deliver to 12 Harbor Road, Northfield, before noon.', span_start: 14, span_end: 25 },
  { id: 'R-103', field: 'Due date', kind: 'date', extracted: '2026-12-15',
    document: 'Synthetic invoice 2041', locator: 'https://example.org/invoices/2041#due',
    passage: 'Invoice 2041. Subtotal 120.00. Tax 24.00. Total due 144.00 by 2026-12-15.', span_start: 62, span_end: 72 },
];

const delay = (ms) => new Promise((done) => setTimeout(done, ms));

export class ReviewApi {
  #tasks = TASKS.map((task) => ({ ...task, status: 'Open' }));
  #receipts = 0;
  #delay;

  constructor({ delay: ms = 150 } = {}) {
    this.#delay = ms;
  }

  // The open tasks. A decided task is not in the list.
  async list() {
    await delay(this.#delay);
    return this.#tasks.filter((task) => task.status === 'Open').map((task) => ({ ...task }));
  }

  // The service finds the value in the span of the source. A number matches by its numeric value.
  #supported(task, value) {
    const span = task.passage.slice(task.span_start, task.span_end);
    return task.kind === 'number' ? Number(span) === Number(value) : span === String(value);
  }

  // Runs one request: review.accept, review.reject or review.correct. It gives the receipt.
  async perform({ tool, arguments: args = {}, edits = [] }) {
    await delay(this.#delay);
    const task = this.#tasks.find((item) => item.id === args.task_id);
    const refuse = (message) => ({ ok: false, message });
    if (!task || task.status !== 'Open') return refuse('The task is not open.');
    const reference = () => `RV-${String(++this.#receipts).padStart(4, '0')}`;
    if (tool === 'review.accept') {
      if (!this.#supported(task, task.extracted)) return refuse('The value is not in the source. Correct it or reject it.');
      task.status = 'Accepted';
      return { ok: true, message: 'The service accepted the value.', reference: reference() };
    }
    if (tool === 'review.reject') {
      task.status = 'Rejected';
      return { ok: true, message: 'The service rejected the value.', reference: reference() };
    }
    if (tool === 'review.correct') {
      const edit = edits.find((item) => item.field === 'value');
      if (!edit) return refuse('Change the value before you send a correction.');
      if (args.value === '' || args.value === undefined) return refuse('Give a value.');
      task.status = 'Corrected';
      task.corrected = args.value;
      return { ok: true, message: `The service saved the value as a ${edit.type}.`, reference: reference() };
    }
    return refuse('The service does not know this action.');
  }
}
