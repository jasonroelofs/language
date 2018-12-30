import * as fs from "fs"
import * as glob from "fast-glob"
import * as path from "path"
import * as util from "util"

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
    this.argv = argv

    this.interpreter = new Interpreter(this)

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
  }

  loadStdLib() {
    let stdlibDir = path.resolve(__dirname + "/../../lib/stdlib");
    let entries = glob.sync([`${stdlibDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      this.loadFile(path)
    })

    this.interpreter.ready(this.argv)
  }

  loadFile(filePath: string): IObject {
    let script = fs.readFileSync(filePath)
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

    // console.log(util.inspect(expressions, {depth: null}))

    return this.interpreter.evalFile(expressions)
  }

  evalBlockWithArgs(receiver, block, args = []) {
    return this.interpreter.evalBlockWithArgs(receiver, block, args)
  }
}
