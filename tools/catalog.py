#!/usr/bin/env python3
"""Validate the component contracts and the fills of contract format 1. See catalog/schema/README.md."""
import datetime
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / 'catalog' / 'schema'
KEYWORDS = {'$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'properties', 'required',
            'additionalProperties', 'propertyNames', 'minProperties', 'maxProperties', 'items', 'minItems',
            'maxItems', 'uniqueItems', 'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum',
            'maximum', 'oneOf'}
TYPE_NAMES = {'object': 'an object', 'array': 'a list', 'string': 'a string', 'boolean': 'true or false',
              'integer': 'an integer', 'number': 'a number', 'null': 'null'}
MAX_DEPTH = 8
# The maximum number of unknown keys that get one error each. More unknown keys get one error in all.
MAX_UNKNOWN = 10
DATE = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}')


def parse_json(text):
    """Parse JSON. Refuse duplicate keys, NaN and Infinity."""
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate key ' + key)
            result[key] = value
        return result

    def constant(name):
        raise ValueError('not a JSON number: ' + name)
    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)


def load_schema(name):
    return parse_json((SCHEMA_DIR / name).read_text(encoding='utf-8'))


def where(path, label):
    return path or label


def is_type(value, name):
    if name == 'object':
        return isinstance(value, dict)
    if name == 'array':
        return isinstance(value, list)
    if name == 'string':
        return isinstance(value, str)
    if name == 'boolean':
        return isinstance(value, bool)
    if name == 'integer':
        # As in JSON Schema 2020-12, 1.0 is an integer. A browser cannot tell 1.0 from 1 after JSON.parse.
        if isinstance(value, float):
            return math.isfinite(value) and value.is_integer()
        return isinstance(value, int) and not isinstance(value, bool)
    if name == 'number':
        # A Python integer has no size limit. math.isfinite() cannot convert a very large one to a float.
        if isinstance(value, float):
            return math.isfinite(value)
        return isinstance(value, int) and not isinstance(value, bool)
    if name == 'null':
        return value is None
    raise ValueError('unknown schema type ' + name)


def python_pattern(pattern):
    """In a JSON schema, $ at the end matches only at the end. In Python, it also matches before a final newline."""
    if pattern.endswith('$') and not pattern.endswith('\\$'):
        return pattern[:-1] + r'\Z'
    return pattern


def canonical(value):
    """Return a key that compares JSON values by value. 1.0 and 1 are equal. True and 1 are not."""
    def normal(item):
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, dict):
            return {key: normal(child) for key, child in item.items()}
        if isinstance(item, list):
            return [normal(child) for child in item]
        return item
    return json.dumps(normal(value), sort_keys=True)


def schema_errors(value, schema, root=None, path='', label='(value)'):
    """Validate value against a JSON schema that uses only the keywords in KEYWORDS."""
    root = schema if root is None else root
    unknown = set(schema) - KEYWORDS
    if unknown:
        raise ValueError('unsupported schema keywords: %s' % sorted(unknown))
    at = where(path, label)
    if '$ref' in schema:
        ref = schema['$ref']
        if not ref.startswith('#/$defs/'):
            raise ValueError('unsupported $ref ' + ref)
        return schema_errors(value, root['$defs'][ref[len('#/$defs/'):]], root, path, label)
    if 'oneOf' in schema:
        results = [schema_errors(value, branch, root, path, label) for branch in schema['oneOf']]
        passed = sum(1 for errors in results if not errors)
        if passed == 1:
            return []
        if passed > 1:
            return ['%s: matches more than one form' % at]
        return min(results, key=len)
    if 'const' in schema and canonical(value) != canonical(schema['const']):
        return ['%s: must be %s' % (at, json.dumps(schema['const']))]
    if 'enum' in schema and canonical(value) not in {canonical(item) for item in schema['enum']}:
        return ['%s: must be one of %s' % (at, ', '.join(json.dumps(item) for item in schema['enum']))]
    if 'type' in schema and not is_type(value, schema['type']):
        return ['%s: must be %s' % (at, TYPE_NAMES[schema['type']])]
    errors = []
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0):
            errors.append('%s: fewer than %d characters' % (at, schema['minLength']))
        if 'maxLength' in schema and len(value) > schema['maxLength']:
            errors.append('%s: more than %d characters' % (at, schema['maxLength']))
        if 'pattern' in schema and not re.search(python_pattern(schema['pattern']), value):
            errors.append('%s: does not agree with the pattern %s' % (at, schema['pattern']))
    if is_type(value, 'number'):
        if 'minimum' in schema and value < schema['minimum']:
            errors.append('%s: less than the minimum %s' % (at, schema['minimum']))
        if 'maximum' in schema and value > schema['maximum']:
            errors.append('%s: more than the maximum %s' % (at, schema['maximum']))
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0):
            errors.append('%s: fewer than %d items' % (at, schema['minItems']))
        if 'maxItems' in schema and len(value) > schema['maxItems']:
            # Do not read the items of a list that is too long. Its size can have no limit.
            return errors + ['%s: more than %d items' % (at, schema['maxItems'])]
        if schema.get('uniqueItems') and len({canonical(item) for item in value}) != len(value):
            errors.append('%s: the items are not unique' % at)
        if 'items' in schema:
            for index, item in enumerate(value):
                errors += schema_errors(item, schema['items'], root, '%s[%d]' % (path, index), label)
    if isinstance(value, dict):
        if len(value) < schema.get('minProperties', 0):
            errors.append('%s: fewer than %d keys' % (at, schema['minProperties']))
        if 'maxProperties' in schema and len(value) > schema['maxProperties']:
            # Do not read the keys of an object that is too large. Its size can have no limit.
            return errors + ['%s: more than %d keys' % (at, schema['maxProperties'])]
        # An object with no maxProperties can have very many unknown keys. Do not make an error for each of them.
        properties = schema.get('properties', {})
        if schema.get('additionalProperties') is False:
            unknown = 0
            for key in value:
                if key not in properties:
                    unknown += 1
                    if unknown > MAX_UNKNOWN:
                        return errors + ['%s: more than %d unknown keys' % (at, MAX_UNKNOWN)]
        for key in schema.get('required', []):
            if key not in value:
                errors.append('%s: missing key %s' % (at, key))
        for key in value:
            child = '%s.%s' % (path, key) if path else key
            if 'propertyNames' in schema:
                errors += ['%s: the key name %s' % (child, error.split(': ', 1)[1])
                           for error in schema_errors(key, schema['propertyNames'], root, child, label)]
            if key in properties:
                errors += schema_errors(value[key], properties[key], root, child, label)
            elif schema.get('additionalProperties') is False:
                errors.append('%s: unknown key %s' % (path, key) if path else '%s: unknown key' % key)
            elif isinstance(schema.get('additionalProperties'), dict):
                errors += schema_errors(value[key], schema['additionalProperties'], root, child, label)
    return errors


