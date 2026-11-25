#!/usr/bin/env python3
"""Warn about simple CSS rules that hide parts with a guardrail."""
import argparse
from pathlib import Path
import re
import sys

from catalog import ROOT, load_catalog

PART = re.compile(r'(?P<tag>[a-z][\w-]*)?(?:[.#][\w-]+)*::part\(\s*(?P<name>[a-z0-9-]+)\s*\)', re.I)
HIDDEN = re.compile(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)'
                    r'|opacity\s*:\s*(?:0(?:\.0+)?|\.0+)%?)\s*(?:!\s*important\s*)?(?=;|$)', re.I)


def hiding_rules(css, contracts):
    """Yield each selector and guardrail part name that a direct rule can hide."""
    guardrails = {f'mu-{name}': {part['name'] for part in contract.get('parts', []) if part['guardrail']}
                  for name, contract in contracts.items()}
    any_host = set().union(*guardrails.values())
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    for selectors, declarations in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        if not HIDDEN.search(declarations):
            continue
        for selector in selectors.split(','):
            for match in PART.finditer(selector):
                tag, name = match.group('tag', 'name')
                names = guardrails.get(tag.lower(), ()) if tag else any_host
                if name in names:
                    yield selector.strip(), name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('styles', type=Path, nargs='+', metavar='CSS')
    args = parser.parse_args()
    contracts, errors = load_catalog(ROOT / 'catalog')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 2
    found = False
    for path in args.styles:
        for selector, name in hiding_rules(path.read_text(encoding='utf-8'), contracts):
            print(f'{path}: {selector} can hide the guardrail part {name}', file=sys.stderr)
            found = True
    return int(found)


if __name__ == '__main__':
    sys.exit(main())
