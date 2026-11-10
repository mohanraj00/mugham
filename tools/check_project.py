#!/usr/bin/env python3
"""Offline check of the shared harness layout, the local links and the workflow pins."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['CONSTITUTION.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md',
            'LICENSE', 'CHANGELOG.md', 'Makefile', 'docs/STATUS.md', 'docs/REVIEW.md', 'docs/STANDARD.md',
            '.agents/skills/component-workflow/SKILL.md', '.github/CODEOWNERS', '.github/pull_request_template.md',
            '.github/dependabot.yml', '.github/gates.json', '.github/workflows/ci.yml', '.github/workflows/gates.yml',
            '.github/workflows/gates-rerun.yml', '.github/workflows/claude-review.yml', '.github/ISSUE_TEMPLATE/bug.yml',
            '.github/ISSUE_TEMPLATE/feature.yml', '.github/ISSUE_TEMPLATE/docs.yml', '.github/ISSUE_TEMPLATE/config.yml',
            'tools/claude_review.py', 'tools/cross_review.py']


def main():
    errors = []
    links = 0
    for path in sorted(ROOT.rglob('*')):
        relative = path.relative_to(ROOT)
        if relative.parts[0] == '.git':
            continue
        name = relative.as_posix()
        if path.is_symlink():
            if name != '.claude/skills' or path.readlink().as_posix() != '../.agents/skills':
                errors.append('unexpected or invalid symlink: ' + name)
            continue
        if not path.is_file():
            continue
        if set(relative.parts) & {'__pycache__', '.venv', 'node_modules'}:
            errors.append('generated directory in the checkout: ' + name)
        if path.suffix == '.md':
            for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
                if target.startswith(('https:', 'http:', '#', 'mailto:')):
                    continue
                links += 1
                if not (path.parent / target.split('#')[0]).exists():
                    errors.append('broken local link: %s -> %s' % (name, target))
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            errors.append('missing: ' + name)
    if not (ROOT / '.claude/skills').is_symlink():
        errors.append('missing shared skill link: .claude/skills')
    for name in ['CLAUDE.md', 'GEMINI.md']:
        text = (ROOT / name).read_text(encoding='utf-8') if (ROOT / name).is_file() else ''
        if '@CONSTITUTION.md' not in text or '@AGENTS.md' not in text:
            errors.append(name + ' does not import the shared rules')
    try:
        json.loads((ROOT / '.github/gates.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        errors.append('.github/gates.json: %s' % error)
    # The gates action, the classify step and the gate regression job use one full SHA of mohanraj00/.github.
    pins = set()
    for name in ['gates.yml', 'ci.yml', 'claude-review.yml']:
        path = ROOT / '.github/workflows' / name
        text = path.read_text(encoding='utf-8') if path.is_file() else ''
        pins |= set(re.findall(r'mohanraj00/\.github/gates@(\S+)', text))
        pins |= set(re.findall(r'repository: mohanraj00/\.github\n\s+ref: (\S+)', text))
    if len(pins) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(pins), '')):
        errors.append('the workflows must pin mohanraj00/.github to one full SHA: %s' % sorted(pins))
    ci = ROOT / '.github/workflows/ci.yml'
    if ci.is_file() and 'test_gate.py' not in ci.read_text(encoding='utf-8'):
        errors.append('ci.yml must run the gate regression tests of the pinned gates action')
    if ci.is_file() and 'actionlint .github/workflows/*.yml' not in ci.read_text(encoding='utf-8'):
        errors.append('ci.yml must parse each workflow with actionlint')
    # The Claude review has one trigger, read-only tools and the secret only in its review job.
    sys.path.insert(0, str(ROOT / 'tools'))
    from claude_review import workflow_errors
    errors += ['claude-review.yml ' + x for x in workflow_errors((ROOT / '.github/workflows/claude-review.yml').read_text(encoding='utf-8'))]
    # The agy fallback must not load the global allow rules or MCP servers of the maintainer.
    review = (ROOT / 'tools/cross_review.py').read_text(encoding='utf-8')
    for need in ["env['HOME']=home", "'--sandbox'", "'allow':[]"]:
        if need not in review:
            errors.append('cross_review.py must keep ' + need)
    print(json.dumps({'passed': not errors, 'local_links_checked': links, 'errors': errors,
                      'scope': 'Layout, links and workflow pins only. No component, runtime or browser result.'}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
