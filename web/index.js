import VM from "vm/vm.js"
import { Null, SendMessage, ToObject, AddSlot } from "vm/object.js"
import { BuiltIn, BuiltInFunc } from "vm/core.js"

var vm = new VM()

var currentStdOut = ""

/**
 * Some nice code snippets we can provide to users
 */
var runTestSuite = `
testRunner = Runner.new(
  suites: Test.suites,
  reporter: Reporter.new()
)

testRunner.run()
`

/**
 * Intercept stdout via IO.puts or IO.print to put those strings
 * into our results field instead
 */
AddSlot(BuiltIn, ToObject("puts"), BuiltInFunc(function(args) {
  currentStdOut += args["message"].data + "<br>"
  return Null
}))

AddSlot(BuiltIn, ToObject("print"), BuiltInFunc(function(args) {
  currentStdOut += args["message"].data
  return Null
}))

var codeEl = document.getElementById("code")
var resultsEl = document.getElementById("results")
var specsButton = document.getElementById("run-specs")

function getStringOf(obj) {
  let toString = SendMessage(obj, ToObject("toString"))
  return vm.evalBlockWithArgs(obj, toString)
}

specsButton.addEventListener("click", () => {
  var specFiles = window.FakeFS.all("spec")

  specFiles.forEach((content, path) => {
    // Ignore all non-language files and skip everything under
    // spec/errors, as those are small language snippets explicitly built
    // to excersize individual errors.
    // Also, fixtures are intended to be loaded on an As Needed basis
    if(path.endsWith(".lang") &&
      !path.startsWith("spec/errors") &&
      !path.startsWith("spec/fixtures")) {
      console.log("Loading spec file %s", path)
      vm.eval(content, path)
    } else {
      console.log("Skipping %s", path)
    }
  })

  codeEl.value = runTestSuite
})

codeEl.addEventListener("input", () => {
  try {
    var results = vm.eval(codeEl.value, "[input]")
    currentStdOut += getStringOf(results).data

    resultsEl.innerHTML = currentStdOut
    currentStdOut = ""
  } catch(error) {
    console.log(error)
    console.log("\t at %s:%s", error.file, error.line)
  }
})

