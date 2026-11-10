# Run the checks that AGENTS.md names.
PYTHON ?= python3

.PHONY: check
check:
	$(PYTHON) -B tools/check_project.py
	$(PYTHON) -B -m unittest discover -s tests
	$(PYTHON) -B tools/build.py --check
