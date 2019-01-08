import VM from "vm/vm.js"
import { Null, SendMessage, ToObject, AddSlot } from "vm/object.js"
import { BuiltIn, BuiltInFunc } from "vm/core.js"

var vm = new VM()

var currentStdOut = ""

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

function getStringOf(obj) {
  let toString = SendMessage(obj, ToObject("toString"))
  return vm.evalBlockWithArgs(obj, toString)
}

codeEl.addEventListener("input", (e) => {
  try {
    var results = vm.eval(codeEl.value, "[input]")
    currentStdOut += getStringOf(results).data

    resultsEl.innerHTML = currentStdOut
    currentStdOut = ""
  } catch(error) {
    console.log(error)
  }
})

