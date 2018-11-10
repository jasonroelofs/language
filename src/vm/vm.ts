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

  constructor() {
    this.interpreter = new Interpreter(World)

    this.loadCoreLib()
  }

  loadCoreLib() {
    let coreDir = path.resolve(__dirname + "/../../lib/core");
    let entries = glob.sync([`${coreDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      this.loadFile(path)
    })

    this.interpreter.ready()
  }

  loadFile(filePath: string) {
    let script = fs.readFileSync(filePath)
    //console.log("Loading file %o", filePath)
    this.eval(script.toString(), filePath)
  }

  eval(program: string, filePath: string = null): IObject {
    let l = new Lexer(program)
    var {tokens, errors} = l.tokenize()

    if(errors.length > 0) {
      this.reportError(program, filePath, errors[0])
      return
    }

    let p = new Parser(tokens)
    var {expressions, errors} = p.parse()

    if(errors.length > 0) {
      this.reportError(program, filePath, errors[0])
      return
    }

    try {
      return this.interpreter.eval(expressions)
    } catch(error) {
      this.reportError(program, filePath, error)
      throw error
    }
  }

  reportError(program: string, filePath: string, error: SystemError) {
    let cleanFilePath = ""

    if(filePath) {
      cleanFilePath = path.relative(process.cwd(), filePath)
    } else {
      cleanFilePath = "[script]"
    }

    let report = new ErrorReport(error, program, cleanFilePath)
    console.log(report.buildReport())
  }
}
