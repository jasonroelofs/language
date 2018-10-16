import {
  NewObject, toObject, IObject, Objekt,
  Number, String, True, False, Null
} from "@vm/object"

//
// Our core set of built-ins
//

function builtInFunc(func): IObject {
  let value = NewObject(Objekt, {}, func)
  value.codeBlock = true
  value.builtIn = true

  return value
}

Number.slots.set("+", builtInFunc(function(other) {
  return toObject(this.data + other.data)
}))

Number.slots.set("-", builtInFunc(function(other) {
  return toObject(this.data - other.data)
}))

Number.slots.set("*", builtInFunc(function(other) {
  return toObject(this.data * other.data)
}))

Number.slots.set("/", builtInFunc(function(other) {
  return toObject(this.data / other.data)
}))

Number.slots.set(">", builtInFunc(function(other) {
  return toObject(this.data > other.data)
}))

Number.slots.set(">=", builtInFunc(function(other) {
  return toObject(this.data >= other.data)
}))

Number.slots.set("<", builtInFunc(function(other) {
  return toObject(this.data < other.data)
}))

Number.slots.set("<=", builtInFunc(function(other) {
  return toObject(this.data <= other.data)
}))

Number.slots.set("==", builtInFunc(function(other) {
  return toObject(this.data == other.data)
}))

Number.slots.set("!=", builtInFunc(function(other) {
  return toObject(this.data != other.data)
}))

let IO = NewObject(Objekt)
IO.slots.set("puts", builtInFunc(function(message) {
  console.log(message.toString())
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 */
let World = NewObject(Objekt)
World.slots.set("Object", Objekt)
World.slots.set("Number", Number)
World.slots.set("String", String)
World.slots.set("IO",     IO)

World.slots.set("True", True)
World.slots.set("False", False)
World.slots.set("Null", Null)

/**
 * However, all actual execution happens in a Space, which is
 * a child of the World. This constrains all code to it's own context
 * while still having full access to everything defined in the World.
 * My thought here is that system execution will consist of many spaces
 * layered on top of and along side each other to build abstractions.
 */
let Space = NewObject(World)

export {
  Number,
  String,
  IO,
  World,
  Space,
}
