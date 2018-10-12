import "mocha"
import * as assert from "assert"
import {toObject} from "@vm/object"
import Interpreter from "@vm/interpreter"

describe("Number", () => {
  it("exposes basic arithmetic operations", () => {
    let tests = {
      "1 + 1": toObject(2),
      "1 - 1": toObject(0),
      "1 * 3": toObject(3),
      "10 / 2": toObject(5),
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })
})

describe("String", () => {
})

function assertExpression(input, expected) {
  let i = new Interpreter()
  let result = i.eval(input)

  assert.equal(result.data, expected.data, `Eval failed for ${input}`)
}
