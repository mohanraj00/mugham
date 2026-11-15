// Compare explicit narration claims with the fill that drives a card. See decision 0005.
import card from '../../catalog/card.json' with { type: 'json' };
import fact from '../../catalog/fact.json' with { type: 'json' };
import { fillErrors } from '../render/validate.js';

export const MAX_NARRATION_LENGTH = 10000;
export const MAX_ERRORS = 50;

const CONTRACTS = { card, fact };
const LABEL = /^[^:\[\]\r\n]+$/u;
const CLAIM = /^([^:\[\]\r\n]+): ([^\[\]\r\n]+)$/u;
const result = (checked, errors) => ({
  ok: errors.length === 0,
  checked,
  errors: errors.length < MAX_ERRORS ? errors : [
    ...errors.slice(0, MAX_ERRORS),
    { field: 'narration', message: `check stopped at the error limit of ${MAX_ERRORS}` }
  ]
});

export function checkNarration(fill, narration) {
  if (typeof narration === 'string' && narration.length > MAX_NARRATION_LENGTH) {
    return result(0, [{ field: 'narration',
      message: `must have at most ${MAX_NARRATION_LENGTH} UTF-16 code units` }]);
  }
  if (fill?.component !== 'card') {
    return result(0, [{ field: 'component', message: 'must be a card' }]);
  }
  const errors = fillErrors(fill, CONTRACTS).map((error) => {
    const separator = error.indexOf(': ');
    return { field: error.slice(0, separator), message: error.slice(separator + 2) };
  });
  if (typeof narration !== 'string') errors.push({ field: 'narration', message: 'must be a string' });
  if (errors.length) return result(0, errors);

  // Labels come only from the fill. A Map also keeps prototype names as ordinary data.
  const fields = new Map();
  const add = (label, value, path) => {
    if (!LABEL.test(label)) {
      errors.push({ field: path, message: 'must be a nonempty label with no colon, square bracket or line break' });
    } else if (fields.has(label)) {
      errors.push({ field: label, message: 'card labels must be unique' });
    } else {
      fields.set(label, value);
    }
  };
  if (fill.data.date !== undefined) add(fill.data.date_label ?? 'Date', fill.data.date, 'data.date_label');
  for (const [index, item] of (fill.data.facts ?? []).entries()) {
    add(item.data.label, item.data.value, `data.facts.${index}.data.label`);
  }
  if (errors.length) return result(0, errors);

  let checked = 0;
  const brackets = /[\[\]]/g;
  let bracket;
  const malformed = () => errors.push({ field: 'narration', message: 'must use [Field: value]' });
  while (errors.length < MAX_ERRORS && (bracket = brackets.exec(narration)) !== null) {
    if (bracket[0] === ']') {
      malformed();
      continue;
    }
    const close = narration.indexOf(']', brackets.lastIndex);
    if (close === -1) {
      malformed();
      break;
    }
    const match = CLAIM.exec(narration.slice(brackets.lastIndex, close));
    brackets.lastIndex = close + 1;
    if (!match) {
      malformed();
      continue;
    }
    const [, field, value] = match;
    checked += 1;
    if (!fields.has(field)) errors.push({ field, message: 'no card field has this label' });
    else if (fields.get(field) !== value) errors.push({ field, message: 'does not match the card value' });
  }
  return result(checked, errors);
}
