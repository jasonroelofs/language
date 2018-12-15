#!/bin/bash

# Requires `lang-cli` to be made available through `npm link`

find spec/ -type f -name "*.lang" -exec lang-cli {} \;
