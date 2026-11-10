# Contributing

The [constitution](CONSTITUTION.md) has authority over the component contracts. The contracts have authority over the code.

## Workflow

1. Open an issue with the change and its completion criteria.
2. Change the contract of a component before its code.
3. Write the expected result of each test before you run the code against it.
4. Use synthetic, neutral data in examples and tests.
5. Open a PR from a topic branch. Fill in the PR template.

## Checks

You do not need Codex, Claude Code or agy. The project check uses only Python 3 and its standard library.

After each change:

```bash
make check
```

## Review

[docs/REVIEW.md](docs/REVIEW.md) gives the review and merge rules. [AGENTS.md](AGENTS.md) gives the review guidelines.

## Writing

Write short sentences in ASD-STE100 Simplified Technical English. Do not use em dashes or filler words.
