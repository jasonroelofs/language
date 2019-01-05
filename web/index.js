import VM from "vm/vm.js"

var vm = new VM()

var codeEl = document.getElementById("code")
var resultsEl = document.getElementById("results")

codeEl.addEventListener("input", (e) => {
  try {
    var results = vm.eval(codeEl.value, "[input]")

    resultsEl.innerHTML = results.toString()
  } catch(error) {
    console.log(error)
  }
})

