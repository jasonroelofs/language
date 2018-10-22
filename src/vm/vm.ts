import * as fs from "fs"
import * as glob from "fast-glob"
import * as path from "path"

import { IObject, NewObject } from "@vm/object"
import { World } from "@vm/core"
import Interpreter from "@vm/interpreter"

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
  }

  loadFile(filePath: string) {
    let script = fs.readFileSync(filePath)
    this.interpreter.eval(script.toString())
  }

  eval(script: string) {
    return this.interpreter.eval(script)
  }
}