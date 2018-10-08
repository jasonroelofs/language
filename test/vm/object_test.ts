import "mocha"
import * as assert from "assert"
import { Object, ValueObject, BlockObject, ObjectType, toObject } from "@vm/object"

describe("Object", () => {
  it("has built-in true, false, and Nil", () => {
    assert(toObject(true) === toObject(true), "Did not return the same object for True")
    assert(toObject(false) === toObject(false), "Did not return the same object for False")
    assert(toObject(null) === toObject(null), "Did not return the same object for Null")
    assert(toObject(undefined) === toObject(undefined), "Did not return the same object for undefined")
  })

  it("converts numbers", () => {
    let tests = [1, 2, 3.3, -4.4]

    for(var test of tests) {
      let obj = toObject(test) as ValueObject

      assert.equal(obj.type, ObjectType.Number)
      assert.equal(obj.value, test)
    }
  })

  it("converts strings", () => {
    let tests = ["test", "one", "two three", "four\"five", "こんにちは"]

    for(var test of tests) {
      let obj = toObject(test) as ValueObject

      assert.equal(obj.type, ObjectType.String)
      assert.equal(obj.value, test)
    }
  })
})