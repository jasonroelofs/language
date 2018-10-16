import {
  NewObject, toObject, IObject, Objekt,
  Number, String, True, False, Null,
  AddSlot,
} from "@vm/object"

//
// Our core set of built-ins
//

function builtInFunc(func): IObject {
  let value = NewObject(Objekt, func)
  value.codeBlock = true
  value.builtIn = true

  return value
}

AddSlot(Objekt, "addSlot", builtInFunc(function(slotName, slotValue) {
  AddSlot(this, slotName, slotValue)
}))

AddSlot(Number, "+", builtInFunc(function(other) {
  return toObject(this.data + other.data)
}))

AddSlot(Number, "-", builtInFunc(function(other) {
  return toObject(this.data - other.data)
}))

AddSlot(Number, "*", builtInFunc(function(other) {
  return toObject(this.data * other.data)
}))

AddSlot(Number, "/", builtInFunc(function(other) {
  return toObject(this.data / other.data)
}))

AddSlot(Number, ">", builtInFunc(function(other) {
  return toObject(this.data > other.data)
}))

AddSlot(Number, ">=", builtInFunc(function(other) {
  return toObject(this.data >= other.data)
}))

AddSlot(Number, "<", builtInFunc(function(other) {
  return toObject(this.data < other.data)
}))

AddSlot(Number, "<=", builtInFunc(function(other) {
  return toObject(this.data <= other.data)
}))

AddSlot(Number, "==", builtInFunc(function(other) {
  return toObject(this.data == other.data)
}))

AddSlot(Number, "!=", builtInFunc(function(other) {
  return toObject(this.data != other.data)
}))

let IO = NewObject(Objekt)
AddSlot(IO, "puts", builtInFunc(function(message) {
  console.log(message.toString())
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
let World = NewObject(Objekt)
AddSlot(World, "World", World)

AddSlot(World, "Object", Objekt)
AddSlot(World, "Number", Number)
AddSlot(World, "String", String)
AddSlot(World, "IO",     IO)

AddSlot(World, "True",   True)
AddSlot(World, "False",  False)
AddSlot(World, "Null",   Null)

/**
 * However, all actual execution happens in a Space, which is
 * a child of the World. This constrains all code to it's own context
 * while still having full access to everything defined in the World.
 * My thought here is that system execution will consist of many spaces
 * layered on top of and along side each other to build abstractions.
 */
let Space = NewObject(World)
AddSlot(Space, "Space", Space)

export {
  Objekt,
  Number,
  String,
  IO,
  World,
  Space,
}
