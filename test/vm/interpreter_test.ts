import "mocha"
import * as assert from "assert"
import Interpreter from "@vm/interpreter"
import { IObject, NewObject, Number, String, True, False, Null } from "@vm/object"

describe("Interpreter", () => {
  it("evaluates numbers", () => {
    let tests = {
      "1": NewObject(Number, {}, 1),
      "2": NewObject(Number, {}, 2),
      "3.0": NewObject(Number, {}, 3.0),
      "4.4": NewObject(Number, {}, 4.4),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaluates specials", () => {
    let tests = {
      "true": True,
      "false": False,
      "null": Null,
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaluates strings", () => {
    let tests = {
      [`"A String"`]: NewObject(String, {}, "A String"),
      [`'Single Quotes'`]: NewObject(String, {}, "Single Quotes"),
      [`"Nested\\"Quotes"`]: NewObject(String, {}, `Nested\\"Quotes`),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaulates local assignment and lookup", () => {
    let tests = {
      // Assignment returns the value assigned
      "a = 1":  NewObject(Number, {}, 1),
      // Accessing the local slot returns the stored value
      "a = 2\na": NewObject(Number, {}, 2),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
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
      assertObjectEval(test)
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
      assertObjectEval(test)
    }
  })
  */

  it("builds block objects", () => {
    let tests = {
      "{ 1 }": { bodyLength: 1, paramLength: 0 },
      "{ 1\n2 }": { bodyLength: 2, paramLength: 0 },
      "{ |a| a }": { bodyLength: 1, paramLength: 1 },
      "{ |a, b| a + b }": { bodyLength: 1, paramLength: 2 },
    }

    for(var test in tests) {
      let i = new Interpreter()
      let result = i.eval(test)
      let expected = tests[test]

      assert.equal(result.slots["body"].length, expected.bodyLength)
      assert.equal(result.slots["parameters"].length, expected.paramLength)
    }
  })
})

function assertObjectEval(input: string, expected: IObject) {
  let i = new Interpreter()
  let result = i.eval(input)

  assert.equal(result.parents.length, expected.parents.length)
  assert.equal(result.parents[0], expected.parents[0])
  assert.equal(result.data, expected.data)
}
