// The message envelope, version 1, and the reader of an AG-UI 1.0 stream.
// docs/contracts/envelope.md gives the rules. tests/vectors/envelope/ gives the conformance cases.
// The reader never changes its input. Each text stays text: the reader never reads it as Markdown or markup.
import { fillErrors } from '../render/validate.js';
import { CATALOG } from '../render/catalog.js';

export const ENVELOPE_VERSION = 1;
export const AGUI_VERSION = '1.0';
export const FILL_FORMAT = 1;
export const FILL_ACTIVITY = 'mugham.fill';
export const FALLBACK_TEXT = 'The kit does not know this part type, so it does not show the part.';

const ACTOR_TYPES = ['human', 'agent', 'system'];
const ROLES = ['developer', 'system', 'assistant', 'user', 'tool', 'reasoning', 'activity'];
const KNOWN_PARTS = ['text', 'component', 'status', 'refusal', 'fallback'];
const MAX_ID = 128;
const MAX_NAME = 80;
const MAX_TEXT = 100000;
const MAX_STATUS = 1000;
const MAX_CODE = 128;
const MAX_PARTS = 100;
const MAX_ERRORS = 20;
const MAX_ERROR = 300;
const MAX_TYPE = 40;
const MAX_STREAM_ERRORS = 100;

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Count the code points of text, but stop after limit + 1. The count makes no copy of the text.
function length(text, limit) {
  let count = 0;
  for (const _ of text) {
    count += 1;
    if (count > limit) break;
  }
  return count;
}

const isText = (value, min, max) => typeof value === 'string' && length(value, max) >= min && length(value, max) <= max;
const isId = (value) => isText(value, 1, MAX_ID);

// Give the first code points of text, with '...' if the text is longer.
function cut(text, max) {
  let start = '';
  let count = 0;
  for (const character of text) {
    count += 1;
    if (count > max) return start + '...';
    start += character;
  }
  return text;
}

const ID_ERROR = 'must be an id of 1 to 128 characters';

function actorErrors(actor, path) {
  if (actor === undefined) return [`${path}: a required field is missing`];
  if (!isObject(actor)) return [`${path}: must be an object`];
  const errors = [];
  if (!ACTOR_TYPES.includes(actor.type)) errors.push(`${path}.type: must be human, agent or system`);
  if (!isId(actor.id)) errors.push(`${path}.id: ${ID_ERROR}`);
  if (own(actor, 'name') && !isText(actor.name, 1, MAX_NAME)) errors.push(`${path}.name: must be a text of 1 to 80 characters`);
  return errors;
}

// A copy of a valid actor with only the declared fields.
function actorCopy(actor) {
  const copy = { type: actor.type, id: actor.id };
  if (own(actor, 'name')) copy.name = actor.name;
  return copy;
}

const sameActor = (a, b) => a.type === b.type && a.id === b.id && a.name === b.name;

function refusalPart(errors) {
  return { type: 'refusal', errors: errors.slice(0, MAX_ERRORS).map((error) => cut(error, MAX_ERROR)) };
}

function fallbackPart(type) {
  return { type: 'fallback', partType: cut(type, MAX_TYPE), text: FALLBACK_TEXT };
}

// A component part, or a refusal part if the fill validator refuses the fill.
function componentPart(format, fill, path, catalog) {
  if (format !== FILL_FORMAT) return refusalPart([`${path}.format: must be ${FILL_FORMAT}`]);
  const errors = fillErrors(fill, catalog);
  if (errors.length) return refusalPart(errors);
  return { type: 'component', format: FILL_FORMAT, fill: structuredClone(fill) };
}

// The part that the kit shows for one part of an envelope. It is never markup.
function readPart(part, path, catalog) {
  if (!isObject(part) || typeof part.type !== 'string' || part.type === '') {
    return refusalPart([`${path}: must be an object with a type`]);
  }
  switch (part.type) {
    case 'text':
      if (!isText(part.text, 0, MAX_TEXT)) return refusalPart([`${path}.text: must be a text of 100000 characters maximum`]);
      return { type: 'text', text: part.text };
    case 'component':
      return componentPart(part.format, part.fill, path, catalog);
    case 'status': {
      const errors = [];
      if (part.state !== 'error') errors.push(`${path}.state: must be error`);
      if (!isText(part.text, 0, MAX_STATUS)) errors.push(`${path}.text: must be a text of 1000 characters maximum`);
      if (own(part, 'code') && !isText(part.code, 0, MAX_CODE)) errors.push(`${path}.code: must be a text of 128 characters maximum`);
      if (errors.length) return refusalPart(errors);
      const status = { type: 'status', state: 'error', text: part.text };
      if (own(part, 'code')) status.code = part.code;
      return status;
    }
    case 'refusal': {
      const valid = Array.isArray(part.errors) && part.errors.length >= 1 && part.errors.length <= MAX_ERRORS &&
        part.errors.every((error) => typeof error === 'string');
      return refusalPart(valid ? part.errors : [`${path}.errors: must be a list of 1 to 20 texts`]);
    }
    case 'fallback':
      return fallbackPart(typeof part.partType === 'string' ? part.partType : '');
    default:
      return fallbackPart(part.type);
  }
}

