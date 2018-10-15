import * as fs from "fs"
import Interpreter from "@vm/interpreter"

let file = process.argv[process.argv.length - 1]

let script = fs.readFileSync(file);

let interp = new Interpreter()
let result = interp.eval(script.toString())

console.log(result)