CONTRACT_SCHEMA = load_schema('contract.schema.json')
FILL_SCHEMA = load_schema('fill.schema.json')


def fields_of(contract):
    """Yield (path, field) for each field of a contract, with list items and action arguments."""
    for name, field in contract.get('data', {}).items():
        yield 'data.' + name, field
        if field['type'] == 'list':
            yield 'data.%s.items' % name, field['items']
    for name, action in contract.get('actions', {}).items():
        for argument, field in action['arguments'].items():
            yield 'actions.%s.arguments.%s' % (name, argument), field


def references(contract):
    return [(path, field['name']) for path, field in fields_of(contract) if field['type'] == 'component']


def contract_errors(contract, filename=None, catalog=None, invalid=()):
    """Return the errors of one contract. If catalog is given, also check the component fields.

    invalid holds the names of contracts that exist but have errors.
    """
    errors = schema_errors(contract, CONTRACT_SCHEMA, label='(contract)')
    if errors:
        return errors
    if filename is not None and contract['name'] + '.json' != filename:
        errors.append('name: must agree with the file name ' + filename)
    states = set(contract['states'])
    if 'default' not in states:
        errors.append('states: must include default')
    if contract.get('actions') and not {'pending', 'done', 'error'} <= states:
        errors.append('states: a contract with actions must include pending, done and error')
    accessibility = contract['accessibility']
    name = accessibility.get('name', {})
    if accessibility['role'] == 'none' and 'name' in accessibility:
        errors.append('accessibility.name: a component with the role none has no accessible name')
    if accessibility['role'] != 'none' and 'name' not in accessibility:
        errors.append('accessibility.name: a component with a role needs an accessible name')
    if 'field' in name:
        field = contract['data'].get(name['field'])
        if not field or field['type'] != 'text' or not field['required']:
            errors.append('accessibility.name: the field must be a required text field')
    for path, field in fields_of(contract):
        if field.get('min_length', 0) > field.get('max_length', math.inf):
            errors.append(path + ': min_length is more than max_length')
        if field.get('minimum', -math.inf) > field.get('maximum', math.inf):
            errors.append(path + ': minimum is more than maximum')
    if catalog is not None:
        for path, target in references(contract):
            if target in invalid:
                errors.append('%s: no valid contract has the name %s' % (path, target))
            elif target not in catalog:
                errors.append('%s: no contract has the name %s' % (path, target))
            elif reaches(catalog, target, contract['name']):
                errors.append('%s: the contract contains itself through %s' % (path, target))
    return errors


def reaches(catalog, start, goal):
    seen, todo = set(), [start]
    while todo:
        name = todo.pop()
        if name == goal:
            return True
        if not isinstance(name, str) or name in seen or name not in catalog:
            continue
        seen.add(name)
        try:
            todo += [target for _, target in references(catalog[name])]
        except (KeyError, TypeError, AttributeError):
            continue
    return False


