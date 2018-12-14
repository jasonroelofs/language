PATH  := dist/bin:node_modules/.bin:$(PATH)
SHELL := env PATH=$(PATH) /bin/bash

.PHONY: clean all

all: build test

build: compile rewrite-paths copy-lib fix-shebang

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

copy-lib:
	cp -r lib/ dist/lib

test: unit-tests specs

unit-tests:
	mocha dist/**/*_test.js

specs:
	spec/runner.sh

clean:
	rm -rf dist
