import VM from "@vm/vm"

let [_self, _cli, ...files] = process.argv

let vm = new VM()

try {
  for(let file of files) {
    vm.loadFile(file)
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
