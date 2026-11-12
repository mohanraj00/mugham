# Run the checks that AGENTS.md names.
PYTHON ?= python3
NODE ?= node

.PHONY: check screenshots
check:
	$(PYTHON) -B tools/check_project.py
	$(PYTHON) -B -m unittest discover -s tests
	$(PYTHON) -B tools/build.py --check
	$(PYTHON) -B tools/catalog.py
	$(PYTHON) -B tools/tokens.py
	$(PYTHON) -B tests/vectors/envelope/generate.py
	$(NODE) --test 'tests/**/*.test.mjs'
	$(NODE) tools/browser_check.mjs

# Write the README screenshots to docs/screenshots/ again.
screenshots:
	$(NODE) tools/screenshots.mjs
