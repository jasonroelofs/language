import VM from "@vm/vm"
import {
  SyntaxError,
  UnterminatedStringError,
  ExpectedEndOfExpressionError,
  UnmatchedClosingTagError,
  IncompleteExpressionError,
} from "@compiler/errors"
import { ErrorReport } from "@vm/error_report"

import * as readline from "readline"

export default class REPL {
  vm: VM
  line: number

  rl = null

  // For multi-line entries, keep a buffer
  // of the previous entries and keep filling this
  // buffer until its parsing passes.
  inputBuffer: string

  constructor(vm: VM) {
    this.vm = vm
    this.line = 0
    this.inputBuffer = ""

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  run() {
    this.tickPrompt()

    this.rl.on("line", (line) => {
      switch(line.trimEnd()) {
        case "quit":
        case "exit":
          this.rl.close();
          break;
        default:
          this.evalLine(line)
      }

      this.tickPrompt()
    })

    // If the user is in the middle of a multi-line input and they hit
    // ctrl-C, we want to cancel the multi-line input, not the whole REPL
    this.rl.on("SIGINT", () => {
      if(this.inputBuffer.length > 0) {
        this.inputBuffer = ""
        this.tickPrompt()
      } else {
        this.rl.pause()
      }
    })

    this.rl.on("close", () => {
      process.exit(0)
    })
  }

  tickPrompt() {
    let more = this.inputBuffer.length == 0 ? " " : "? "

    this.line += 1
    this.rl.setPrompt(`${this.line}${more}> `)
    this.rl.prompt()
  }

  evalLine(line: string) {
    this.inputBuffer += line + "\n"

    try {
      // TODO: Maybe some VM way to SendMessage and call the resulting
      // block that returns in one fell swoop? For now wrap the incoming
      // code in a contextual grouping and call toString on it so we
      // always have something legit to output
      let result = this.vm.eval(`(${this.inputBuffer.trim()}).toString()`)
      console.log(" => %s", result)
    } catch(error) {
      if(this.expectingMoreInput(error)) {
        return
      }

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

    this.inputBuffer = ""
  }

  expectingMoreInput(error): boolean {
    return (
      (error instanceof UnterminatedStringError) ||
      (error instanceof ExpectedEndOfExpressionError) ||
      (error instanceof UnmatchedClosingTagError) ||
      (error instanceof IncompleteExpressionError)
    )
  }
}
