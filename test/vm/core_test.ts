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
})

describe("String", () => {
  it("supports toString to get the Javascript value", () => {
    assert.equal(toObject("Hello").toString(), "Hello")
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
