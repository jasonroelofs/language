import VM from "vm/vm.js"
import { Null, SendMessage, ToObject, SetSlot } from "vm/object.js"
import { BuiltIn, BuiltInFunc } from "vm/core.js"

var vm = new VM()

async function startVM() {
  await vm.ready()
  vmReady()
}

function vmReady() {
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
  SetSlot(BuiltIn, ToObject("puts"), BuiltInFunc(function(space) {
    currentStdOut += SendMessage(space, ToObject("message")).data + "<br>"
    return Null
  }))

  SetSlot(BuiltIn, ToObject("print"), BuiltInFunc(function(space) {
    currentStdOut += SendMessage(space, ToObject("message")).data
    return Null
  }))

  var codeEl = document.getElementById("code")
  var resultsEl = document.getElementById("results")
  var specsButton = document.getElementById("run-specs")

  async function getStringOf(obj) {
    return vm.call(obj, "toString")
  }

  specsButton.addEventListener("click", async () => {
    var specFiles = window.FakeFS.all("spec")

    for(var path of specFiles.keys()) {
      let content = specFiles.get(path)

      // Ignore all non-language files and skip everything under
      // spec/errors, as those are small language snippets explicitly built
      // to excersize individual errors.
      // Also, fixtures are intended to be loaded on an As Needed basis
      if(path.endsWith(".lang") &&
        !path.startsWith("spec/errors") &&
        !path.startsWith("spec/fixtures")) {
        console.log("Loading spec file %s", path)
        await vm.eval(content, path)
      } else {
        console.log("Skipping %s", path)
      }
    }

    codeEl.value = runTestSuite
  })

  codeEl.addEventListener("input", async () => {
    try {
      var results = await vm.eval(codeEl.value, "[input]")
      let stringObj = await getStringOf(results)
      currentStdOut += stringObj.data

      resultsEl.innerHTML = currentStdOut
      currentStdOut = ""
    } catch(error) {
      console.log(error)
      console.log("\t at %s:%s", error.file, error.line)
    }
  })
}

startVM()
