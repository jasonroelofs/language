import VM from "@vm/vm"
import { SyntaxError } from "@compiler/errors"
import { ErrorReport } from "@vm/error_report"

import * as readline from "readline"

export default class REPL {
  vm: VM
  line: number

  rl = null

  constructor(vm: VM) {
    this.vm = vm
    this.line = 0

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  run() {
    this.tickPrompt()

    this.rl.on("line", (line) => {
      switch(line.trim()) {
        case "quit":
        case "exit":
          this.rl.close();
          break;
        default:
          this.evalLine(line)
      }

      this.tickPrompt()
    })

    this.rl.on("close", () => {
      process.exit(0)
    })
  }

  tickPrompt() {
    this.line += 1
    this.rl.setPrompt(`${this.line} > `)
    this.rl.prompt()
  }

  evalLine(line: string) {
    try {
      // TODO: Maybe some VM way to SendMessage and call the resulting
      // block that returns in one fell swoop? For now wrap the incoming
      // code in a contextual grouping and call toString on it so we
      // always have something legit to output
      let result = this.vm.eval(`(${line}).toString()`)
      console.log("%s", result)
    } catch(error) {
      let report = null

      if(error.data) {
        report = new ErrorReport(error.data, this.vm.loadedFiles)
      } else if (error instanceof SyntaxError) {
        report = new ErrorReport(error, this.vm.loadedFiles)
      } else {
        console.log(error.message)
      }

      if(report) {
        console.log(report.buildReport())
      }
    }
  }
}
