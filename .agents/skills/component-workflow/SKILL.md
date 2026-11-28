---
name: component-workflow
description: Add or change a mugham component, contract first.
---

# Component workflow

1. Read the issue and its completion criteria.
2. Write or change the contract in `catalog/` first, in the short form. The contract declares the data, the states, the tokens, the accessibility rules, and if the component shows AI content. State only the values that are not a default. See "Minimum contract".
3. Write the contract tests and the accessibility checks. Write each expected result from the contract, not from a run of the code.
4. Write the code. Do not add a third-party runtime dependency.
5. Show model output, tool output and document text only as text.
6. Run `make check`. Give each command and its result in the PR.

## Minimum contract

A contract that uses the defaults of the catalog needs only its name, its description and its own data fields:

```json
{
  "name": "seed-tray",
  "description": "A tray of seedlings with its label and its sow date.",
  "data": {
    "label": {"type": "text", "required": true, "size": "line"},
    "sown": {"type": "date"}
  }
}
```

The defaults give the other values: the version `0.1.0`, the kind `component`, AI content with a required authorship slot, the state `default`, the base tokens and the role `none`. A field is not required, and its label comes from its key. `catalog/schema/README.md` gives each default, the size names and the override rules.

After a change to a contract, write the full form of the catalog again, and read the diff of that file:

```sh
python3 -B tools/catalog.py --resolved > conformance/v1/catalog/resolved.json
python3 -B conformance/run.py --write-manifest
```

The second command writes the manifest of the conformance set again. `conformance/` is a level 1 path, so the owner merges the change.
