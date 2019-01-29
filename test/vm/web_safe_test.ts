import "mocha"
import * as assert from "assert"
import {
  ToObject,
  IObject,
  True,
  False,
  Null,
  SendMessage,
} from "@vm/object"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import WebSafeInterpreter from "@vm/web_safe_interpreter"

describe("Web Safe VM", () => {
  it("evaluates number literals", async () => {
    let tests = {
      "1": ToObject(1),
      "2": ToObject(2),
      "3.0": ToObject(3.0),
      "4.4": ToObject(4.4),
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

  it("evaluates specials", async () => {
    let tests = {
      "true": True,
      "false": False,
      "null": Null,
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

  it("evaluates strings", async () => {
    let tests = {
      [`"A String"`]: ToObject("A String"),
      [`'Single Quotes'`]: ToObject("Single Quotes"),
      [`"Nested\\"Quotes"`]: ToObject(`Nested\\"Quotes`),
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

  it("builds block objects", async () => {
    let tests = {
      "{ 1 }": { bodyLength: 1, paramLength: 0 },
      "{ 1\n2 }": { bodyLength: 2, paramLength: 0 },
      "{ |a| a }": { bodyLength: 1, paramLength: 1 },
      "{ |a, b| a + b }": { bodyLength: 1, paramLength: 2 },
    }

    for(var test in tests) {
      let result = await evalAndReturn(test)
      let expected = tests[test]

      assert(result.codeBlock)
      assert.equal(SendMessage(result, ToObject("body")).data.length, expected.bodyLength)
      assert.equal(SendMessage(result, ToObject("parameters")).data.length, expected.paramLength)
    }
  })

  it("evaulates local assignment and lookup", async () => {
    let tests = {
      // Assignment returns the value assigned
      "a = 1": ToObject(1),
      // Accessing the local slot returns the stored value
      "a = 2; a": ToObject(2),
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

    /*
  it("evaluates blocks", async () => {
    let tests = {
      "a = { 1 }; a.call()": ToObject(1),

      // Single arguments
      "a = { |x| x }; a.call(1)": ToObject(1),

      // Single arguments can be given keyword args
      "a = { |x| x }; a.call(x: 10)": ToObject(10),

      // Keyword multi-arguments
      "a = { |a, b| a + b }; a.call(a: 1, b: 2)": ToObject(3),

      // Keyword arguments out-of-order
      "a = { |a, b| a / b }; a.call(b: 2, a: 4)": ToObject(2),

      // Single argument but with default
      "a = { |a: 3| a }; a.call() + a.call(5)": ToObject(8),

      // Keyword arguments with default
      "a = { |x: 1, y: 2| x * y }; a.call() + a.call(x: 2, y: 3)": ToObject(8),

      // Default arguments and one required argument
      "a = { |x, y: 2| x * y }; a.call(5) + a.call(x: 10, y: 10)": ToObject(110),

      // The above implies that we should support the first argument to always
      // be able to match the first parameter, and let further params be keyworded
      // to make it easy to add params later if you need more specificity.
      "a = { |x, y: 2| x * y }; a.call(5) + a.call(10, y: 10)": ToObject(110),

      // Blocks can be executed with just parens and without the explicit .call
      "a = { 1 }; a()": ToObject(1),

      // Blocks can be executed with just parens and without the explicit .call
      "{ 2 }()": ToObject(2),
    }

    for(var input in tests) {
      let expected = tests[input]

      await assertObjectEval(input, expected)
    }
  })
  */

  async function assertObjectEval(input: string, expected: IObject) {
    let result = await evalAndReturn(input)

    assert(result, `We didn't a result back for ''${input}'', check for errors?`)

    assert.equal(result.parents.length, expected.parents.length)
    assert.equal(result.parents[0], expected.parents[0])
    assert.equal(result.data, expected.data, `Incorrect return value for "${input}"`)
  }

  async function evalAndReturn(input: string) {
    // Bypassing the VM layer for now, this will eventually be cleaned up
    // to actually call to the VM.
    let interp = new WebSafeInterpreter(null)
    interp.ready()

    let lexer = new Lexer(input)
    let tokens = lexer.tokenize()

    let parser = new Parser(tokens)
    let expressions = parser.parse()

    return interp.eval(expressions).promise
  }
})