function refused(header, errors) {
  return { ...header, state: 'refused', errors: errors.slice(0, MAX_ERRORS).map((error) => cut(error, MAX_ERROR)) };
}

// Read one envelope, for example a message from the history of an application. The result is always an
// envelope that agrees with docs/contracts/envelope-v1.schema.json. An envelope with an error is refused.
export function readEnvelope(value, catalog = CATALOG) {
  const header = { envelope: ENVELOPE_VERSION, agui: AGUI_VERSION };
  if (!isObject(value)) return refused(header, ['(envelope): must be an object']);
  const errors = [];
  if (value.envelope !== ENVELOPE_VERSION) errors.push(`envelope: must be ${ENVELOPE_VERSION}`);
  if (value.agui !== AGUI_VERSION) errors.push(`agui: must be ${AGUI_VERSION}`);
  for (const key of ['threadId', 'runId']) {
    if (own(value, key)) {
      if (isId(value[key])) header[key] = value[key];
      else errors.push(`${key}: ${ID_ERROR}`);
    }
  }
  if (isId(value.messageId)) header.messageId = value.messageId;
  else errors.push(`messageId: ${ID_ERROR}`);
  if (own(value, 'role') && !ROLES.includes(value.role)) errors.push(`role: must be one of ${ROLES.join(', ')}`);
  if (value.state !== 'partial' && value.state !== 'final') errors.push('state: must be partial or final');
  errors.push(...actorErrors(value.actor, 'actor'));
  if (!Array.isArray(value.parts)) errors.push('parts: must be a list');
  else if (value.parts.length > MAX_PARTS) errors.push(`parts: more than ${MAX_PARTS} items`);
  if (errors.length) return refused(header, errors);
  const message = { ...header };
  if (own(value, 'role')) message.role = value.role;
  message.actor = actorCopy(value.actor);
  message.state = value.state;
  message.parts = value.parts.map((part, index) => readPart(part, `parts[${index}]`, catalog));
  return message;
}

