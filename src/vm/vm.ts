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

  constructor() {
    this.loadedFiles = new Map<string, string>()

    this.interpreter = new Interpreter(this)
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

  async loadFile(filePath) {
    let script = Platform.readFile(filePath)
    return this.eval(script.toString(), filePath)
  }

  async loadFiles(files) {
    for(var file of files) {
      //console.log("Evaluating %o", file[1])
      await this.eval(file[0], file[1])
    }
  }

  async call(obj: IObject, message: string, args = {}): Promise<IObject> {
    return this.interpreter.call(obj, message, args)
  }

  async eval(program: string, filePath: string = null): Promise<IObject> {
    let expressions = this.lexAndParse(program, filePath)

    return this.interpreter.eval(expressions).promise
  }

  lexAndParse(program: string, filePath: string) {
    // This can happen through integrations or a REPL,
    // make sure there's something we can link back to for raw source input.
    if(!filePath) {
      filePath = "[script]"
    }

    this.loadedFiles.set(filePath, program)

    let l = new Lexer(program, {filePath: filePath})
    var tokens = l.tokenize()

    let p = new Parser(tokens)
    return p.parse()
  }
}
