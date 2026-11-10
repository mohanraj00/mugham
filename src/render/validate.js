// The browser validator of a fill. It gives the same errors as tools/catalog.py for each case in
// tests/vectors/fills.json. A fill with an error is refused. The validator never changes the fill.
import FILL_SCHEMA from '../../catalog/schema/fill.schema.json' with { type: 'json' };

const KEYWORDS = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'properties', 'required',
  'additionalProperties', 'propertyNames', 'minProperties', 'maxProperties', 'items', 'minItems', 'maxItems',
  'uniqueItems', 'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'oneOf']);
const TYPE_NAMES = { object: 'an object', array: 'a list', string: 'a string', boolean: 'true or false',
  integer: 'an integer', number: 'a number', null: 'null' };
const MAX_DEPTH = 8;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const length = (text) => [...text].length;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isType(value, name) {
  switch (name) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'null': return value === null;
    default: throw new Error('unknown schema type ' + name);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isObject(value)) return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

export function schemaErrors(value, schema, root = schema, path = '', label = '(value)') {
  for (const key of Object.keys(schema)) {
    if (!KEYWORDS.has(key)) throw new Error('unsupported schema keyword ' + key);
  }
  const at = path || label;
  if (own(schema, '$ref')) {
    const ref = schema.$ref;
    if (!ref.startsWith('#/$defs/')) throw new Error('unsupported $ref ' + ref);
    return schemaErrors(value, root.$defs[ref.slice('#/$defs/'.length)], root, path, label);
  }
  if (own(schema, 'oneOf')) {
    const results = schema.oneOf.map((branch) => schemaErrors(value, branch, root, path, label));
    const passed = results.filter((errors) => errors.length === 0).length;
    if (passed === 1) return [];
    if (passed > 1) return [`${at}: matches more than one form`];
    return results.reduce((best, errors) => (errors.length < best.length ? errors : best));
  }
  if (own(schema, 'const') && canonical(value) !== canonical(schema.const)) {
    return [`${at}: must be ${JSON.stringify(schema.const)}`];
  }
  if (own(schema, 'enum') && !schema.enum.some((item) => canonical(item) === canonical(value))) {
    return [`${at}: must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`];
  }
  if (own(schema, 'type') && !isType(value, schema.type)) return [`${at}: must be ${TYPE_NAMES[schema.type]}`];
  const errors = [];
  if (typeof value === 'string') {
    if (length(value) < (schema.minLength ?? 0)) errors.push(`${at}: fewer than ${schema.minLength} characters`);
    if (own(schema, 'maxLength') && length(value) > schema.maxLength) errors.push(`${at}: more than ${schema.maxLength} characters`);
    if (own(schema, 'pattern') && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${at}: does not agree with the pattern ${schema.pattern}`);
    }
  }
  if (isType(value, 'number')) {
    if (own(schema, 'minimum') && value < schema.minimum) errors.push(`${at}: less than the minimum ${schema.minimum}`);
    if (own(schema, 'maximum') && value > schema.maximum) errors.push(`${at}: more than the maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0)) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (own(schema, 'maxItems') && value.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(canonical)).size !== value.length) errors.push(`${at}: the items are not unique`);
    if (own(schema, 'items')) {
      value.forEach((item, index) => errors.push(...schemaErrors(item, schema.items, root, `${path}[${index}]`, label)));
    }
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length < (schema.minProperties ?? 0)) errors.push(`${at}: fewer than ${schema.minProperties} keys`);
    if (own(schema, 'maxProperties') && keys.length > schema.maxProperties) errors.push(`${at}: more than ${schema.maxProperties} keys`);
    for (const key of schema.required ?? []) {
      if (!own(value, key)) errors.push(`${at}: missing key ${key}`);
    }
    const properties = schema.properties ?? {};
    for (const key of keys) {
      const child = path ? `${path}.${key}` : key;
      if (own(schema, 'propertyNames')) {
        for (const error of schemaErrors(key, schema.propertyNames, root, child, label)) {
          errors.push(`${child}: the key name ${error.split(': ').slice(1).join(': ')}`);
        }
      }
      if (own(properties, key)) errors.push(...schemaErrors(value[key], properties[key], root, child, label));
      else if (schema.additionalProperties === false) errors.push(path ? `${path}: unknown key ${key}` : `${key}: unknown key`);
      else if (isObject(schema.additionalProperties)) errors.push(...schemaErrors(value[key], schema.additionalProperties, root, child, label));
    }
  }
  return errors;
}