def value_errors(value, field, path, catalog, depth):
    kind = field['type']
    if kind == 'text':
        if not isinstance(value, str):
            return [path + ': must be a string']
        if len(value) > field['max_length']:
            return ['%s: more than %d characters' % (path, field['max_length'])]
        if len(value) < field.get('min_length', 0):
            return ['%s: fewer than %d characters' % (path, field['min_length'])]
        return []
    if kind in ('number', 'integer'):
        if not is_type(value, kind):
            return ['%s: must be %s' % (path, 'an integer' if kind == 'integer' else 'a number')]
        if 'minimum' in field and value < field['minimum']:
            return ['%s: less than the minimum %s' % (path, field['minimum'])]
        if 'maximum' in field and value > field['maximum']:
            return ['%s: more than the maximum %s' % (path, field['maximum'])]
        return []
    if kind == 'boolean':
        return [] if isinstance(value, bool) else [path + ': must be true or false']
    if kind == 'date':
        try:
            if isinstance(value, str) and DATE.fullmatch(value):
                datetime.date.fromisoformat(value)
                return []
        except ValueError:
            pass
        return [path + ': must be a date as YYYY-MM-DD']
    if kind == 'enum':
        if isinstance(value, str) and value in field['values']:
            return []
        return ['%s: must be one of %s' % (path, ', '.join(field['values']))]
    if kind == 'list':
        if not isinstance(value, list):
            return [path + ': must be a list']
        if len(value) > field['max_items']:
            return ['%s: more than %d items' % (path, field['max_items'])]
        errors = []
        for index, item in enumerate(value):
            errors += value_errors(item, field['items'], '%s[%d]' % (path, index), catalog, depth)
        return errors
    if kind == 'component':
        if isinstance(value, dict) and value.get('component') != field['name']:
            return ['%s.component: must be %s' % (path, field['name'])]
        return fill_errors(value, catalog, path, depth + 1)
    raise ValueError('unknown field type ' + kind)


def fill_errors(fill, catalog, path='', depth=0):
    """Return the errors of a fill. A fill with an error is refused. The fill does not change."""
    prefix = path + '.' if path else ''
    if depth > MAX_DEPTH:
        return ['%s: the fill is nested too deep' % (path or '(fill)')]
    errors = schema_errors(fill, FILL_SCHEMA, path=path, label='(fill)')
    if errors:
        return errors
    contract = catalog.get(fill['component'])
    if contract is None:
        return ['%scomponent: no contract has the name %s' % (prefix, fill['component'])]
    if fill['version'] != contract['version']:
        return ['%sversion: must be %s' % (prefix, contract['version'])]
    data = fill['data']
    for key in data:
        if key not in contract['data']:
            errors.append('%sdata.%s: the contract does not declare this field' % (prefix, key))
    for key, field in contract['data'].items():
        if key in data:
            errors += value_errors(data[key], field, '%sdata.%s' % (prefix, key), catalog, depth)
        elif field['required']:
            errors.append('%sdata.%s: a required field is missing' % (prefix, key))
    declared = contract.get('actions', {})
    for index, item in enumerate(fill.get('actions', [])):
        at = '%sactions[%d]' % (prefix, index)
        action = declared.get(item['action'])
        if action is None:
            errors.append(at + '.action: the contract does not declare this action')
            continue
        arguments = item['arguments']
        for key in arguments:
            if key not in action['arguments']:
                errors.append('%s.arguments.%s: the action does not declare this argument' % (at, key))
        for key, field in action['arguments'].items():
            if key in arguments:
                errors += value_errors(arguments[key], field, '%s.arguments.%s' % (at, key), catalog, depth)
            elif field['required']:
                errors.append('%s.arguments.%s: a required argument is missing' % (at, key))
    return errors


def load_catalog(folder):
    """Read each contract file in folder. Return the contracts and the errors."""
    folder = Path(folder)
    contracts, errors = {}, []
    for path in sorted(folder.glob('*.json')):
        try:
            contracts[path.name] = parse_json(path.read_text(encoding='utf-8'))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            errors.append('%s: not valid JSON (%s)' % (path.name, error))
    # Check the shape of each contract first. The reference check then reads only contracts with a valid shape.
    shaped = {}
    for filename, contract in contracts.items():
        if not contract_errors(contract, filename):
            shaped[contract['name']] = contract
    named = {contract['name'] for contract in contracts.values()
             if isinstance(contract, dict) and isinstance(contract.get('name'), str)}
    valid = {}
    for filename, contract in contracts.items():
        found = contract_errors(contract, filename, shaped, named - set(shaped))
        errors += ['%s: %s' % (filename, error) for error in found]
        if not found:
            valid[contract['name']] = contract
    return valid, errors


def main():
    contracts, errors = load_catalog(ROOT / 'catalog')
    print(json.dumps({'passed': not errors, 'contracts': sorted(contracts), 'errors': errors,
                      'scope': 'The contract files in catalog/ against contract format 1. No browser result.'},
                     indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
