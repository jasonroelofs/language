import "mocha"
import * as assert from "assert"
import * as util from "util"
import VM from "@vm/vm"
import * as errors from "@vm/errors"
import { IObject, toObject, SendMessage, True, False, Null } from "@vm/object"
import { Objekt, World } from "@vm/core"

describe("VM", () => {
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

    let vm = new VM()

    for(var test in tests) {
      let result = vm.eval(test)
      let expected = tests[test]

      assert.equal(SendMessage(result, toObject("body")).data.length, expected.bodyLength)
      assert.equal(SendMessage(result, toObject("parameters")).data.length, expected.paramLength)
    }
  })

  it("assigns object names based on the assignment variable", () => {
    let tests = {
      "World.objectName": "World",
      "Object.objectName": "Object",
      "a = 1; a.objectName": "a",
      "dog = Object.new(); dog.objectName": "dog",
      // Make sure that multiple assignment to the same static value
      // gets its own name (e.g. we aren't overwriting Number.objectName).
      "a = 1; b = 1; a.objectName": "a"
    }

    let vm = new VM()
    for(var test in tests) {
      let result = vm.eval(test)
      let expected = tests[test]

      assert.equal(result.data, expected)
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

      // Blocks can be executed with just parens and without the explicit .call
      "a = { 1 }; a()": toObject(1),
    }

    let vm = new VM()

    for(var test in tests) {
      let result = vm.eval(test)
      let expected = tests[test]

      assert.equal(result.data, expected.data, `Incorrect return value for "${test}"`)
    }
  })

  it("blocks are closures", () => {
    let vm = new VM()
    var result

    // Attached blocks link back to the owning object
    result = vm.eval("str = Object.toString; str()")
    assert.equal(result.data, "Object")

    // Instances of other objects close properly around parent methods
    result = vm.eval("obj = Object.new(); obj.toString()")
    assert.equal(result.data, "obj")

    // Passing activation records as parameters works
    result = vm.eval("str = Object.toString; block = {|cb| cb()}; block(str)")
    assert.equal(result.data, "Object")

    // Higher order functions all work
    result = vm.eval("add = { |x| { |y| x + y } }; add2 = add(2); add2(3)")
    assert.equal(result.data, 5, "Higher order function didn't work")
  })

  it("evaluates direct message calls on objects", () => {
    let vm = new VM()

    // Get raw values back
    vm.eval(`obj = Object.new(); obj.addSlot("size", as: 3)`)
    var result = vm.eval("obj.size")
    assert.equal(result.data, 3)

    // Eval a block with no arguments
    vm.eval(`obj = Object.new(); obj.addSlot("count", as: { 5 })`)
    var result = vm.eval("obj.count()")
    assert.equal(result.data, 5)

    // Call blocks at the slot with arguments
    vm.eval(`obj = Object.new(); obj.addSlot("pow", as: { |x| x * x })`)
    result = vm.eval("obj.pow(3)")
    assert.equal(result.data, 9)
  })

  it("supports creation of new objects", () => {
    let vm = new VM()

    let test = vm.eval(`testObj = Object.new()`)
    assert.equal(test.parents[0], Objekt)

    let test2 = vm.eval(`test2 = testObj.new()`)
    assert.equal(test2.parents[0], test)
  })

  it("supports adding slots to new objects in the constructor", () => {
    let vm = new VM()
    let result = vm.eval(`
      test = Object.new(
        size: 1,
        count: 2,
        add: { |x, y| x + y }
      )

      test.size + test.count + test.add(x: 4, y: 5)
    `)

    assert.equal(result.data, 12)
  })

  it("sets up an implicit `self` receiver on calls to object blocks", () => {
    let vm = new VM()
    let result = vm.eval(`
      test = Object.new(
        size: 1,
        count: 2,
        add: { size + count }
      )

      test2 = test.new()
      add = test2.add

      test.add() + test2.add() + add()
    `)

    assert.equal(result.data, 3 + 3 + 3)
  })

  it("loads the core and standard libraries into the World", () => {
    let vm = new VM()

    // Have to use a name that's defined only in the core/stdlib for this to pass
    let result = vm.eval(`World.getSlot("IO") == null`)

    assert.equal(result, False)
  })

  describe("Error Handling", () => {
    it("errors on failed slot lookup", () => {
      let vm = new VM()
      var error

      let tests = {
        "World.unknownSlot": ["unknownSlot", 6],
        "missing": ["missing", 0]
      }

      for(var test in tests) {
        try {
          vm.eval(test)
        } catch(e) {
          error = e
        }

        assertErrorType(error, errors.SlotNotFoundError)

        assert.equal(error.chunk, tests[test][0], `Wrong chunk, expected ${tests[test][0]} got ${error.chunk}`)
        assert.equal(error.position, tests[test][1], `Wrong position, expected ${tests[test][1]} got ${error.position}`)
      }
    })

    it("errors on invalid message block invocation", () => {
      let vm = new VM()
      var error

      try {
        vm.eval(`a = Object.new(m: 1); a.m()`)
      } catch(e) {
        error = e
      }

      assertErrorType(error, errors.NotABlockError)

      assert.equal(error.chunk, "m")
      assert.equal(error.position, 24)
    })

    it("errors on invalid block invocation", () => {
      let vm = new VM()
      var error

      // Explicit .call
      try {
        vm.eval(`a = 1; a.call()`)
      } catch(e) {
        error = e
      }

      assertErrorType(error, errors.NotABlockError)

      assert.equal(error.chunk, "a")
      assert.equal(error.position, 7)

      // Implicit version
      try {
        vm.eval(`a = 1; a()`)
      } catch(e) {
        error = e
      }

      assertErrorType(error, errors.NotABlockError)

      assert.equal(error.chunk, "a")
      assert.equal(error.position, 7)
    })

    function assertErrorType(result: errors.RuntimeError, errorClass) {
      assert(result instanceof errorClass,
             util.format("Result %o was not an instance of %o", result, errorClass))
    }
  })
})

function assertObjectEval(input: string, expected: IObject) {
  let vm = new VM()
  let result = vm.eval(input)

  assert(result, `We didn't a result back for ''${input}'', check for errors?`)

  assert.equal(result.parents.length, expected.parents.length)
  assert.equal(result.parents[0], expected.parents[0])
  assert.equal(result.data, expected.data, `Incorrect return value for "${input}"`)
}
