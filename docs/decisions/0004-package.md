# 0004: The package choice

Status: proposed, 2026-11-12. Issue: mohanraj00/mugham#36.

## Context

A new user needs a simple way to get the kit. The kit is plain JavaScript modules, JSON contracts and CSS. It has no compile step and no runtime dependency. The constitution says that a build gives the same bytes each time, and that a package publication needs a separate owner approval. Decision 0001 owns the dependency rule and the build.

## Options

### Option A: a release archive only

- The release workflow attaches `mugham.tar` and its SHA-256 file to a GitHub release. The workflow runs `tools/build.py`, the build of decision 0001.
- A user unpacks the archive and serves the files, or copies `src/` and `catalog/` into an application.
- Advantages: no new tool, no `package.json`, no registry account. The archive is the same file that the byte check tests.
- Disadvantages: a user cannot run `npm install`. A user updates the kit by hand.

### Option B: an npm package now

- The package holds the same files as the archive, with a `package.json`.
- Advantages: it is the usual way to get a web library.
- Disadvantages: `package.json` is a level 1 path. A publication needs npm tooling and a registry token, and a publish step in CI. That tooling needs its own decision record under decision 0001. The release gets a second form that the byte check does not cover.

### Option C: an npm package later

- v0.2 ships Option A. The owner decides on a package when the envelope and the catalog format are stable, near v1.0.

## Decision

Option C. v0.2 ships the release archive only. The release workflow publishes no package, and it has no registry permission or token.

Reasons:

- The element API, the events and format 1 are experimental. Format 1 changes in v0.2 (mohanraj00/mugham#35). A package would make users expect a stable version.
- The archive needs no tool that decision 0001 does not already cover.

## Effect on the dependency rule

- Option A changes nothing in the rule. The archive holds only the tracked files of `LICENSE`, `catalog/` and `src/`, and a manifest. It holds no third-party code.
- A later npm package must keep the same content as the archive. The package manifest must have no `dependencies` and no `peerDependencies`. A user of the kit then still gets no third-party runtime dependency.
- The publish tool, for example the npm client, is a tool that only builds or publishes the kit. It needs a decision record with one exact version and the checksum of its download, as decision 0001 says. Its code never goes into the package.
- A package publication needs a separate owner approval, as the constitution says. This record is not that approval.
