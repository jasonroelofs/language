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

AddSlot(Objekt, "addSlot", builtInFunc(function(args) {
  let slotName = args["0"]
  let slotValue = args["as"]
  AddSlot(this, slotName, slotValue)
}))

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
AddSlot(Objekt, "new", builtInFunc(function(args) {
  let obj = NewObject(this)

  for(var slotName in args) {
    AddSlot(obj, slotName, args[slotName])
  }

  return obj
}))

/**
 * Container object for all built-in methods we will be exposing to the user
 */
let BuiltIn = NewObject(Objekt)

AddSlot(BuiltIn, "numberOp", builtInFunc(function(args) {
  let left = args["left"]
  let op = args["op"]
  let right = args["right"]

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

AddSlot(BuiltIn, "puts", builtInFunc(function(args) {
  console.log(args["message"].toString())
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

AddSlot(World, "True",   True)
AddSlot(World, "False",  False)
AddSlot(World, "Null",   Null)

export {
  Objekt,
  Number,
  String,
  World,
}
