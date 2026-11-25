"""Check the part names in the render code, the catalog and the theme guide."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = {path.stem: json.loads(path.read_text(encoding='utf-8'))
             for path in (ROOT / 'catalog').glob('*.json')}
GUIDE = ROOT / 'docs' / 'guides' / 'theme.md'
NAME = r'[a-z0-9-]+'
DECLARATION = re.compile(r'^(?:export )?(?:class|function|const) (?P<name>\w+)', re.M)
PART_ATTRIBUTE = re.compile(
    r'''(?:[{,]\s*(?:part|'part'|"part")\s*:\s*|\.setAttribute\(\s*['"]part['"]\s*,\s*'''
    r'''|<[^<>\n]*?\s+part\s*=\s*)''')
PART_VALUE = re.compile(r'''(?:(?P<optional>\w+)\s*\?\s*)?(['"])(?P<names>[a-z0-9\s-]+)\2(?(optional)\s*:\s*null)''')
EXPORT = re.compile(r'''(\w+)\.setAttribute\(\s*['"]exportparts['"]\s*,\s*''')
EXPORT_VALUE = re.compile(r'''(['"])([^'"]+)\1\s*\)''')


def part_sections():
    """Read each top-level class and helper in the source. Keep CSS selectors out of the scan."""
    sections = {}
    for path in sorted((ROOT / 'src').rglob('*.js')):
        source = re.sub(r'^\s*//[^\n]*', '', path.read_text(encoding='utf-8'), flags=re.M)
        starts = list(DECLARATION.finditer(source))
        for start, end in zip([None, *starts], [*starts, None]):
            body = source[start.start() if start else 0:end.start() if end else len(source)]
            key = (path.relative_to(ROOT), start['name'] if start else '')
            sections[key] = body
    return sections


def exported_parts(body):
    for match in EXPORT.finditer(body):
        receiver = match[1]
        value = EXPORT_VALUE.match(body, match.end())
        tag = re.search(rf"\b{receiver} = document\.createElement\('mu-({NAME})'\)", body)
        if value is None or tag is None:
            raise AssertionError('Use a literal exportparts value on a named nested element')
        for pair in value[2].split(','):
            source, alias = (item.strip() for item in pair.split(':'))
            yield tag[1], source, alias


class PartsTest(unittest.TestCase):
    def test_rendered_and_declared_parts_agree(self):
        sections = part_sections()
        direct = {}
        exports = {}
        classes = {}
        hosts = {}
        imports = {}
        for key, body in sections.items():
            path, name = key
            if not name:
                imports[path] = set(re.findall(r'\w+', ' '.join(re.findall(r'^import \{([^}]+)\}', body, re.M))))
            for match in PART_ATTRIBUTE.finditer(body):
                value = PART_VALUE.match(body, match.end())
                self.assertIsNotNone(value, f'{path} {name} must give a literal part name')
                direct.setdefault(key, set()).update(value['names'].split())
            for child, source, alias in exported_parts(body):
                self.assertEqual(alias, f'{child}-{source}')
                self.assertNotIn(alias, exports.setdefault(key, {}))
                exports[key][alias] = (child, source)
            if re.match(r'(?:export )?class ', body):
                self.assertNotIn(name, classes)
                classes[name] = key
                component = re.search(r"static component = '([^']+)'", body)
                if component:
                    self.assertNotIn(component[1], hosts)
                    hosts[component[1]] = key

        seen = set()

        def rendered(key):
            seen.add(key)
            path, name = key
            body = sections[key]
            parts = direct.get(key, set()) | exports.get(key, {}).keys()
            base = re.match(rf'(?:export )?class {name} extends (\w+)', body)
            if base and base[1] in classes:
                parts |= rendered(classes[base[1]])
            # A call to a part helper adds its parts to the current shadow root.
            for helper in direct:
                if helper == key:
                    continue
                helper_path, helper_name = helper
                if helper_name and (helper_path == path or helper_name in imports[path]):
                    call = 'new ' if helper in classes.values() else r'(?<![.\w])'
                    if re.search(rf'{call}{helper_name}\(', body):
                        parts |= rendered(helper)
            return parts

        self.assertLessEqual(hosts.keys(), CONTRACTS.keys())
        for name, contract in sorted(CONTRACTS.items()):
            with self.subTest(component=name):
                expected = {part['name'] for part in contract['parts']}
                actual = rendered(hosts[name]) if name in hosts else set()
                self.assertSetEqual(actual, expected)
                for alias, (child, source) in exports.get(hosts.get(name), {}).items():
                    inner_part = next(part for part in CONTRACTS[child]['parts'] if part['name'] == source)
                    outer_part = next(part for part in contract['parts'] if part['name'] == alias)
                    self.assertEqual(inner_part['guardrail'], outer_part['guardrail'])

        # The thread renders envelopes and has no fill contract. The guide lists its parts.
        thread = rendered(classes['MuThread'])
        self.assertSetEqual(thread, set(documented_parts()['mu-thread']))
        self.assertEqual((direct.keys() | exports.keys()) - seen, set(),
                         'Each source section that makes parts needs an owner')

    def test_the_guide_lists_the_contract_parts_and_guardrails(self):
        table = documented_parts()
        del table['mu-thread']
        expected = {f'mu-{name}': {part['name']: part['guardrail'] for part in contract['parts']}
                    for name, contract in CONTRACTS.items() if contract['parts']}
        self.assertEqual(table, expected)

    def test_the_guide_lists_the_exports(self):
        declared = set()
        for line in GUIDE.read_text(encoding='utf-8').splitlines():
            match = re.fullmatch(rf'\| `mu-({NAME})` \| `mu-({NAME})` \| `({NAME})` \| `({NAME})` \|', line)
            if match:
                declared.add(match.groups())
        exports = set()
        for body in part_sections().values():
            for child, source, alias in exported_parts(body):
                owner = re.search(rf"static component = '({NAME})'", body)[1]
                exports.add((owner, child, source, alias))
        self.assertEqual(declared, exports)


def documented_parts():
    guide = GUIDE.read_text(encoding='utf-8')
    section = guide.split('## Declared parts\n', 1)[1].split('\n## ', 1)[0]
    return {name: {part: bool(guardrail) for part, guardrail in re.findall(rf'`({NAME})`(\\\*)?', row)}
            for name, row in re.findall(rf'^\| `(mu-{NAME})` \| ([^|\n]+) \|$', section, re.M)}
