---
name: component-workflow
description: Add or change a mugham component, contract first.
---

# Component workflow

1. Read the issue and its completion criteria.
2. Write or change the contract in `catalog/` first. The contract declares the data, the states, the tokens, the accessibility rules, and if the component shows AI content.
3. Write the contract tests and the accessibility checks. Write each expected result from the contract, not from a run of the code.
4. Write the code. Do not add a third-party runtime dependency.
5. Show model output, tool output and document text only as text.
6. Run `make check`. Give each command and its result in the PR.
