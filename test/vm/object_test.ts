import "mocha"
import * as assert from "assert"
import {
  IObject, ToObject, AsString, Objekt,
  Number, String,
  NewObject, SendMessage, SetSlot, GetSlot, AddParent,
} from "@vm/object"

describe("Object", () => {
  it("has built-in true, false, and Nil", () => {
    assert(ToObject(true) === ToObject(true), "Did not return the same object for True")
    assert(ToObject(false) === ToObject(false), "Did not return the same object for False")
    assert(ToObject(null) === ToObject(null), "Did not return the same object for Null")
    assert(ToObject(undefined) === ToObject(undefined), "Did not return the same object for undefined")
  })

  it("converts numbers", () => {
    let tests = [1, 2, 3.3, -4.4]

    for(var test of tests) {
      let obj = ToObject(test)

      assert.equal(obj.parents[0], Number)
      assert.equal(obj.data, test)
    }
  })

  it("converts strings", () => {
    let tests = ["test", "one", "two three", "four\"five", "こんにちは"]

    for(var test of tests) {
      let obj = ToObject(test)

      assert.equal(obj.parents[0], String)
      assert.equal(obj.data, test)
    }
  })

  it("provides a pass-through for existing objects", () => {
    let one = ToObject(1)

    assert.equal(ToObject(one), one)
  })

  it("sends messages to objects", () => {
    let one = ToObject(1)
    let obj = NewObject(Objekt)
    SetSlot(obj, ToObject("one"), one)

    let result = SendMessage(obj, ToObject("one"))

    assert.equal(result, one)
  })

  it("doesn't get stuck in infinite loops on parent loops", () => {
    let one = NewObject(Objekt)
    let two = NewObject(one)

    // Built a parent loop!
    AddParent(one, two)

    // Search for something that doesn't exist
    // to show that we've iterated through all parents
    // and did not get stuck in a loop
    let result = SendMessage(two, ToObject("-not-found-"))
    assert(result == null)
  })

  it("messages not found in the object ask parent objects", () => {
    let str = ToObject("testing")

    let parent = NewObject(Objekt)
    let child1 = NewObject(parent)
    let child2 = NewObject(parent)

    SetSlot(parent, ToObject("test"), str)

    assert.equal(SendMessage(child2, ToObject("test")), str)
    assert.equal(SendMessage(child1, ToObject("test")), str)
  })

  it("iterates through all parents to find the first matching slot, depth-first", () => {
    let obj = NewObject(Objekt)

    let gp1 = NewObject(Objekt)
    let p1 = NewObject(gp1)

    SetSlot(gp1, ToObject("one"), ToObject(1))

    let gp2 = NewObject(Objekt)
    SetSlot(gp2, ToObject("two"), ToObject(2))
    let p2 = NewObject(gp2)
    SetSlot(p2, ToObject("three"), ToObject(3))

    obj.parents.push(p1)
    obj.parents.push(p2)

    // First grand-parent
    assert.equal(SendMessage(obj, ToObject("one")).data, 1)
    // Second parent
    assert.equal(SendMessage(obj, ToObject("two")).data, 2)
    // Second grandparent
    assert.equal(SendMessage(obj, ToObject("three")).data, 3)
  })

  it("allows getting the Slot meta-object", () => {
    let str = ToObject("testing")
    let five = ToObject(5)
    SetSlot(str, ToObject("count"), five)

    let slot = GetSlot(str, ToObject("count"))

    assert.equal(SendMessage(slot, ToObject("value")), five)
  })

  it("supports adding comments to the slot meta-object", () => {
    let str = ToObject("testing")
    let five = ToObject(5)
    let comment = ToObject("The number of characters that might be in this string")
    SetSlot(str, ToObject("count"), five, comment)

    let slot = GetSlot(str, ToObject("count"))

    assert.equal(SendMessage(slot, ToObject("comments")), comment)
  })

  it("supports interning strings", () => {
    let str1 = AsString("testing")
    let str2 = AsString("testing")

    assert.equal(str1.objectId, str2.objectId)
  })

  it("looks up but, doesn't store, strings via ToObject", () => {
    let str1 = ToObject("uncached")
    let str2 = ToObject("uncached")

    assert.notEqual(str1.objectId, str2.objectId)

    let str3 = AsString("cached")
    let str4 = ToObject("cached")

    assert.equal(str3.objectId, str4.objectId)
  })

  it("interns and re-uses numbers", () => {
    let num1 = ToObject(1)
    let num2 = ToObject(1)
    let num3 = ToObject(1)

    assert.equal(num1.objectId, num2.objectId)
    assert.equal(num2.objectId, num3.objectId)

    let neg1 = ToObject(-1)
    let neg2 = ToObject(-1)

    assert.equal(neg1.objectId, neg2.objectId)

    let float1 = ToObject(12.7)
    let float2 = ToObject(12.7)

    assert.equal(float1.objectId, float2.objectId)
  })
})
