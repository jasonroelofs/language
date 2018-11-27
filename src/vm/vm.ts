import * as fs from "fs"
import * as glob from "fast-glob"
import * as path from "path"
import * as util from "util"

import { IObject, NewObject } from "@vm/object"
import { World } from "@vm/core"

import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import Interpreter from "@vm/interpreter"

import * as errors from "@vm/errors"
import { SystemError, ErrorReport } from "@vm/error_report"

export default class VM {

  interpreter: Interpreter

  // Keep track of the files we load and their sources
  // Keyed on file path which is always the full path
  // to the file in question.
  loadedFiles: Map<string, string>

  constructor() {
    this.loadedFiles = new Map<string, string>()

    this.interpreter = new Interpreter(World)

    this.loadCoreLib()

    // Eventually want this to be a package system
    // and explicit imports but that's for a future time
    this.loadStdLib()
  }

  loadCoreLib() {
    let coreDir = path.resolve(__dirname + "/../../lib/core");
    let entries = glob.sync([`${coreDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      this.loadFile(path)
    })

    this.interpreter.ready()
  }

  loadStdLib() {
    let stdlibDir = path.resolve(__dirname + "/../../lib/stdlib");
    let entries = glob.sync([`${stdlibDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      this.loadFile(path)
    })
  }

  loadFile(filePath: string) {
    let script = fs.readFileSync(filePath)
    // console.log("Loading file %o", filePath)
    this.eval(script.toString(), filePath)
  }

  eval(program: string, filePath: string = null): IObject {

    // This can happen through integrations or a REPL,
    // make sure there's something we can link back to for raw source input.
    if(!filePath) {
      filePath = "[script]"
    }

    this.loadedFiles.set(filePath, program)

    let l = new Lexer(program, {filePath: filePath})
    var {tokens, errors} = l.tokenize()

    if(errors.length > 0) {
      this.reportError(errors[0])
      return
    }

    let p = new Parser(tokens)
    var {expressions, errors} = p.parse()

    if(errors.length > 0) {
      this.reportError(errors[0])
      return
    }

    // console.log(util.inspect(expressions, {depth: null}))

    try {
      return this.interpreter.eval(expressions)
    } catch(error) {
      // Are we one of the SystemError type or something else?
      if('chunk' in error) {
        this.reportError(error)
      }

      throw error
    }
  }

  reportError(error: SystemError) {
    let report = new ErrorReport(error, this.loadedFiles)
    console.log(report.buildReport())
  }
}
