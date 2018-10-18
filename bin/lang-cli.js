import VM from "@vm/vm"

let file = process.argv[process.argv.length - 1]

let vm = new VM()
vm.loadFile(file)
