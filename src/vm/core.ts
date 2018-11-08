import {
  NewObject, toObject, IObject, Objekt,
  Number, String, Array,
  True, False, Null,
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

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
AddSlot(Objekt, toObject("new"), builtInFunc(function(args, meta = {}) {
  let obj = NewObject(this)
  addSlots(obj, args, meta)

  return obj
}))

AddSlot(Objekt, toObject("addSlots"), builtInFunc(function(args, meta = {}) {
  addSlots(this, args, meta)
}))

function addSlots(obj: IObject, args, meta = {}) {
  var comment

  for(var slotName in args) {
    comment = meta[slotName] ? meta[slotName].comment : null
    AddSlot(obj, toObject(slotName), args[slotName], toObject(comment))
  }
}

AddSlot(Objekt, toObject("addSlot"), builtInFunc(function(args) {
  let slotName = args["0"]
  let slotValue = args["as"]
  AddSlot(this, slotName, slotValue)
}))

AddSlot(Objekt, toObject("getSlot"), builtInFunc(function(args) {
  let slotName = args["0"]
  return GetSlot(this, slotName)
}))

AddSlot(Objekt, toObject("objectId"), builtInFunc(function() {
  return toObject(this.objectId)
}))

/**
 * Container object for all built-in methods we will be exposing to the user
 */
let BuiltIn = NewObject(Objekt)

AddSlot(BuiltIn, toObject("numberOp"), builtInFunc(function(args) {
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

AddSlot(BuiltIn, toObject("puts"), builtInFunc(function(args) {
  console.log(args["message"].toString())
}))

/**
 * Array.new(...)
 *
 * This builds up a new Array object with the given values.
 * This message takes a list of the values to be added to this array
 * at initialization.
 *
 *   Array.new("0": 1, "1": 2, ...)
 *
 * Expected to be used with static initialization syntax sugar:
 *
 *   [1, 2, ...]
 *
 */
AddSlot(Array, toObject("new"), builtInFunc(function(args) {
  let array = []

  for(var slotName in args) {
    array[slotName] = args[slotName]
  }

  return NewObject(Array, array)
}))

AddSlot(BuiltIn, toObject("arrayLength"), builtInFunc(function(args) {
  return toObject(args["array"].data.length)
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
let World = NewObject(Objekt)
AddSlot(World, toObject("World"), World)

AddSlot(World, toObject("BuiltIn"), BuiltIn)

AddSlot(World, toObject("Object"), Objekt)
AddSlot(World, toObject("Number"), Number)
AddSlot(World, toObject("String"), String)
AddSlot(World, toObject("Array"),  Array)

AddSlot(World, toObject("True"),   True)
AddSlot(World, toObject("False"),  False)
AddSlot(World, toObject("Null"),   Null)

// If anything changes on our base objects, make sure they get
// re-exported here.
export {
  Objekt,
  World,
  Array,
}
