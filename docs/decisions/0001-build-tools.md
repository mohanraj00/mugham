# 0001: Build tools and the dependency rule

Status: accepted, 2026-11-10. Issue: mohanraj00/mugham#1.

## Context

The kit uses web standards, for example custom elements, ES modules and CSS custom properties. The constitution forbids a third-party runtime dependency without a level 1 change. Two builds of one commit must give the same bytes. The kit needs three tools:

1. A build that makes the package from `src/` and `catalog/`.
2. A test runner for the contract tests.
3. A browser for the accessibility checks: keyboard, screen reader names, forced colors and reduced motion.

## Dependency rule

- A runtime dependency is code that the published kit loads or contains. It includes copied or bundled third-party code. The kit has none. A new runtime dependency is a level 1 change, and the owner accepts it in the PR.
- A development dependency is a tool that only builds or tests the kit. Its code is not in the package. The owner accepts each one in a decision record in `docs/decisions/`. The record names one exact version and the checksum of its download.
- A platform is a program that the developer or CI installs, for example Python, Node.js or a browser. CI pins one exact version. A platform is not a dependency, but a new platform also needs a decision record.
- A dependency manifest or lock file is a level 1 path, as the standard says.

## Options

### Option A: no third-party tool

- Build: a Python standard library script, `tools/build.py`. It puts the source files in sorted order into one tar archive, `mugham.tar`. The archive has a manifest with the SHA-256 value of each file, fixed owners, fixed modes and a fixed time from `SOURCE_DATE_EPOCH`. The source is plain JavaScript modules, so the build has no compile step.
- Contract tests: the built-in runner of Node.js, `node --test`. A contract file is JSON. A Python standard library script validates each contract against the schema in `catalog/schema/`.
- Accessibility checks: a small project script drives headless Chrome through the Chrome DevTools Protocol, with the WebSocket client of Node.js. It reads the accessibility tree, sends key events, and turns on forced colors and reduced motion through emulation. CI pins one Chrome version.
- Advantages: no development dependency and no lock file. Each line of tool code is in this project and has a review.
- Disadvantages: more project code to keep. The project writes its own accessibility rules and does not get the rule set of a mature checker.

### Option B: esbuild, Playwright and axe-core as development dependencies

- Build: esbuild as one pinned binary. It bundles and minifies, and its output is deterministic for one version.
- Tests: the Playwright test runner with its pinned browsers.
- Accessibility checks: axe-core in the page, through Playwright.
- Advantages: mature tools and a large accessibility rule set. Less project code.
- Disadvantages: a `package.json` and a lock file with many packages. Each update of the lock file is a level 1 change. The supply chain is larger. The package must not contain axe-core, so the tests must load it apart from the kit.

### Option C: Option A, plus axe-core for the accessibility checks only

- The build and the contract tests are the same as in Option A.
- The accessibility script of Option A loads one pinned copy of axe-core into the test page. The download has a SHA-256 check, and the file stays out of the checkout and out of the package.
- Advantages: one development dependency, with no transitive package. The project gets a mature rule set for names, roles and contrast.
- Disadvantages: one external tool to update. The project still writes the keyboard, forced colors and reduced motion checks, because axe-core does not cover them.

## Comparison

| Topic | A | B | C |
|---|---|---|---|
| Development dependencies | 0 | 3, plus transitive packages | 1 |
| Lock file | No | Yes | No |
| Byte-identical build | The project script controls it | esbuild controls it | The project script controls it |
| Accessibility rule set | Project rules only | axe-core | axe-core and project rules |
| Project tool code | Most | Least | Medium |

## Proposed choice

Option A for v0.1. Its tools are Python 3.14.6, Node.js 25.8.0 and one pinned version of Chrome. Each is a platform, so this record is the decision for each one.

The reasons:

- The kit is plain modules, so a bundler gives no needed result in v0.1.
- The build check is easy to show: run the build two times and compare the SHA-256 values.
- If the project rules miss defects, a later record can add axe-core as in Option C. That change does not touch the build.

## The build check

`make check` runs `tools/build.py --check` one time. That command builds the archive two times into two empty temporary directories, with the same `SOURCE_DATE_EPOCH`. Then it compares the bytes of the two archives. CI runs the same check on Linux. A later check can compare the archive of CI with the archive of a local build.

## Decision

2026-11-10: the owner accepted Option A in the session of this change. The platforms are Python 3.14.6, Node.js 25.8.0 and one pinned version of Chrome. The project has no development dependency.

The build also uses Git to list the tracked files. Each checkout already has Git, so the record does not pin a Git version. The local check used Chrome 157.0.8103.39. CI does not pin a Chrome version yet. A later change adds the pin.

The build reads only the files that Git tracks in `src/`, `catalog/` and `LICENSE`. Thus a local file that Git does not track never goes into the package.
