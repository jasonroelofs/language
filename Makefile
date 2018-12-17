PATH  := dist/bin:node_modules/.bin:$(PATH)
SHELL := env PATH=$(PATH) /bin/bash

.PHONY: clean all

all: build test

build: compile rewrite-paths link-lib fix-shebang

compile:
	tsc

rewrite-paths:
	ef-tspm --silent

# Due to the interaction of tsc and tspm, we don't get a nice clean
# shebang line automatically, so we need to fix it in post
# We also use this time to drop the .js extension from lang-cli, as that's
# just annoying.
fix-shebang:
	@echo "Fixing shebang"
	@echo "#!/usr/bin/env node" > .cli.tmp
	@cat dist/bin/lang-cli.js >> .cli.tmp
	@mv .cli.tmp dist/bin/lang-cli.js
	@chmod a+x dist/bin/lang-cli.js

# Our core and standard libraries are written in the language and need to be
# installed into the build area, but we don't want to have to constantly copy
# files around as these files are being worked on. Instead, lets symlink it!
link-lib:
	@rm -f dist/lib
	@ln -sf `pwd`/lib dist/lib

test: unit-tests specs

unit-tests:
	@echo "Running VM test suite"
	@mocha dist/**/*_test.js

specs:
	@echo "Running language spec suite"
	@lang-task test

clean:
	rm -rf dist
