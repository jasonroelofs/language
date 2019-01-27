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

    return interp.eval(expressions)
  }
})
