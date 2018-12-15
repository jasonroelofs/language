import * as fs from "fs"

import VM from "@vm/vm"

let [_self, _cli, toRun, ...rest] = process.argv

if(toRun) {
  try {
    fs.accessSync(toRun, fs.constants.R_OK)
  } catch(e) {
    console.error("Cannot find or read file at '%s'", toRun)
    process.exit(1)
  }
}

let vm = new VM(rest)

try {
  if(toRun) {
    vm.loadFile(toRun)
  }
} catch(error) {
  // The VM reports any errors and re-throws them for now
  // Catch and throw away so we don't get weird stack traces
  // Need to figure out a better pattern for where and when
  // to report on errors.
  if('chunk' in error) {
    // Do nothing
  } else {
    // This is an unknown error type, throw it for debugging
    throw error
  }
}
