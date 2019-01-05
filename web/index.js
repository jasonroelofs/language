import VM from "vm/vm.js"
import { SendMessage, ToObject } from "vm/object.js"

var vm = new VM()

var codeEl = document.getElementById("code")
var resultsEl = document.getElementById("results")

function getStringOf(obj) {
  let toString = SendMessage(obj, ToObject("toString"))
  return vm.evalBlockWithArgs(obj, toString)
}

codeEl.addEventListener("input", (e) => {
  try {
    var results = vm.eval(codeEl.value, "[input]")

    resultsEl.innerHTML = getStringOf(results).data
  } catch(error) {
    console.log(error)
  }
})

