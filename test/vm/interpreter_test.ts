import "mocha"
import * as assert from "assert"
import Interpreter from "@vm/interpreter"
import { Object, ObjectType } from "@vm/object"

describe("Interpreter", () => {
  it("evaluates numbers", () => {
    let tests = [
      { input: "1", result: 1, type: ObjectType.Number },
      { input: "2", result: 2, type: ObjectType.Number },
      { input: "3.0", result: 3, type: ObjectType.Number },
      { input: "4.4", result: 4.4, type: ObjectType.Number },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })

  it("evaluates specials", () => {
    let tests = [
      { input: "true", result: true, type: ObjectType.Boolean },
      { input: "false", result: false, type: ObjectType.Boolean },
      { input: "null", result: null, type: ObjectType.Null },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })
})

function assertEval(test) {
  let i = new Interpreter()
  let result = i.eval(test.input)

  assert.equal(result.type, test.type)
  assert.equal(result.value, test.result)
}
