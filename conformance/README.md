# Conformance set

This folder holds the conformance set of the stable contract. A consumer runs the set to show that a kit, an adapter or a second validator agrees with the contract of a pinned release. The [compatibility statement](../docs/COMPATIBILITY.md) gives the rules of the contract. [Decision 0008](../docs/decisions/0008-stable-contract.md) gives the design of the set.

This folder is a level 1 path. The owner merges each change.

## Layout

```text
conformance/
  README.md            this guide
  run.py               the runner, Python standard library only
  kit.mjs              the driver that lets the runner use a kit, for Node.js
  v1/
    manifest.json      the set number, the kit release and a SHA-256 for each file
    catalog/
      contracts.json   contracts in the full form, with the expected errors
      fills.json       fills, with the expected errors
      short.json       contracts in the short form, with the full form and the expected errors
      resolved.json    the full form of each contract of the kit catalog
    envelope/
      envelopes.json   envelopes, with the result of the reader
      streams.json     event streams, with the result of the reader
      generate.py      the script that writes the two envelope files
```

Each major version of the contract has one folder. A major release starts a new folder, for example `v2/`. The old folder stays in the tree for one major release.

The data of each case is synthetic.

## Run the set against a pinned release

A release has two assets: the kit archive `mugham.tar` and the conformance archive `mugham-conformance-<version>.tar`. Each asset has a SHA-256 file.

1. Pin the release: the tag, the commit and the SHA-256 of each asset.
2. Get the two assets of that tag. Compare the SHA-256 of each asset with its SHA-256 file.
3. Unpack the two archives into one empty folder. The folder then has the folders `mugham` and `conformance`.
4. Run the set against the kit of the same release. This step needs Python 3 and Node.js.

   ```sh
   python3 -I conformance/run.py --kit mugham
   ```

5. To test a second validator, for example a validator on a server, give its command.

   ```sh
   python3 -I conformance/run.py --kit mugham --validator "my-validator --conformance"
   ```

6. To run only the cases of a release and the earlier releases, add `--since`, for example `--since 1.0.0`.

The runner prints a JSON report. The exit code is 0 if each case passed, 1 if a case failed, and 2 if the run stopped before a result. The runner first compares each file of the set with the manifest. If a file does not agree, the run stops.

In a checkout of the repository, the kit is the root folder: `python3 -I conformance/run.py --kit .`.

## Options

| Option | Result |
|---|---|
| `--kit FOLDER` | The folder of the kit, with its `src` and `catalog` folders. With no `--validator`, the runner tests this kit. |
| `--validator COMMAND` | The command of a second validator. The runner starts it one time, with no shell. |
| `--since RELEASE` | Run only the cases that have a `since` value of this release or of an earlier release. |
| `--kind KIND` | Run only one kind of case. You can give the option more than one time. |
| `--full-text` | Compare the full text of each error. The default compares only the error paths. |
| `--timeout SECONDS` | The time limit of the command. The default is 120. |
| `--set NAME` | The folder of the set. The default is `v1`. |

## What the runner compares

From release 1.0.0, the path of a validator error is stable, and the words after the path are not. [The schema guide](../catalog/schema/README.md#error-paths) gives the grammar of a path.

- By default, the runner changes each list of error texts to the sorted list of its paths, in the expected answer and in the answer of the command. Then it compares the two answers. Thus the words and the order of the errors do not count. The number of errors for each path counts.
- With `--full-text`, the runner compares the full texts in their order. The kit tests use this mode, because the two validators of the kit give the same texts. A second validator can have different words.
- The runner compares each other value as JSON data. The order of the keys of an object does not count.

## The cases

Each case has a `name` and a `since` key. `since` is the release that added the case. These rules apply to the set:

- A minor release adds cases. It does not change the expected result of an earlier case.
- A security fix can change the expected result of a case. The case then gets a `changed` key with the release, and the changelog lists it.
- `resolved.json` has no cases. It holds the full form of each contract of the kit catalog of the release that the manifest names.

The runner makes one request for each case. The `kind` of the request tells what the validator must do.

| Kind | File | Keys of the request | Keys of the answer |
|---|---|---|---|
| `fill` | `catalog/fills.json` | `catalog`, `fill` | `errors` |
| `contract` | `catalog/contracts.json` | `catalog`, `contract` | `errors` |
| `short` | `catalog/short.json` | `catalog`, `contract` | `resolved`, `errors` |
| `resolve` | `catalog/resolved.json` and the kit catalog | `contract` | `resolved`, `errors` |
| `envelope` | `envelope/envelopes.json` | `envelope` | `result` |
| `stream` | `envelope/streams.json` | `events` | `result` |

- `fill`: validate `fill` against the contracts in `catalog`. `errors` is the list of the errors.
- `contract`: validate `contract` as a contract in the full form. `catalog` holds the contracts that it can refer to.
- `short`: get the full form of `contract`. If the short form has errors, `resolved` is `null` and `errors` holds them. If not, `resolved` is the full form, and `errors` holds the errors of the full form against `catalog`.
- `resolve`: get the full form of `contract`, which is one contract file of the kit catalog. `errors` holds only the errors of the short form. This kind needs `--kit`.
- `envelope`: read `envelope` with the catalog of the kit. `result` is the envelope that the reader gives.
- `stream`: read `events` with the catalog of the kit. `result` has the keys `runs`, `messages`, `ignored` and `errors`.

A validator that does not have a reader for a kind cannot pass that kind. Select the kinds that it has with `--kind`.

## The format of a second validator

The runner starts the command one time. It writes each request as one line of JSON on the standard input of the command, and then it closes the input. The command writes one line of JSON on its standard output for each request. The lines can come in a different order.

A request has the keys `id` and `kind`, and the keys of its kind:

```json
{"id": "catalog/fills.json#3", "kind": "fill", "catalog": {"...": "..."}, "fill": {"component": "...", "version": "...", "data": {}}}
```

An answer has the same `id` and the keys of the answer of its kind:

```json
{"id": "catalog/fills.json#3", "errors": ["data.title: a required field is missing"]}
```

These rules apply to the command:

- End each answer with a line feed. Do not put a line feed inside an answer.
- Give one answer for each request, and no other line on the standard output. Write messages for a person on the standard error.
- Exit with the code 0. A different code stops the run.
- One case has a number that is larger than the range of a 64-bit float. The request has it as `1e999`. The expected answer refuses the value, because it is not a finite number.

`tests/conformance_validator.py` in the repository is an example. It answers with the Python validator of the kit tools.

## For a maintainer

- Add a case to the file of its kind, with a `since` key that names the next release. Add an envelope case in `v1/envelope/generate.py`, then run `python3 -B conformance/v1/envelope/generate.py --write`.
- Do not change the expected result of an earlier case, apart from a security fix.
- After each change of a file of the set, write the manifest again: `python3 -B conformance/run.py --write-manifest`. `tests/test_conformance.py` and `tools/build.py` fail if the manifest is not current.
- The manifest names the release that the set goes out with. To change it, give the release: `python3 -B conformance/run.py --write-manifest 1.1.0`. When you prepare a release, give the manifest the version of that release. The release workflow stops if the manifest names a different release than the tag.
- A change of a catalog contract changes `v1/catalog/resolved.json`. Thus it changes this folder, and it is a level 1 change.
- `make check` runs the set against the kit and against the Python validator. `tools/build.py` writes the conformance archive, and the byte check covers it.
