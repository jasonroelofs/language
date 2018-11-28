#!/bin/bash

# Go through the various files in this directory and run them,
# ensuring correct output.
# Eventually plan on rewriting this all in the language itself.

NODE="node"
HERE=$(dirname $0)
CLI="$HERE/../dist/bin/lang-cli.js"

run() {
  file=$1

  $NODE $CLI $file
}

files=$(find $HERE -type f -name "*.lang")

for spec in $files; do
  echo $spec
  run $spec
  echo
done
