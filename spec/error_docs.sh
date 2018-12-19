#!/bin/bash

# Requires `lang-cli` to be made available through `npm link`
# TODO: Rebuild this as a task in lang-task.

find spec/errors -type f -name "*.lang" -exec lang-cli {} \; -print
