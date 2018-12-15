import {
  NewObject, toObject, IObject, ObjectBase, Objekt,
  Number, String, Array,
  True, False, Null,
  AddSlot, GetSlot, EachParent, FindIn,
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

// For a set of arguments provided to a built-in function, pull out the keys
// provided in argKeys and throw an exception if such key is not found.
// An array is returned with the extracted values provided in the same order
// as argKeys.
function extractParams(args, ...argKeys) {
  let ret = []
  for(let key of argKeys) {
    if(args[key] == undefined) {
      throw new Error(`[BuiltIn Error] Expected argument '${key}' not found in the provided arguments: ${Object.keys(args).join(", ")}`)
    }

    ret.push(args[key])
  }

  return ret
}

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
AddSlot(Objekt, toObject("new"), builtInFunc(function(args, meta = {}, vm): IObject {
  let obj = NewObject(this)
  let slot

  // Look for slots with defined default values and apply
  // those to this new object first.
  this.slots.forEach((value, key) => {
    // We never apply default values of code blocks slots into child
    // objects as that would break inheritance expectations.
    if(value.codeBlock) {
      return
    }

    slot = this.metaSlots.get(key)

    if(slot && slot.astNode) {
      AddSlot(obj, toObject(key), vm._evalNode(slot.astNode))
    }
  })

  // Then apply the values provided to us from the parameters to .new()
  // to ensure we overwrite any matching slots
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

/**
 * Send a message to this object
 * Use this to programmatically send messages to objects or to send messages
 * that aren't proper identifiers.
 */
AddSlot(Objekt, toObject("send"), builtInFunc(function(args, meta = {}, vm): IObject {
  let obj = this
  let message = args["0"]
  let slotValue = SendMessage(obj, message)

  if(!slotValue) {
    // TODO: raise error: Object does not respond to the `message` message.
    return Null
  }

  if(slotValue.codeBlock) {
    // TODO: What if someone does Object.send("new"), e.g. triggers
    // one of the view top-level built-ins?
    // Leaning towards ignoring as I will eventually allow support for
    // arbitrary parameters to a block which will solve this problem.
    let params = []

    for(let key in args) {
      if(key == "0") { continue }

      params.push([toObject(key), args[key]])
    }

    let codeBlock = slotValue

    // Unwrap any ActivationRecord we run into
    // TODO: ICK, too much internal knowledge required here
    if(slotValue.parents[0] == vm.ActivationRecord) {
      codeBlock = SendMessage(slotValue, toObject("block"))
    }

    return vm.evalBlockWithArgs(obj, codeBlock, params)
  }

  return slotValue
}))

/**
 * Container object for all built-in methods we will be exposing to the user.
 */
let BuiltIn = NewObject(Objekt, null, {objectName: "BuiltIn", objectId: 99})

/**
 * Object BuiltIns
 */
AddSlot(BuiltIn, toObject("objectId"), builtInFunc(function(args): IObject {
  let [obj] = extractParams(args, "object")

  return toObject(obj.objectId)
}))

AddSlot(BuiltIn, toObject("objectAddSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName, slotValue] = extractParams(args, "object", "name", "as")

  AddSlot(obj, slotName, slotValue)

  return Null
}))

AddSlot(Objekt, toObject("objectGetSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName] = extractParams(args, "object", "name")
  return GetSlot(obj, slotName)
}))

AddSlot(Objekt, toObject("objectGetSlotNames"), builtInFunc(function(args): IObject {
  let [obj, includeParents] = extractParams(args, "object", "includeParents")

  if(includeParents == True) {
    let allSlots = []

    EachParent(obj, (o) => {
      allSlots = allSlots.concat(arrayFrom(o.slots.keys()))
    })

    return toObject(allSlots)
  } else {
    return toObject(obj.slots.keys())
  }
}))

AddSlot(BuiltIn, toObject("objectHasSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName] = extractParams(args, "object", "slotName")

  return FindIn(obj, (o) => o.slots.has(slotName.data)) ? True : False
}))

AddSlot(BuiltIn, toObject("objectIs"), builtInFunc(function(args): IObject {
  let [obj, expected] = extractParams(args, "object", "type")

  if(FindIn(obj, (test) => test.objectId == expected.objectId)) {
    return True
  }

  return False
}))


/**
 * Number BuiltIns
 */

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
  let [left, op, right] = extractParams(args, "left", "op", "right")

  switch(op.data) {
    case "+":
      return toObject(left.data + right.data)
    case "==":
      return toObject(left.data == right.data)
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

AddSlot(BuiltIn, toObject("print"), builtInFunc(function(args): IObject {
  // TODO This is not web safe.
  process.stdout.write(args["message"].toString())
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

AddSlot(BuiltIn, toObject("arrayGet"), builtInFunc(function(args): IObject {
  let array = args["array"]
  let index = args["index"]

  // TODO index needs to be a Number
  return array.data[index.data]
}))

AddSlot(BuiltIn, toObject("arraySet"), builtInFunc(function(args): IObject {
  let array = args["array"]
  let index = args["index"]
  let value = args["to"]

  // TODO index needs to be a Number
  array.data[index.data] = value
  return value
}))

AddSlot(BuiltIn, toObject("arrayEach"), builtInFunc(function(args, meta = {}, vm): IObject {
  let [array] = extractParams(args, "array")

  // Block as passed in from the language is actually an ActivationRecord
  // which we need to unwrap to get the actual block to evaluate.
  let block = SendMessage(args["block"], toObject("block"))
  let parameters = SendMessage(block, toObject("parameters")).data
  let paramName = toObject(parameters[0].name)

  for(var entry of array.data) {
    vm.evalBlockWithArgs(null, block, [[paramName, entry]])
  }

  return Null
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

AddSlot(BuiltIn, toObject("arrayLength"), builtInFunc(function(args): IObject {
  let [array] = extractParams(args, "array")

  return toObject(array.data.length)
}))

/**
 * Time / Date BuiltIns
 */

// Return the current unix timestamp (milliseconds since epoc: Jan 1, 1970)
AddSlot(BuiltIn, toObject("timeUTC"), builtInFunc(function(): IObject {
  return toObject(Date.now())
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
  let obj = args["object"] || args["0"]
  let depth = 0
  let buffer = ""
  let slotsStr = ""

  printObjSlots(obj, depth)

  return Null
}))

function printObjSlots(obj: IObject, depth: number) {
  if(!obj) { return }
  if(obj === ObjectBase) { return }

  let buffer = ""

  if(depth > 0) {
    buffer = "-".repeat(depth) + " "
  }

  let slotsStr = arrayFrom(obj.slots.keys()).join(", ")
  console.log("%s%s [%o]", buffer, obj.toString(), slotsStr)

  if(obj === World) {
    return
  }

  for(let p of obj.parents) {
    printObjSlots(p, depth + 1)
  }
}

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
var World = NewObject(Objekt, null, {objectName: "World", objectId: 20})
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
