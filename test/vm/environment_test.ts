import "mocha"
import * as assert from "assert"
import Environment from "@vm/environment"
import { toObject, Null } from "@vm/object"

describe("Environment", () => {
  it("allows storage and retrieval of objects", () => {
    let e = new Environment()
    let one = toObject(1)

    e.set("value", one)

    assert.equal(e.get("value"), one)
    assert.equal(e.get("undefined"), Null)
  })

  it("can find values from parent environments", () => {
    let e = new Environment()
    let one = toObject(1)

    e.set("value", one)
    e.pushScope()

    assert.equal(e.get("value"), one)
  })

  it("finds local values over parent values", () => {
    let e = new Environment()
    let one = toObject(1)
    let two = toObject(2)

    e.set("value", one)
    e.pushScope()

    e.set("value", two)
    assert.equal(e.get("value"), two)

    e.popScope()
    assert.equal(e.get("value"), one)
  })
})
