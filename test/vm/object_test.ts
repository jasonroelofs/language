import "mocha"
import * as assert from "assert"
import {
  IObject, toObject, Objekt,
  Number, String,
  NewObject, SendMessage, AddSlot, GetSlot
} from "@vm/object"

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
      let obj = toObject(test)

      assert.equal(obj.parents[0], Number)
      assert.equal(obj.data, test)
    }
  })

  it("converts strings", () => {
    let tests = ["test", "one", "two three", "four\"five", "こんにちは"]

    for(var test of tests) {
      let obj = toObject(test)

      assert.equal(obj.parents[0], String)
      assert.equal(obj.data, test)
    }
  })

  it("provides a pass-through for existing objects", () => {
    let one = toObject(1)

    assert.equal(toObject(one), one)
  })

  it("sends messages to objects", () => {
    let one = toObject(1)
    let obj = NewObject(Objekt)
    AddSlot(obj, "one", one)

    let result = SendMessage(obj, "one")

    assert.equal(result, one)
  })

  it("messages not found in the object ask parent objects", () => {
    let str = toObject("testing")

    let parent = NewObject(Objekt)
    let child1 = NewObject(parent)
    let child2 = NewObject(parent)

    AddSlot(parent, "test", str)

    assert.equal(SendMessage(child2, "test"), str)
    assert.equal(SendMessage(child1, "test"), str)
  })

  it("iterates through all parents to find the first matching slot, depth-first", () => {
    let obj = NewObject(Objekt)

    let gp1 = NewObject(Objekt)
    let p1 = NewObject(gp1)

    AddSlot(gp1, "one", toObject(1))

    let gp2 = NewObject(Objekt)
    AddSlot(gp2, "two", toObject(2))
    let p2 = NewObject(gp2)
    AddSlot(p2, "three", toObject(3))

    obj.parents.push(p1)
    obj.parents.push(p2)

    // First grand-parent
    assert.equal(SendMessage(obj, "one").data, 1)
    // Second parent
    assert.equal(SendMessage(obj, "two").data, 2)
    // Second grandparent
    assert.equal(SendMessage(obj, "three").data, 3)
  })

  it("allows getting the Slot meta-object", () => {
    let str = toObject("testing")
    let five = toObject(5)
    AddSlot(str, "count", five)

    let slot = GetSlot(str, "count")

    assert.equal(SendMessage(slot, "value"), five)
  })

  it("supports adding comments to the slot meta-object", () => {
    let str = toObject("testing")
    let five = toObject(5)
    let comment = toObject("The number of characters that might be in this string")
    AddSlot(str, "count", five, comment)

    let slot = GetSlot(str, "count")

    assert.equal(SendMessage(slot, "comments"), comment)
  })
})
