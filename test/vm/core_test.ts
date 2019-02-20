import "mocha"
import * as assert from "assert"
import * as util from "util"
import { ToObject, True, False } from "@vm/object"
import { World } from "@vm/core"
import VM from "@vm/vm"

describe("Number", () => {
  it("supports toString to get the Javascript value", () => {
    assert.equal(ToObject(2).toString(), "2")
    assert.equal(ToObject(5.5).toString(), "5.5")
    assert.equal(ToObject(-3).toString(), "-3")
  })
})

describe("String", () => {
  it("supports toString to get the Javascript value", () => {
    assert.equal(ToObject("Hello").toString(), "Hello")
  })
})

describe("Array", () => {
  it("can convert to and from a javascript array", () => {
    let before = [1, 2, 3]
    let after = ToObject(before)

    assert.equal(after.data[0].data, 1)
    assert.equal(after.data[1].data, 2)
    assert.equal(after.data[2].data, 3)
  })
})
