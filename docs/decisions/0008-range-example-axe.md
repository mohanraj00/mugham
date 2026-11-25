# 0008: axe-core check for the range example

Issue #123 asks for an axe-core check of the range field example. The browser check keeps the project accessibility rules of [decision 0006](0006-axe-core.md) in each run.

The browser check can also run axe-core 4.10.3 on the range example. Give the path to a verified local copy of the release file `axe.min.js` in `MUGHAM_AXE_PATH` and its SHA-256 from that copy in `MUGHAM_AXE_SHA256`. Keep the file outside the checkout. Run `node tools/browser_check.mjs`. The report gives the rule and targets for each violation. A violation fails the check. If the file path is absent, the report shows that it skipped axe-core.

The check does not download the file. The kit and the examples have no access to the file.
