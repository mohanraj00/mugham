// The fixture API of the snapshot compare example. It holds synthetic versioned records in memory: the prices of
// ingredients, and the recipes that use them. The service is the source of each result: the snapshots, the compare
// result of two snapshots and the impact of a change. The API only reads. It has no method that changes a record.
// Each call gives a copy of the data after a short delay, as a network call does. A real versioned store has its own
// API, and a dashboard calls that API instead of this module.

const COLLECTIONS = [
  { id: 'ingredients', name: 'Ingredients', snapshots: [
    { id: 'S-1', taken: '2026-09-01', note: 'First count', records: { Flour: '1.20 per kg', Sugar: '0.90 per kg', Butter: '4.50 per kg', Salt: '0.30 per kg' } },
    { id: 'S-2', taken: '2026-10-01', note: 'Yeast added', records: { Flour: '1.35 per kg', Sugar: '0.90 per kg', Butter: '4.50 per kg', Salt: '0.30 per kg', Yeast: '2.10 per kg' } },
    { id: 'S-3', taken: '2026-11-01', note: 'Sugar removed', records: { Flour: '1.35 per kg', Butter: '4.80 per kg', Salt: '0.30 per kg', Yeast: '2.10 per kg' } },
  ] },
  { id: 'recipes', name: 'Recipes', snapshots: [
    { id: 'S-1', taken: '2026-09-15', note: 'Two recipes', records: { 'Bread loaf': 'Flour, Salt', Shortbread: 'Flour, Sugar, Butter' } },
    { id: 'S-2', taken: '2026-10-15', note: 'Yeast and a new recipe', records: { 'Bread loaf': 'Flour, Salt, Yeast', Shortbread: 'Flour, Sugar, Butter', Flatbread: 'Flour, Salt' } },
  ] },
];
// A collection and the collection whose records use its records. Each recipe lists the ingredients that it uses.
const USED_BY = { ingredients: 'recipes' };

const delay = (ms) => new Promise((done) => setTimeout(done, ms));

export class SnapshotApi {
  #delay;

  constructor({ delay: ms = 100 } = {}) {
    this.#delay = ms;
  }

  #collection(id) {
    const found = COLLECTIONS.find((item) => item.id === id);
    if (!found) throw new Error('The collection does not exist.');
    return found;
  }

  #snapshot(collection, id) {
    const found = collection.snapshots.find((item) => item.id === id);
    if (!found) throw new Error('The snapshot does not exist.');
    return found;
  }

  async collections() {
    await delay(this.#delay);
    return COLLECTIONS.map((item) => ({ id: item.id, name: item.name, snapshots: item.snapshots.length,
      latest: item.snapshots.at(-1).id }));
  }

  async snapshots(id) {
    await delay(this.#delay);
    return this.#collection(id).snapshots.map((item) => ({ id: item.id, taken: item.taken, note: item.note,
      records: Object.keys(item.records).length }));
  }

  // The changes from one snapshot to another, for each record key in the two snapshots.
  async compare(id, fromId, toId) {
    await delay(this.#delay);
    const collection = this.#collection(id);
    const from = this.#snapshot(collection, fromId);
    const to = this.#snapshot(collection, toId);
    const keys = [...new Set([...Object.keys(from.records), ...Object.keys(to.records)])];
    const changes = keys.map((label) => {
      const before = from.records[label];
      const after = to.records[label];
      if (before === undefined) return { label, change: 'added', after };
      if (after === undefined) return { label, change: 'removed', before };
      return { label, change: before === after ? 'unchanged' : 'changed', before, after };
    });
    return { collection: collection.name, from: { id: from.id, taken: from.taken }, to: { id: to.id, taken: to.taken }, changes };
  }

  // The records of the newest snapshot of the dependent collection that use a record which the change affects.
  async impact(id, fromId, toId) {
    const changed = new Map((await this.compare(id, fromId, toId)).changes.filter((item) => item.change !== 'unchanged')
      .map((item) => [item.label, item.change]));
    const dependent = COLLECTIONS.find((item) => item.id === USED_BY[id]);
    if (!dependent) return [];
    const affected = [];
    for (const [record, uses] of Object.entries(dependent.snapshots.at(-1).records)) {
      const hits = uses.split(', ').filter((name) => changed.has(name)).map((name) => `${name} (${changed.get(name)})`);
      if (hits.length) affected.push({ collection: dependent.name, record, reason: `Uses ${hits.join(', ')}` });
    }
    return affected;
  }
}
