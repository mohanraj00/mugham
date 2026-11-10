# Agent workflow

Read [CONSTITUTION.md](CONSTITUTION.md), this file, then [docs/STATUS.md](docs/STATUS.md). GitHub issues own current work.

## Shared harness setup

Codex reads this entry point. `CLAUDE.md` and `GEMINI.md` import the constitution and this file, for Claude Code and agy (Antigravity). Shared skills live in `.agents/skills/`. `.claude/skills` is a relative link to that folder. If your harness does not find a skill, read its `SKILL.md` directly. Edit shared instructions only at their owning path.

For component work, read [.agents/skills/component-workflow/SKILL.md](.agents/skills/component-workflow/SKILL.md).

## Layout

The project has no source code yet. This is the planned layout:

- `catalog/`: one contract file for each component, and the schema of the contract format.
- `src/`: the kit and the workbench shell.
- `tests/`: the contract tests, the accessibility checks and the build check.
- `examples/`: neutral synthetic examples.
- `tools/`: the project check and the local cross review.
- `docs/`: the status and the review rules.

## Work

1. Start from a GitHub issue with a workflow and completion criteria.
2. Inspect the working tree. Keep unrelated edits.
3. Use a task branch and a PR. The branch prefix names the harness: `claude/`, `codex/` or `agy/`.
4. Change the contract of a component before its code.
5. Write the expected result of a test before you run the code against it.

After each change, run:

```sh
make check
```

Keep scratch work and raw runs outside the checkout and outside synced folders, for example iCloud.

## Review

A harness does not review its own change. Ask the other harness for a review in a PR comment on GitHub: Claude Code writes `@codex review`. Codex and agy write `@claude review this PR. Use the Review guidelines in AGENTS.md.` If that reviewer is not available, run the local agy fallback, `python3 -B tools/cross_review.py`. A security-relevant change also needs a security review. [docs/REVIEW.md](docs/REVIEW.md) owns the request rules, the fallback, fork PR acceptance and the CI scope.

## Review guidelines

Flag these as high priority in a PR review:

- A new third-party runtime dependency.
- A component that a model can fill, with no contract.
- Model output, tool output or document text that goes into markup, style or script.
- An action that shows as done before its receipt comes back.
- A pending offline action that shows as done.
- Content of an agent that shows as the content of a person.
- A removed contract test or accessibility check.
- A name of a real product, brand, customer or person in the catalog, the examples or the tests.
- Private material, credentials or generated binaries.

End a code review with one line. If `.github/gates.json` or the shared categories of the gates mark a changed path as security-relevant, write `Security review: needed`, with the reason. If not, write `Security review: not needed`. A security review does not end with this line.

## Records and publication

The governance block of the [constitution](CONSTITUTION.md#governance) owns the approval rule for each tag, release, package publication and outreach. An engineering task does not approve a promotion or a change to a different repository. Report security concerns as [SECURITY.md](SECURITY.md) says.

## Writing

Docs, issues, commits and comments use ASD-STE100 Simplified Technical English. Do not use em dashes or filler words.
