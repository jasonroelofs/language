import "mocha"
import * as assert from "assert"
import Interpreter from "@vm/interpreter"
import { IObject, toObject, True, False, Null } from "@vm/object"

describe("Interpreter", () => {
  it("evaluates numbers", () => {
    let tests = {
      "1": toObject(1),
      "2": toObject(2),
      "3.0": toObject(3.0),
      "4.4": toObject(4.4),
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
      [`"A String"`]: toObject("A String"),
      [`'Single Quotes'`]: toObject("Single Quotes"),
      [`"Nested\\"Quotes"`]: toObject(`Nested\\"Quotes`),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaulates local assignment and lookup", () => {
    let tests = {
      // Assignment returns the value assigned
      "a = 1": toObject(1),
      // Accessing the local slot returns the stored value
      "a = 2\na": toObject(2),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaluates known math operators", () => {
    let tests = {
      // Direct usage
      "1 + 2": toObject(3),
      "1 - 2": toObject(-1),
      "1 * 2": toObject(2),
      "2 / 1": toObject(2),

      // Operation Precedence
      "1 + 2 * 3": toObject(7),
      "2 / 1 + 4": toObject(6),
      "1 * 2 + 3 - 4 / 2": toObject(3),

      // Variable eval
      "a = 1\na + 1": toObject(2),
      "b = 2\n1 + b": toObject(3),
      "a = 1\nb = 2\na + b": toObject(3),
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

  it("evaluates comparison operators", () => {
    let tests = {
      "1 > 2":  False,
      "1 >= 1": True,
      "1 >= 2": False,
      "1 < 2":  True,
      "1 <= 2": True,
      "1 <= 1": True,
      "3 == 3": True,
      "3 == 4": False,
      "3 != 4": True,
      "3 != 3": False,
    }

    for(var test in tests) {
      assertObjectEval(test, tests[test])
    }
  })

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

      assert.equal(result.slots.get("body").data.length, expected.bodyLength)
      assert.equal(result.slots.get("parameters").data.length, expected.paramLength)
    }
  })

  it("evaluates blocks", () => {
    let tests = {
      "a = { 1 }; a.call()": toObject(1),

      // Single arguments
      "a = { |x| x }; a.call(1)": toObject(1),

      // Single arguments can be given keyword args
      "a = { |x| x }; a.call(x: 10)": toObject(10),

      // Keyword multi-arguments
      "a = { |a, b| a + b }; a.call(a: 1, b: 2)": toObject(3),

      // Keyword arguments out-of-order
      "a = { |a, b| a / b }; a.call(b: 2, a: 4)": toObject(2),

      // Single argument but with default
      "a = { |a: 3| a }; a.call() + a.call(5)": toObject(8),

      // Keyword arguments with default
      "a = { |x: 1, y: 2| x * y }; a.call() + a.call(x: 2, y: 3)": toObject(8),

      // Default arguments and one required argument
      "a = { |x, y: 2| x * y }; a.call(5) + a.call(x: 10, y: 10)": toObject(110),

      // The above implies that we should support the first argument to always
      // be able to match the first parameter, and let further params be keyworded
      // to make it easy to add params later if you need more specificity.
      "a = { |x, y: 2| x * y }; a.call(5) + a.call(10, y: 10)": toObject(110),
    }

    for(var test in tests) {
      let i = new Interpreter()
      let result = i.eval(test)
      let expected = tests[test]

      assert.equal(result.data, expected.data, `Incorrect return value for "${test}"`)
    }
  })
})

function assertObjectEval(input: string, expected: IObject) {
  let i = new Interpreter()
  let result = i.eval(input)

  assert.equal(result.parents.length, expected.parents.length)
  assert.equal(result.parents[0], expected.parents[0])
  assert.equal(result.data, expected.data, `Incorrect return value for "${input}"`)
}
