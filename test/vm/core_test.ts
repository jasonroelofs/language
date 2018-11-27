import "mocha"
import * as assert from "assert"
import * as util from "util"
import { toObject, True, False } from "@vm/object"
import { World } from "@vm/core"
import VM from "@vm/vm"

describe("Object", () => {
  it("supports basic object equality", () => {
    let tests = {
      "true == true": True,
      "false == false": True,
      "true == false": False,
      "true != false": True,
      "null == null": True
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })
})

describe("True / False / Null", () => {
  it("supports toString on these built-ins", () => {
    assertExpression("true.toString()", toObject("true"))
    assertExpression("false.toString()", toObject("false"))
    assertExpression("null.toString()", toObject("null"))
  })
})

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

  it("supports toString to get the Javascript value", () => {
    assert.equal(toObject(2).toString(), "2")
    assert.equal(toObject(5.5).toString(), "5.5")
    assert.equal(toObject(-3).toString(), "-3")
  })

  it("allows toString usage in the language", () => {
    assertExpression("1.toString()", toObject("1"))
    assertExpression("1.5.toString()", toObject("1.5"))
    assertExpression("-3.toString()", toObject("-3"))
  })
})

describe("String", () => {
  it("supports toString to get the Javascript value", () => {
    assert.equal(toObject("Hello").toString(), "Hello")
  })

  it("supports string concatenation", () => {
    assertExpression(`"Hello " + "World"`, toObject("Hello World"))
  })
})

describe("Array", () => {
  it("allows initialization of a list of values", () => {
    let tests = {
      "[].length()": toObject(0),
      "[1,2,3].length()": toObject(3)
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("can convert to and from a javascript array", () => {
    let before = [1, 2, 3]
    let after = toObject(before)

    assert.equal(after.data[0].data, 1)
    assert.equal(after.data[1].data, 2)
    assert.equal(after.data[2].data, 3)
  })

  it("allows pushing and popping values", () => {
    let tests = {
      "a = []; a.push(1); a.length()": toObject(1),
      "[1].pop()": toObject(1)
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("can iterate over the array's entries", () => {
    let test = `
      a = [1, 2, 3]
      accum = 0
      a.each({ |num| accum = accum + num })
      accum
    `

    // TODO: This test fails because `accum` gets created as a local
    // slot to each block invocation and does not update the value of the
    // `accum` in the outer scope.
    // Update our Assignment handling to look for existing names in the current scope,
    // and then update *that* scope's version of `accum` first before setting it
    // to the local scope.

    assertExpression(test, toObject(6))
  })
})

function assertExpression(input, expected) {
  let vm = new VM()

  let result = vm.eval(input)

  if((typeof result) != "object" || !("objectId" in result)) {
    assert.fail(util.format("expected an IObject, but got %o", result))
  }

  // console.log("Got result: %o", result)

  assert.equal(result.data, expected.data, `Eval failed for ${input}`)
}
