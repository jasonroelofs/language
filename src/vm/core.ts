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

/**
 * Container object for all built-in methods we will be exposing to the user
 */
let BuiltIn = NewObject(Objekt)

AddSlot(BuiltIn, "numberOp", builtInFunc(function(left, op, right) {
  switch(op.data) {
    case "+":
      return toObject(left.data + right.data)
    case "-":
      return toObject(left.data - right.data)
    case "*":
      return toObject(left.data * right.data)
    case "/":
      return toObject(left.data / right.data)
    case ">":
      return toObject(left.data > right.data)
    case ">=":
      return toObject(left.data >= right.data)
    case "<":
      return toObject(left.data < right.data)
    case "<=":
      return toObject(left.data <= right.data)
    case "==":
      return toObject(left.data == right.data)
    case "!=":
      return toObject(left.data != right.data)
    default:
      throw new Error(`Unknown operand on numbers '${op}'`)
  }
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

AddSlot(World, "BuiltIn", BuiltIn)

AddSlot(World, "Object", Objekt)
AddSlot(World, "Number", Number)
AddSlot(World, "String", String)
AddSlot(World, "IO",     IO)

AddSlot(World, "True",   True)
AddSlot(World, "False",  False)
AddSlot(World, "Null",   Null)

export {
  Objekt,
  Number,
  String,
  IO,
  World,
}
