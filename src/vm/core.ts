import * as path from "path"

import Platform from "@vm/platform"
import {
  NewObject, ToObject, AsString,
  IObject, Objekt,
  Number, String, Array, Block,
  True, False, Null,
  SetSlot, GetSlot, EachParent, FindIn, ObjectIs,
  SendMessage,
} from "@vm/object"
import * as errors from "@vm/errors"
import { isArray, arrayFrom } from "@vm/js_core"

//
// Our core set of built-ins
//

type BuiltInFunctionT = (space: IObject, vm) => IObject

// Define a Javascript function to properly expose it
// to the language runtime as an executable block.
function BuiltInFunc(func): IObject { // : BuiltInFunctionT): IObject {
  let value = NewObject(Block, func)
  value.codeBlock = true
  value.builtIn = true

  SetSlot(value, AsString("call"), value)

  return value
}

// For a set of arguments provided to a built-in function, pull out the keys
// provided in argKeys and throw an exception if such key is not found.
// An array is returned with the extracted values provided in the same order
// as argKeys.
//
// This expects a Space object containing the values as immediate slots.
// It does not do parent lookups.
function extractParams(space, ...argKeys) {
  let ret = []
  for(let key of argKeys) {
    if(!space.slots.has(key)) {
      throw new Error(`[BuiltIn Error] Expected argument '${key}' not found in the provided arguments: `) // ${Object.keys(args).join(", ")}`)
    }

    ret.push(space.slots.get(key))
  }

  return ret
}

// Get an argument from the passed in Space, returning javascript `null` if
// no such value is given.
// Use this over extractParams if the parameter in question is not required.
function getArgument(space, name) {
  return space.slots.get(name)
}

/**
 * Create and return a new object with the current object as the first
 * parent, and all provided slots added to the new object.
 */
SetSlot(Objekt, AsString("new"), BuiltInFunc(function(space, vm): IObject {
  let obj = NewObject(this)
    /*
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
      SetSlot(obj, ToObject(key), vm._evalNode(slot.astNode))
    }
  })
     */

  // Then apply the values provided to us from the parameters to .new()
  // to ensure we overwrite any matching slots
  setSlots(obj, space)

  return obj
}))

SetSlot(Objekt, AsString("setSlots"), BuiltInFunc(function(space): IObject {
  setSlots(this, space)

  return Null
}))

function setSlots(obj: IObject, space: IObject) {
  // See VM.startBlock for how this specific slot is set
  // This list is used to pull other slots out of this space as the arguments
  // actually passed into the setSlots message
  let argumentNames = SendMessage(space, AsString("__argumentNames__"))
  let comment
  let key: string
  let name: IObject

  for(name of argumentNames.data) {
    key = name.data

    if(space.metaSlots.has(key)) {
      let mSlot = space.metaSlots.get(key)
      comment = SendMessage(mSlot, AsString("comments"))
    } else {
      comment = null
    }

    SetSlot(obj, name, space.slots.get(key), ToObject(comment))
  }
}

/**
 * Send a message to this object
 * Use this to programmatically send messages to objects or to send messages
 * that aren't proper identifiers.
 */
SetSlot(Objekt, AsString("send"), BuiltInFunc(function(space, vm): IObject {
  let obj = this
  let message = getArgument(space, "message") || getArgument(space, "0")
  let slotValue = SendMessage(obj, message)

  if(!slotValue) {
    throw new errors.NoSuchMessageError(obj, message)
  }

  if(slotValue.codeBlock) {
    // TODO: What if someone does Object.send("new"), e.g. triggers
    // one of the view top-level built-ins?
    // Leaning towards ignoring as I will eventually allow support for
    // arbitrary parameters to a block which will solve this problem.
    let params = []

    /*
     * Replace with the same logic in setSlots above
    for(let key in args) {
      if(key == "0") { continue }

      params.push([ToObject(key), args[key]])
    }
     */

    let codeBlock = slotValue

    return vm.evalBlockWithArgs(obj, codeBlock, params)
  }

  return slotValue
}))

/**
 * Container object for all built-in methods we will be exposing to the user.
 */
let BuiltIn = NewObject(Objekt, null, {objectId: 99})
SetSlot(BuiltIn, AsString("objectName"), AsString("BuiltIn"))

/**
 * World / Global BuiltIns
 */

SetSlot(BuiltIn, AsString("exit"), BuiltInFunc(function(space): IObject {
  let status = getArgument(space, "status") || getArgument(space, "0")
  process.exit(status.data)
  return Null
}))

// Load a language file into the space given in `into`.
SetSlot(BuiltIn, AsString("load"), BuiltInFunc(function(args, meta = {}, vm): IObject {
  let [filePath, into] = extractParams(args, "filePath", "into")

  return vm.loadFile(filePath, into)
}))

/**
 * Object BuiltIns
 */
SetSlot(BuiltIn, AsString("objectId"), BuiltInFunc(function(space): IObject {
  let [obj] = extractParams(space, "object")

  return ToObject(obj.objectId)
}))