// A reader of one AG-UI 1.0 stream. Call push for each event in the order of the transport.
// result gives a copy of the runs, the messages in the order of their first event, the count of
// ignored events and the errors of the stream.
export function createReader(catalog = CATALOG) {
  const runs = [];
  const messages = [];
  // The messageId of each message gives its index in messages, its kind and its text length.
  const index = new Map();
  const errors = [];
  let ignored = 0;
  let active = null;
  let count = 0;

  const fail = (error) => {
    if (errors.length < MAX_STREAM_ERRORS) errors.push(error);
  };
  const header = (messageId) => {
    const value = { envelope: ENVELOPE_VERSION, agui: AGUI_VERSION };
    if (active) Object.assign(value, { threadId: active.threadId, runId: active.runId });
    value.messageId = messageId;
    return value;
  };
  const actorOf = (event) => {
    const metadata = isObject(event.metadata) ? event.metadata : {};
    const mugham = isObject(metadata.mugham) ? metadata.mugham : {};
    return mugham.actor;
  };
  const add = (messageId, kind, message) => {
    index.set(messageId, { at: messages.length, kind, size: 0 });
    messages.push(message);
  };
  // Find the open text message of an event. If the event cannot change the message, give null.
  const openText = (event, at) => {
    if (!isId(event.messageId)) {
      fail(`${at}.messageId: ${ID_ERROR}`);
      return null;
    }
    const entry = index.get(event.messageId);
    if (!entry) {
      fail(`${at}.messageId: no message has this id`);
      return null;
    }
    if (entry.kind !== 'text') {
      fail(`${at}.messageId: the message is not a text message`);
      return null;
    }
    const message = messages[entry.at];
    if (message.state === 'refused') {
      ignored += 1;
      return null;
    }
    if (message.state === 'final') {
      fail(`${at}.messageId: the message has ended`);
      return null;
    }
    return { entry, message };
  };

  const handlers = {
    RUN_STARTED(event, at) {
      const bad = ['threadId', 'runId'].filter((key) => !isId(event[key]));
      if (bad.length) return bad.forEach((key) => fail(`${at}.${key}: ${ID_ERROR}`));
      if (active) return fail(`${at}: a run is already active`);
      active = { threadId: event.threadId, runId: event.runId, state: 'active' };
      runs.push(active);
    },
    RUN_FINISHED(event, at) {
      const bad = ['threadId', 'runId'].filter((key) => !isId(event[key]));
      if (bad.length) return bad.forEach((key) => fail(`${at}.${key}: ${ID_ERROR}`));
      if (!active || active.threadId !== event.threadId || active.runId !== event.runId) {
        return fail(`${at}: no active run has this threadId and runId`);
      }
      active.state = 'finished';
      active = null;
    },
    RUN_ERROR(event, at) {
      const bad = [];
      if (!isText(event.message, 0, MAX_STATUS)) bad.push(`${at}.message: must be a text of 1000 characters maximum`);
      if (own(event, 'code') && !isText(event.code, 0, MAX_CODE)) bad.push(`${at}.code: must be a text of 128 characters maximum`);
      if (bad.length) return bad.forEach(fail);
      const status = { type: 'status', state: 'error', text: event.message };
      if (own(event, 'code')) status.code = event.code;
      const runId = active ? active.runId : undefined;
      for (const message of messages) {
        if (message.state === 'partial' && message.runId === runId && message.parts.length < MAX_PARTS) {
          message.parts.push({ ...status });
        }
      }
      if (active) {
        active.state = 'error';
        active.error = { message: event.message };
        if (own(event, 'code')) active.error.code = event.code;
        active = null;
      }
    },
    TEXT_MESSAGE_START(event, at) {
      if (!isId(event.messageId)) return fail(`${at}.messageId: ${ID_ERROR}`);
      if (index.has(event.messageId)) return fail(`${at}.messageId: the message exists already`);
      if (own(event, 'role') && !ROLES.includes(event.role)) return fail(`${at}.role: must be one of ${ROLES.join(', ')}`);
      const actor = actorOf(event);
      const bad = actorErrors(actor, 'metadata.mugham.actor');
      if (bad.length) return add(event.messageId, 'text', refused(header(event.messageId), bad));
      const message = header(event.messageId);
      if (own(event, 'role')) message.role = event.role;
      Object.assign(message, { actor: actorCopy(actor), state: 'partial', parts: [{ type: 'text', text: '' }] });
      add(event.messageId, 'text', message);
    },
    TEXT_MESSAGE_CONTENT(event, at) {
      const open = openText(event, at);
      if (!open) return;
      if (typeof event.delta !== 'string' || event.delta === '') return fail(`${at}.delta: must be a text of 1 character minimum`);
      open.entry.size += length(event.delta, MAX_TEXT);
      if (open.entry.size > MAX_TEXT) {
        const { envelope, agui, threadId, runId, messageId } = open.message;
        const value = { envelope, agui, threadId, runId, messageId };
        for (const key of ['threadId', 'runId']) if (value[key] === undefined) delete value[key];
        messages[open.entry.at] = refused(value, [`text: more than ${MAX_TEXT} characters`]);
        return;
      }
      open.message.parts[0].text += event.delta;
    },
    TEXT_MESSAGE_END(event, at) {
      const open = openText(event, at);
      if (open) open.message.state = 'final';
    },
    ACTIVITY_SNAPSHOT(event, at) {
      if (event.activityType !== FILL_ACTIVITY) {
        ignored += 1;
        return;
      }
      if (!isId(event.messageId)) return fail(`${at}.messageId: ${ID_ERROR}`);
      if (own(event, 'replace') && typeof event.replace !== 'boolean') return fail(`${at}.replace: must be true or false`);
      const entry = index.get(event.messageId);
      if (entry && entry.kind !== 'activity') return fail(`${at}.messageId: the message is a text message`);
      if (entry && event.replace === false) {
        ignored += 1;
        return;
      }
      const actor = actorOf(event);
      const bad = actorErrors(actor, 'metadata.mugham.actor');
      const old = entry ? messages[entry.at] : undefined;
      if (old && bad.length) return bad.forEach((error) => fail(`${at}.${error}`));
      if (old && old.state !== 'refused' && !sameActor(old.actor, actor)) {
        return fail(`${at}.metadata.mugham.actor: must not change`);
      }
      let message;
      if (bad.length) message = refused(header(event.messageId), bad);
      else {
        const content = event.content;
        const part = isObject(content) ? componentPart(content.format, content.fill, 'content', catalog)
          : refusalPart(['content: must be an object']);
        message = { ...header(event.messageId), role: 'activity', actor: actorCopy(actor), state: 'final', parts: [part] };
      }
      if (entry) messages[entry.at] = message;
      else add(event.messageId, 'activity', message);
    },
  };

  return {
    push(event) {
      const at = `events[${count}]`;
      count += 1;
      if (!isObject(event) || typeof event.type !== 'string') return fail(`${at}: must be an object with a type`);
      if (!own(handlers, event.type)) {
        ignored += 1;
        return;
      }
      handlers[event.type](event, at);
    },
    result() {
      return structuredClone({ runs, messages, ignored, errors });
    },
  };
}

// Read a full list of AG-UI 1.0 events.
export function readStream(events, catalog = CATALOG) {
  const reader = createReader(catalog);
  for (const event of events) reader.push(event);
  return reader.result();
}
