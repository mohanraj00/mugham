// The kit side of the offline data source interface. docs/contracts/data-source.md is the contract.
// The source belongs to the application. The kit checks each request and each result, so a failed source
// shows an error and never old data as new data.
const STATES = ['ready', 'stale', 'empty', 'error'];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const TIMEOUT = 5000;
const LIMIT = 100;

const isText = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
const isScalar = (value) => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const own = (value) => Object.keys(value);

// The errors of a list filter. An empty list means that the filter is valid.
export function filterErrors(filter) {
  if (!isPlain(filter)) return ['the filter must be an object'];
  const errors = [];
  for (const name of own(filter)) if (name !== 'where' && name !== 'limit') errors.push(`${name}: not a key of the filter`);
  if (Object.hasOwn(filter, 'where')) {
    const { where } = filter;
    if (!isPlain(where) || own(where).length < 1 || own(where).length > 10) errors.push('where: must have 1 to 10 keys');
    else {
      for (const name of own(where)) {
        if (!isText(name, 1, 64)) errors.push('where: a key name has 1 to 64 characters');
        else if (!isScalar(where[name])) errors.push(`where.${name}: must be a text, a finite number, true or false`);
      }
    }
  }
  if (Object.hasOwn(filter, 'limit') && !(Number.isInteger(filter.limit) && filter.limit >= 1 && filter.limit <= 500)) {
    errors.push('limit: must be an integer from 1 to 500');
  }
  return errors;
}

function recordErrors(record, at) {
  if (!isPlain(record)) return [`${at}: must be an object`];
  const names = own(record);
  if (names.length < 1 || names.length > 40) return [`${at}: must have 1 to 40 keys`];
  if (!isText(record.key, 1, 128)) return [`${at}.key: must be a text of 1 to 128 characters`];
  for (const name of names) {
    const value = record[name];
    if (!isText(name, 1, 64)) return [`${at}: a key name has 1 to 64 characters`];
    if (!isScalar(value)) return [`${at}.${name}: must be a text, a finite number, true or false`];
    if (typeof value === 'string' && value.length > 2000) return [`${at}.${name}: more than 2000 characters`];
  }
  return [];
}

// The errors of a result for one request. The first error stops the check, so the developer sees the cause.
function resultErrors(result, request, now) {
  if (!isPlain(result)) return ['the result must be an object'];
  const { state, records, checked, reason } = result;
  if (!STATES.includes(state)) return ['state: must be ready, stale, empty or error'];
  if (!Array.isArray(records)) return ['records: must be a list'];
  if (checked !== undefined && checked !== null) {
    if (typeof checked !== 'string' || !TIME.test(checked) || Number.isNaN(Date.parse(checked))) return ['checked: must be an ISO 8601 time in UTC'];
    if (Date.parse(checked) > now) return ['checked: after the time of the read'];
  } else if (state === 'ready' || state === 'stale') return ['checked: must be an ISO 8601 time in UTC'];
  if (reason !== undefined && reason !== null && !isText(reason, 1, 200)) return ['reason: must be a text of 1 to 200 characters'];
  if (state === 'error') return reason === undefined || reason === null ? ['reason: an error result needs a reason'] : [];
  if (state === 'empty' && records.length) return ['records: an empty result has no record'];
  if ((state === 'ready' || state === 'stale') && !records.length) return ['records: a ready or stale result needs at least one record'];
  for (const [index, record] of records.entries()) {
    const errors = recordErrors(record, `records[${index}]`);
    if (errors.length) return errors;
  }
  if (Object.hasOwn(request, 'get')) {
    if (records.length > 1) return ['records: more than the limit 1'];
    if (records.length && records[0].key !== request.get) return ['records[0].key: not the requested key'];
    return [];
  }
  const { where = {}, limit = LIMIT } = request.list;
  if (records.length > limit) return [`records: more than the limit ${limit}`];
  for (const [index, record] of records.entries()) {
    if (own(where).some((name) => record[name] !== where[name])) return [`records[${index}]: does not agree with the filter`];
  }
  return [];
}

const failed = (reason, extra = {}) => Object.freeze({ state: 'error', records: Object.freeze([]), checked: null, reason, ...extra });

// Reads one request from a source: { get: key } or { list: filter }. The result is frozen and has the keys
// state, records, checked and reason. options: timeout and maxAge in milliseconds, and now() for the tests.
export async function read(source, request, options = {}) {
  const keys = isPlain(request) ? own(request) : [];
  const kind = keys.length === 1 ? keys[0] : null;
  const valid = (kind === 'get' && isText(request.get, 1, 128)) || (kind === 'list' && filterErrors(request.list).length === 0);
  if (!valid || typeof source?.[kind] !== 'function') return failed('The request is not valid.');
  const argument = kind === 'get' ? request.get : { ...request.list, ...(request.list.where ? { where: { ...request.list.where } } : {}) };
  let timer;
  let result;
  try {
    const answer = Promise.resolve().then(() => source[kind](argument));
    const late = {};
    const clock = new Promise((done) => { timer = setTimeout(() => done(late), options.timeout ?? TIMEOUT); });
    result = await Promise.race([answer, clock]);
    if (result === late) return failed('The source did not answer.');
  } catch {
    return failed('The source failed.');
  } finally {
    clearTimeout(timer);
  }
  // The time of the read is the time of the answer, so a source can confirm its data just before it answers.
  const now = (options.now ?? Date.now)();
  const errors = resultErrors(result, request, now);
  if (errors.length) return failed('The source gave a result that is not valid.', { errors: Object.freeze(errors) });
  const checked = result.checked ?? null;
  if (result.state === 'error') return failed(result.reason, { checked });
  const records = Object.freeze(result.records.map((record) => Object.freeze({ ...record })));
  let { state } = result;
  let reason = result.reason ?? null;
  if (state === 'ready' && options.maxAge !== undefined && now - Date.parse(checked) > options.maxAge) {
    state = 'stale';
    reason = 'The data is older than the limit.';
  }
  return Object.freeze({ state, records, checked, reason });
}

// A fill of the source-status component from a result of read.
export function statusFill(label, result) {
  const data = { label, state: result.state };
  if (result.checked) data.checked = result.checked;
  if (result.reason) data.reason = result.reason;
  return { component: 'source-status', version: '0.1.0', data };
}
