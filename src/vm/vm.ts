import * as fs from "fs"
import * as glob from "fast-glob"
import * as path from "path"

import { IObject, NewObject } from "@vm/object"
import { World } from "@vm/core"
import Interpreter from "@vm/interpreter"
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

  eval(script: string, filePath: string = null) {
    try {
      return this.interpreter.eval(script)
    } catch(errors) {
      let cleanFilePath = path.relative(process.cwd(), filePath)

      errors.forEach((error) => {
        let report = new ErrorReport(error)
        console.log(report.reportOn(script, cleanFilePath))
      })
    }
  }
}
