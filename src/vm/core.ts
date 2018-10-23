import {
  NewObject, toObject, IObject, Objekt,
  Number, String, True, False, Null,
  AddSlot, GetSlot,
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

AddSlot(Objekt, "getSlot", builtInFunc(function(args) {
  let slotName = args["0"]
  return GetSlot(this, slotName)
}))

AddSlot(Objekt, "addSlots", builtInFunc(function(args, meta = {}) {
  Object.keys(args).forEach((key) => {
    AddSlot(this, key, args[key], meta[key].comment)
  })
}))

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
AddSlot(Objekt, "new", builtInFunc(function(args, meta = {}) {
  let obj = NewObject(this)
  var comment

  for(var slotName in args) {
    comment = meta[slotName] ? meta[slotName].comment : null
    AddSlot(obj, slotName, args[slotName], toObject(comment))
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
