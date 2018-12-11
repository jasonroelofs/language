#!/bin/bash

# Go through the various files in this directory and run them,
# ensuring correct output.
# Eventually plan on rewriting this all in the language itself.

NODE="node"
HERE=$(dirname $0)
CLI="$HERE/../dist/bin/lang-cli.js"
FILES=$(find $HERE -type f -name "*.lang")

$NODE $CLI $FILES
