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

  it("evaluates strings", () => {
    let tests = [
      { input: `"A String"`, result: "A String", type: ObjectType.String },
      { input: `'Single Quotes'`, result: "Single Quotes", type: ObjectType.String },
      { input: `"Nested\\"Quotes"`, result: `Nested\\"Quotes`, type: ObjectType.String },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })

  it("evaulates local assignment and lookup", () => {
    let tests = [
      // Assignment returns the value assigned
      { input: "a = 1", result: 1, type: ObjectType.Number },
      // Accessing the local slot returns the stored value
      { input: "a = 2\na", result: 2, type: ObjectType.Number },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })

  /*
  it("evaluates known math operators", () => {
    let tests = [
      // Direct usage
      { input: "1 + 2", result: 3, type: ObjectType.Number },
      { input: "1 - 2", result: -2, type: ObjectType.Number },
      { input: "1 * 2", result: 2, type: ObjectType.Number },
      { input: "2 / 1", result: 1, type: ObjectType.Number },

      // Operation Precedence
      { input: "1 + 2 * 3", result: 7, type: ObjectType.Number },
      { input: "2 / 1 + 4", result: 5, type: ObjectType.Number },
      { input: "1 * 2 + 3 - 4 / 2", result: 2, type: ObjectType.Number },

      // Variable eval
      { input: "a = 1\na + 1", result: 3, type: ObjectType.Number },
      { input: "b = 2\n1 + b", result: 3, type: ObjectType.Number },
      { input: "a = 1\nb = 2\na + b", result: 3, type: ObjectType.Number },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })

  it("evaluates comparison operators", () => {
    let tests = [
      { input: "1 > 2",  result: false, type: ObjectType.Boolean },
      { input: "1 >= 1", result: true, type: ObjectType.Boolean },
      { input: "1 >= 2", result: false, type: ObjectType.Boolean },
      { input: "1 < 2",  result: true, type: ObjectType.Boolean },
      { input: "1 <= 2", result: true, type: ObjectType.Boolean },
      { input: "1 <= 1", result: true, type: ObjectType.Boolean },
      { input: "3 == 3", result: true, type: ObjectType.Boolean },
      { input: "3 == 4", result: false, type: ObjectType.Boolean },
      { input: "3 != 4", result: true, type: ObjectType.Boolean },
      { input: "3 != 3", result: false, type: ObjectType.Boolean },
    ]

    for(var test of tests) {
      assertEval(test)
    }
  })
  */
})

function assertEval(test) {
  let i = new Interpreter()
  let result = i.eval(test.input)

  assert.equal(result.type, test.type)
  assert.equal(result.value, test.result)
}