function isDate(value) {
  const match = typeof value === 'string' ? DATE.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1) return false;
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function valueErrors(value, field, path, catalog, depth) {
  switch (field.type) {
    case 'text':
      if (typeof value !== 'string') return [`${path}: must be a string`];
      if (length(value) > field.max_length) return [`${path}: more than ${field.max_length} characters`];
      if (length(value) < (field.min_length ?? 0)) return [`${path}: fewer than ${field.min_length} characters`];
      return [];
    case 'number':
    case 'integer':
      if (!isType(value, field.type)) return [`${path}: must be ${field.type === 'integer' ? 'an integer' : 'a number'}`];
      if (own(field, 'minimum') && value < field.minimum) return [`${path}: less than the minimum ${field.minimum}`];
      if (own(field, 'maximum') && value > field.maximum) return [`${path}: more than the maximum ${field.maximum}`];
      return [];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path}: must be true or false`];
    case 'date':
      return isDate(value) ? [] : [`${path}: must be a date as YYYY-MM-DD`];
    case 'enum':
      return typeof value === 'string' && field.values.includes(value) ? [] : [`${path}: must be one of ${field.values.join(', ')}`];
    case 'list': {
      if (!Array.isArray(value)) return [`${path}: must be a list`];
      if (value.length > field.max_items) return [`${path}: more than ${field.max_items} items`];
      return value.flatMap((item, index) => valueErrors(item, field.items, `${path}[${index}]`, catalog, depth));
    }
    case 'component':
      if (isObject(value) && value.component !== field.name) return [`${path}.component: must be ${field.name}`];
      return fillErrors(value, catalog, path, depth + 1);
    default:
      throw new Error('unknown field type ' + field.type);
  }
}

// catalog maps a component name to its contract. CI validates each contract with tools/catalog.py.
export function fillErrors(fill, catalog, path = '', depth = 0) {
  const prefix = path ? path + '.' : '';
  if (depth > MAX_DEPTH) return [`${path || '(fill)'}: the fill is nested too deep`];
  const errors = schemaErrors(fill, FILL_SCHEMA, FILL_SCHEMA, path, '(fill)');
  if (errors.length) return errors;
  const contract = own(catalog, fill.component) ? catalog[fill.component] : undefined;
  if (contract === undefined) return [`${prefix}component: no contract has the name ${fill.component}`];
  if (fill.version !== contract.version) return [`${prefix}version: must be ${contract.version}`];
  const data = fill.data;
  for (const key of Object.keys(data)) {
    if (!own(contract.data, key)) errors.push(`${prefix}data.${key}: the contract does not declare this field`);
  }
  for (const [key, field] of Object.entries(contract.data)) {
    if (own(data, key)) errors.push(...valueErrors(data[key], field, `${prefix}data.${key}`, catalog, depth));
    else if (field.required) errors.push(`${prefix}data.${key}: a required field is missing`);
  }
  const declared = contract.actions ?? {};
  (fill.actions ?? []).forEach((item, index) => {
    const at = `${prefix}actions[${index}]`;
    const action = own(declared, item.action) ? declared[item.action] : undefined;
    if (action === undefined) {
      errors.push(`${at}.action: the contract does not declare this action`);
      return;
    }
    const args = item.arguments;
    for (const key of Object.keys(args)) {
      if (!own(action.arguments, key)) errors.push(`${at}.arguments.${key}: the action does not declare this argument`);
    }
    for (const [key, field] of Object.entries(action.arguments)) {
      if (own(args, key)) errors.push(...valueErrors(args[key], field, `${at}.arguments.${key}`, catalog, depth));
      else if (field.required) errors.push(`${at}.arguments.${key}: a required argument is missing`);
    }
  });
  return errors;
}
