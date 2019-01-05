import Platform from "@vm/platform"

import { IObject } from "@vm/object"
import { World } from "@vm/core"

import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import Interpreter from "@vm/interpreter"

import * as errors from "@vm/errors"
import { SystemError, ErrorReport } from "@vm/error_report"

export default class VM {

  interpreter: Interpreter

  // The list of command line arguments that do not include
  // the paths of scripts being run.
  argv: string[]

  // Keep track of the files we load and their sources
  // Keyed on file path which is always the full path
  // to the file in question.
  loadedFiles: Map<string, string>

  constructor(argv = []) {
    this.loadedFiles = new Map<string, string>()

    this.interpreter = new Interpreter(this)

    this.loadCoreLib()

    // Eventually want this to be a package system
    // and explicit imports but that's for a future time
    this.loadStdLib()

    this.interpreter.ready(argv)
  }

  loadCoreLib() {
    Platform.findCoreLibs((filePath, content) => {
      this.eval(content, filePath)
    })
  }

  loadStdLib() {
    Platform.findStdLibs((filePath, content) => {
      this.eval(content, filePath)
    })
  }

  loadFile(filePath: string): IObject {
    let script = Platform.readFile(filePath)
    // console.log("Loading file %o", filePath)
    return this.eval(script.toString(), filePath)
  }

  eval(program: string, filePath: string = null): IObject {

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

    return this.interpreter.evalFile(expressions)
  }

  evalBlockWithArgs(receiver, block, args = []) {
    return this.interpreter.evalBlockWithArgs(receiver, block, args)
  }
}
