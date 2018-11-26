import {
  NewObject, toObject, IObject, Objekt,
  Number, String, Array,
  True, False, Null,
  AddSlot, GetSlot,
  SendMessage,
} from "@vm/object"

import { arrayFrom } from "@vm/js_core"

//
// Our core set of built-ins
//

type BuiltInFunction = (...args: any[]) => IObject

// Define a Javascript function to properly expose it
// to the language runtime as an executable block.
function builtInFunc(func: BuiltInFunction): IObject {
  let value = NewObject(Objekt, func)
  value.codeBlock = true
  value.builtIn = true

  return value
}

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
AddSlot(Objekt, toObject("new"), builtInFunc(function(args, meta = {}): IObject {
  let obj = NewObject(this)
  addSlots(obj, args, meta)

  return obj
}))

AddSlot(Objekt, toObject("addSlots"), builtInFunc(function(args, meta = {}): IObject {
  addSlots(this, args, meta)

  return Null
}))

function addSlots(obj: IObject, args, meta = {}) {
  var comment

  for(var slotName in args) {
    comment = meta[slotName] ? meta[slotName].comment : null
    AddSlot(obj, toObject(slotName), args[slotName], toObject(comment))
  }
}

AddSlot(Objekt, toObject("addSlot"), builtInFunc(function(args): IObject {
  let slotName = args["0"]
  let slotValue = args["as"]
  AddSlot(this, slotName, slotValue)

  return Null
}))

AddSlot(Objekt, toObject("getSlot"), builtInFunc(function(args): IObject {
  let slotName = args["0"]
  return GetSlot(this, slotName)
}))

AddSlot(Objekt, toObject("objectId"), builtInFunc(function(): IObject {
  return toObject(this.objectId)
}))

/**
 * Container object for all built-in methods we will be exposing to the user
 */
let BuiltIn = NewObject(Objekt, null, {objectName: "BuiltIn"})

AddSlot(BuiltIn, toObject("numberOp"), builtInFunc(function(args): IObject {
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

AddSlot(BuiltIn, toObject("numberToString"), builtInFunc(function(args): IObject {
  let num = args["number"]
  return toObject("" + num.data)
}))

/**
 * String BuiltIns
 */

AddSlot(BuiltIn, toObject("stringOp"), builtInFunc(function(args): IObject {
  let left = args["left"]
  let op = args["op"]
  let right = args["right"]

  switch(op.data) {
    case "+":
      return toObject(left.data + right.data)
    default:
      throw new Error(`Unknown operand on strings '${op}'`)
  }
}))

/**
 * Other BuiltIns
 */

AddSlot(BuiltIn, toObject("puts"), builtInFunc(function(args): IObject {
  console.log(args["message"].toString())
  return Null
}))

/**
 * Array BuiltIns
 */

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
AddSlot(Array, toObject("new"), builtInFunc(function(args): IObject {
  let array = []

  for(var slotName in args) {
    array[slotName] = args[slotName]
  }

  return NewObject(Array, array)
}))

AddSlot(BuiltIn, toObject("arrayLength"), builtInFunc(function(args): IObject {
  return toObject(args["array"].data.length)
}))

AddSlot(BuiltIn, toObject("arrayPush"), builtInFunc(function(args): IObject {
  let array = args["array"]
  array.data.push(args["object"])
  return array
}))

AddSlot(BuiltIn, toObject("arrayPop"), builtInFunc(function(args): IObject {
  let array = args["array"]
  return array.data.pop() || Null
}))

/**
 * Debugging BuiltIns
 */

/**
 * DEBUGGING
 *  Should probably remove later
 *  Print a reverse-indented trace of the current scope stack
 */
AddSlot(BuiltIn, toObject("debugObjectSlots"), builtInFunc(function(args): IObject {
  let startSpace = args["object"]
  let space = startSpace
  let depth = 0
  let buffer = ""
  let slotsStr = ""

  while(space) {
    buffer = "-".repeat(depth)
    slotsStr = arrayFrom(space.slots.keys()).join(", ")
    console.log("%s %s [%o]", buffer, space, slotsStr)

    if(space === World) {
      break
    }

    depth += 1
    space = space.parents[0]
  }

  return Null
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
var World = NewObject(Objekt, null, {objectName: "World"})
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
