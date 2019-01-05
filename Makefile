PATH  := dist/bin:node_modules/.bin:$(PATH)
SHELL := env PATH=$(PATH) /bin/bash

.PHONY: clean all ci

all: build test

web: build package-web webpack

# Provide a slightly different task for CI to make sure
# that `npm link` is called. This call takes a noticable
# amount of time so its not something we want to always execute
ci: setup build web test

build: compile rewrite-paths link-lib fix-shebang

compile:
	tsc

rewrite-paths:
	ef-tspm --silent

# Our core and standard libraries are written in the language and need to be
# installed into the build area, but we don't want to have to constantly copy
# files around as these files are being worked on. Instead, lets symlink it!
link-lib:
	@rm -f dist/lib
	@ln -sf `pwd`/lib dist/lib

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

# Trigger the script to take all of the core and stdlib files and
# package them into a single js file under web/
# I know webpack should be able to do this but I wasn't able to find something
# that would do it easily. Will update when I find something or I break down and
# build my own loader
package-web:
	@cd web && node package-web.js

# Trigger webpack to create the final files for web-run of the language VM
webpack:
	@cd web && npx webpack

setup:
	@npm upgrade
	@npm link

test: unit-tests specs

unit-tests:
	@echo "Running VM test suite"
	@mocha dist/**/*_test.js

specs:
	@echo "Running language spec suite"
	@lang-task test

clean:
	rm -rf dist