SetSlot(BuiltIn, AsString("objectParents"), BuiltInFunc(function(space): IObject {
  let [obj] = extractParams(space, "object")

  return ToObject(obj.parents)
}))

SetSlot(BuiltIn, AsString("objectSetSlot"), BuiltInFunc(function(space): IObject {
  let [obj, slotName, slotValue] = extractParams(space, "object", "name", "as")

  SetSlot(obj, slotName, slotValue)

  return Null
}))

SetSlot(BuiltIn, AsString("objectGetSlot"), BuiltInFunc(function(space): IObject {
  let [obj, slotName] = extractParams(space, "object", "name")
  return GetSlot(obj, slotName)
}))

SetSlot(BuiltIn, AsString("objectGetSlotNames"), BuiltInFunc(function(space): IObject {
  let [obj, includeParents] = extractParams(space, "object", "includeParents")

  if(includeParents == True) {
    let allSlots = []

    EachParent(obj, (o) => {
      allSlots = allSlots.concat(arrayFrom(o.slots.keys()))
    })

    return ToObject(allSlots)
  } else {
    return ToObject(obj.slots.keys())
  }
}))

SetSlot(BuiltIn, AsString("objectHasSlot"), BuiltInFunc(function(space): IObject {
  let [obj, slotName] = extractParams(space, "object", "slotName")

  return FindIn(obj, (o) => o.slots.has(slotName.data)) ? True : False
}))

SetSlot(BuiltIn, AsString("objectIs"), BuiltInFunc(function(space): IObject {
  let [obj, expected] = extractParams(space, "object", "type")

  return ObjectIs(obj, expected)
}))


/**
 * Number BuiltIns
 */

SetSlot(BuiltIn, AsString("numberOp"), BuiltInFunc(function(scope): IObject {
  let [left, op, right] = extractParams(scope, "left", "op", "right")

  switch(op.data) {
    case "+":
      return ToObject(left.data + right.data)
    case "-":
      return ToObject(left.data - right.data)
    case "*":
      return ToObject(left.data * right.data)
    case "/":
      return ToObject(left.data / right.data)
    case ">":
      return ToObject(left.data > right.data)
    case ">=":
      return ToObject(left.data >= right.data)
    case "<":
      return ToObject(left.data < right.data)
    case "<=":
      return ToObject(left.data <= right.data)
    case "==":
      return ToObject(left.data == right.data)
    case "!=":
      return ToObject(left.data != right.data)
    default:
      throw new Error(`Unknown operand on numbers '${op}'`)
  }
}))

SetSlot(BuiltIn, AsString("numberTimes"), BuiltInFunc(function(space, vm): IObject {
  let [count, block] = extractParams(space, "count", "block")

  let rawCount = count.data

  for(let i = 0; i < rawCount; i++) {
    vm.evalBlockWithArgs(null, block, [])
  }

  return count
}))

SetSlot(BuiltIn, AsString("numberToString"), BuiltInFunc(function(space): IObject {
  let [num] = extractParams(space, "number")
  return ToObject("" + num.data)
}))

/**
 * String BuiltIns
 */

SetSlot(BuiltIn, AsString("stringOp"), BuiltInFunc(function(space): IObject {
  let [left, op, right] = extractParams(space, "left", "op", "right")

  switch(op.data) {
    case "+":
      return ToObject(left.data + right.data)
    case "==":
      return ToObject(left.data == right.data)
    default:
      throw new Error(`Unknown operand on strings '${op}'`)
  }
}))

/**
 * Other BuiltIns
 */

SetSlot(BuiltIn, AsString("puts"), BuiltInFunc(function(space): IObject {
  let msg = extractParams(space, "message")
  console.log(msg.toString())
  return Null
}))

