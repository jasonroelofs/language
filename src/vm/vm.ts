import * as fs from "fs"
import * as glob from "fast-glob"
import * as path from "path"

import { IObject, NewObject } from "@vm/object"
import { World } from "@vm/core"

import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import Interpreter from "@vm/interpreter"

import { SyntaxError } from "@compiler/errors"
import ErrorReport from "@vm/error_report"

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
    this.eval(script.toString(), filePath)
  }

  eval(program: string, filePath: string = null): IObject {
    let l = new Lexer(program)
    var {tokens, errors} = l.tokenize()

    if(errors.length > 0) {
      this.reportErrors(program, filePath, errors)
      return
    }

    let p = new Parser(tokens)
    var {expressions, errors} = p.parse()

    if(errors.length > 0) {
      this.reportErrors(program, filePath, errors)
      return
    }

    return this.interpreter.eval(expressions)
  }

  reportErrors(program: string, filePath: string, errors: SyntaxError[]) {
    let cleanFilePath = ""

    if(filePath) {
      cleanFilePath = path.relative(process.cwd(), filePath)
    } else {
      cleanFilePath = "[script]"
    }

    errors.forEach((error) => {
      let report = new ErrorReport(error, program, cleanFilePath)
      console.log(report.buildReport())
    })
  }
}
