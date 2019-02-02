import Platform from "@vm/platform"

import { IObject } from "@vm/object"
import { World } from "@vm/core"

import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import WebSafeInterpreter from "@vm/web_safe_interpreter"

import * as errors from "@vm/errors"
import { SystemError, ErrorReport } from "@vm/error_report"

export default class VM {

  interpreter: WebSafeInterpreter

  // The list of command line arguments that do not include
  // the paths of scripts being run.
  argv: string[]

  // Keep track of the files we load and their sources
  // Keyed on file path which is always the full path
  // to the file in question.
  loadedFiles: Map<string, string>

  constructor() {
    this.loadedFiles = new Map<string, string>()

    this.interpreter = new WebSafeInterpreter(this)
  }

  async ready(argv = []) {
    let coreLibs = this.findCoreLibs()
    let stdLibs = this.findStdLibs()

    return this.loadFiles(coreLibs).
      then(() => this.loadFiles(stdLibs)).
      then(() => this.interpreter.ready(argv))
  }

  findCoreLibs() {
    let coreLibs = []

    Platform.findCoreLibs((filePath, content) => {
      coreLibs.push([content, filePath])
    })

    return coreLibs
  }

  findStdLibs() {
    let stdLibs = []

    Platform.findStdLibs((filePath, content) => {
      stdLibs.push([content, filePath])
    })

    return stdLibs
  }

  async loadFiles(files) {
    for(var file of files) {
      //console.log("Evaluating %o", file[1])
      await this.eval(file[0], file[1])
    }
  }

  async eval(program: string, filePath: string = null): Promise<IObject> {

    // This can happen through integrations or a REPL,
    // make sure there's something we can link back to for raw source input.
    if(!filePath) {
      filePath = "[script]"
    }

    this.loadedFiles.set(filePath, program)

    let l = new Lexer(program, {filePath: filePath})
    var tokens = l.tokenize()

    let p = new Parser(tokens)
    var expressions = p.parse()

    return this.interpreter.eval(expressions).promise
  }

  /*
  evalBlockWithArgs(receiver, block, args = []) {
    return this.interpreter.evalBlockWithArgs(receiver, block, args)
  }
  */
}
