import "mocha"
import * as assert from "assert"
import {
  ToObject,
  IObject,
  True,
  False,
  Null,
  SendMessage,
  AsString,
} from "@vm/object"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import WebSafeVM from "@vm/web_safe_vm"
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

  it("assigns object names to values stored in variables", async () => {
    let tests = {
      "World.objectName": AsString("World"),
      "Object.objectName": AsString("Object"),
      "a = 1; a.objectName": AsString("a"),
      "dog = Object.new(); dog.objectName": AsString("dog"),
      // Make sure that multiple assignment to the same static value
      // gets its own name (e.g. we aren't overwriting Number.objectName).
      "a = 1; b = 1; a.objectName": AsString("a")
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

  it("implements Ruby-esque scope lookup and re-assignment", async () => {
    // What makes the most sense to me and what I think is the least surprising
    // is when a variable is referenced that's defined in an outer scope, to default
    // to accessing and updating that outer variable.
    // This is how Ruby scoping works, but is not how Python scoping works. In Python
    // I would need to say `global a` in the `b` block to enable such access.
    // Thus I call this "Ruby-esque" scoping, not because Ruby invented it, but because
    // Ruby is my most familiar example of this implementation.
    let tests = {
      "a = 1; b = { a = a + 1 }; b(); b(); b(); a": ToObject(4),
      // depth doesn't matter
      "a = 1; { a = 2; { a = 3; { a = 4; { a = 5 }() }() }() }(); a": ToObject(5),
      // Object ownership and nested blocks are handled correctly
      // Here `get` and `ifTrue` are nested scopes, which need to be linked back
      // to outer scopes to properly find the right value of `a`.
      //"obj = Object.new(a: 1, get: { true.do(ifTrue: { a }) }); obj.get()": ToObject(1),
    }

    for(var test in tests) {
      await assertObjectEval(test, tests[test])
    }
  })

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

      // Objects with the `call` method can stand in as blocks
      "a = Object.new(call: { |x| x * 2 }); a(2)": ToObject(4),
    }

    for(var input in tests) {
      let expected = tests[input]

      await assertObjectEval(input, expected)
    }
  })

  it("blocks are closures", async () => {
    let vm = new WebSafeVM()
    let result: IObject
    await vm.ready()

    // Attached blocks link back to the owning object
    result = await vm.eval("str = Object.toString; str()")
    assert.equal(result.data, "Object")

    // Instances of other objects close properly around parent methods
    result = await vm.eval("obj = Object.new(); obj.toString()")
    assert.equal(result.data, "obj")

    // Passing activation records as parameters works
    result = await vm.eval("str = Object.toString; block = {|cb| cb()}; block(str)")
    assert.equal(result.data, "Object")

    // Higher order functions all work
    result = await vm.eval("add = { |x| { |y| x + y } }; add2 = add(2); add2(3)")
    assert.equal(result.data, 5, "Higher order function didn't work")
  })

  it("keeps the value of `self` through nested messages", async () => {
    let vm = new WebSafeVM()
    await vm.ready()

    let result = await vm.eval(`
      obj = Object.new(one: 1, two: { self.one + self.one }, three: { self.two() + self.one })
      obj.three()
    `)

    assert.equal(result.data, 3)
  })

  /**
   * TO TEST:
   *  - Assignment doesn't leave stray values on the stack.
   *    Ala, clear stack data when the current space ends?
   *    Use case: assignment is the last expression of the method so it needs to be
   *    the return value. Yet if no-one uses it, is it a problem? Seems like a possible
   *    memory leak.
   */

  async function assertObjectEval(input: string, expected: IObject) {
    let result = await evalAndReturn(input)

    assert(result, `We didn't a result back for ''${input}'', check for errors?`)

    assert.equal(result.parents.length, expected.parents.length)
    assert.equal(result.parents[0], expected.parents[0], `Wrong parent type for ${input}`)
    assert.equal(result.data, expected.data, `Incorrect return value for "${input}"`)
  }

  async function evalAndReturn(input: string) {
    let vm = new WebSafeVM()
    await vm.ready()
    return vm.eval(input)
  }
})