SetSlot(BuiltIn, AsString("print"), BuiltInFunc(function(space): IObject {
  // TODO This is not web safe.
  let msg = extractParams(space, "message")
  process.stdout.write(msg.toString())
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
SetSlot(Array, AsString("new"), BuiltInFunc(function(space): IObject {
  let array = []

    /*
     * Replace with setSlots logic above
  for(var slotName in args) {
    array[slotName] = args[slotName]
  }
     */

  return NewObject(Array, array)
}))

SetSlot(BuiltIn, AsString("arrayGet"), BuiltInFunc(function(space): IObject {
  let [array, index] = extractParams(space, "array", "index")

  // TODO index needs to be a Number
  return array.data[index.data]
}))

SetSlot(BuiltIn, AsString("arraySet"), BuiltInFunc(function(space): IObject {
  let [array, index, value] = extractParams(space, "array", "index", "to")

  // TODO index needs to be a Number
  array.data[index.data] = value
  return value
}))

SetSlot(BuiltIn, AsString("arrayEach"), BuiltInFunc(function(space, vm): IObject {
  let [array, block] = extractParams(space, "array", "block")

  let parameters = SendMessage(block, AsString("parameters")).data
  let paramName = ToObject(parameters[0].name)

  for(var entry of array.data) {
    vm.evalBlockWithArgs(null, block, [[paramName, entry]])
  }

  return Null
}))

SetSlot(BuiltIn, AsString("arrayPush"), BuiltInFunc(function(space): IObject {
  let [array, obj] = extractParams(space, "array", "object")
  array.data.push(obj)
  return array
}))

SetSlot(BuiltIn, AsString("arrayPop"), BuiltInFunc(function(space): IObject {
  let [array] = extractParams(space, "array")
  return array.data.pop() || Null
}))

SetSlot(BuiltIn, AsString("arraySlice"), BuiltInFunc(function(space): IObject {
  let [array, start, end] = extractParams(space, "array", "start", "end")

  if(end === Null) {
    return ToObject(array.data.slice(start.data))
  } else {
    return ToObject(array.data.slice(start.data, end.data))
  }
}))

SetSlot(BuiltIn, AsString("arrayLength"), BuiltInFunc(function(space): IObject {
  let [array] = extractParams(space, "array")

  return ToObject(array.data.length)
}))

/**
 * Time / Date BuiltIns
 */

// Return the current unix timestamp (milliseconds since epoc: Jan 1, 1970)
SetSlot(BuiltIn, AsString("timeUTC"), BuiltInFunc(function(): IObject {
  return ToObject(Date.now())
}))

/**
 * File BuiltIns
 */

// Supports a single path, multiple paths, a single glob, or multiple globs.
// Returns an array of file paths.
SetSlot(BuiltIn, AsString("fileSearch"), BuiltInFunc(function(space): IObject {
  let [glob] = extractParams(space, "glob")
  let rawEntries = []

  // TODO Each entry needs to be a String or this will explody
  if(isArray(glob.data)) {
    rawEntries = glob.data.map(entry => path.normalize(entry.data))
  } else {
    rawEntries = [path.normalize(glob.data)]
  }

  return ToObject(Platform.fileSearch(rawEntries))
}))

SetSlot(BuiltIn, AsString("fileIsDirectory"), BuiltInFunc(function(space): IObject {
  let path = getArgument(space, "path") || getArgument(space, "0")

  try {
    return ToObject(Platform.isDirectory(path.data))
  } catch {
    // If nothing exists at the given path...
    return False
  }
}))

/**
 * Debugging BuiltIns
 */

/**
 * DEBUGGING
 *  Should probably remove later
 *  Print a reverse-indented trace of the current scope stack
 */
SetSlot(BuiltIn, AsString("debugObjectSlots"), BuiltInFunc(function(space): IObject {
  let obj = getArgument(space, "object") || getArgument(space, "0")
  let depth = 0
  let buffer = ""
  let slotsStr = ""

  printObjSlots(obj, depth)

  return Null
}))

function printObjSlots(obj: IObject, depth: number) {
  if(!obj) { return }

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

// Requires running the system through `node --inspect` to do anything.
SetSlot(BuiltIn, AsString("debugger"), BuiltInFunc(function(): IObject {
  debugger
  return Null
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
var World = NewObject(Objekt, null, {objectId: 20})
SetSlot(World, AsString("objectName"), AsString("World"))

SetSlot(World, AsString("World"), World)

SetSlot(World, AsString("BuiltIn"), BuiltIn)

SetSlot(World, AsString("Object"), Objekt)
SetSlot(World, AsString("Number"), Number)
SetSlot(World, AsString("String"), String)
SetSlot(World, AsString("Array"),  Array)

SetSlot(World, AsString("True"),   True)
SetSlot(World, AsString("False"),  False)
SetSlot(World, AsString("Null"),   Null)

// World.try is our exception handling catching and handling tool.
// It takes a block in which to execute that may throw an exception.
// If `catch` is provided, it is called with the error.
// If `finally` is provided, it is called after any `catch`.
// Finally the value is returned from `try` or `catch` if there was an error.
SetSlot(World, AsString("try"), BuiltInFunc(function(args, meta = {}, vm): IObject {
  let block = args["block"] || args["0"]
  let catchBlock = args["catch"]
  let finallyBlock = args["finally"]
  let result = Null

  try {
    result = vm.evalBlockWithArgs(null, block, [])
  } catch(e) {
    if(catchBlock) {
      result = vm.evalBlockWithArgs(null, catchBlock, [[AsString("error"), e]])
    } else {
      throw(e)
    }
  } finally {
    if(finallyBlock) {
      vm.evalBlockWithArgs(null, finallyBlock, [])
    }
  }

  return result
}))

// Use World.throw to throw an exception.
// The exception can be any object and does not have to explicitly be an Exception
// object or one of its children.
SetSlot(World, AsString("throw"), BuiltInFunc(function(args, meta = {}, vm): IObject {
  let exception = args["0"]

  vm.throwException(exception)

  return Null
}))

// If anything changes on our base objects, make sure they get
// re-exported here.
export {
  Objekt,
  World,
  Array,
  BuiltIn,
  BuiltInFunc,
}
