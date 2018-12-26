import * as fastGlob from "fast-glob"
import * as fs from "fs"
import * as path from "path"
import {
  NewObject, ToObject, IObject, ObjectBase, Objekt,
  Number, String, Array,
  True, False, Null,
  AddSlot, GetSlot, EachParent, FindIn, ObjectIs,
  SendMessage,
} from "@vm/object"
import { isArray, arrayFrom } from "@vm/js_core"

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
AddSlot(Objekt, ToObject("new"), builtInFunc(function(args, meta = {}, vm): IObject {
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
      AddSlot(obj, ToObject(key), vm._evalNode(slot.astNode))
    }
  })

  // Then apply the values provided to us from the parameters to .new()
  // to ensure we overwrite any matching slots
  addSlots(obj, args, meta)

  return obj
}))

AddSlot(Objekt, ToObject("addSlots"), builtInFunc(function(args, meta = {}): IObject {
  addSlots(this, args, meta)

  return Null
}))

function addSlots(obj: IObject, args, meta = {}) {
  var comment

  for(var slotName in args) {
    comment = meta[slotName] ? meta[slotName].comment : null
    AddSlot(obj, ToObject(slotName), args[slotName], ToObject(comment))
  }
}

/**
 * Send a message to this object
 * Use this to programmatically send messages to objects or to send messages
 * that aren't proper identifiers.
 */
AddSlot(Objekt, ToObject("send"), builtInFunc(function(args, meta = {}, vm): IObject {
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

      params.push([ToObject(key), args[key]])
    }

    let codeBlock = slotValue

    // Unwrap any ActivationRecord we run into
    // TODO: ICK, too much internal knowledge required here
    if(slotValue.parents[0] == vm.ActivationRecord) {
      codeBlock = SendMessage(slotValue, ToObject("block"))
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
 * World / Global BuiltIns
 */

AddSlot(BuiltIn, ToObject("exit"), builtInFunc(function(args): IObject {
  let status = args["status"] || args["0"]
  process.exit(status.data)
  return Null
}))

/**
 * Object BuiltIns
 */
AddSlot(BuiltIn, ToObject("objectId"), builtInFunc(function(args): IObject {
  let [obj] = extractParams(args, "object")

  return ToObject(obj.objectId)
}))

AddSlot(BuiltIn, ToObject("objectAddSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName, slotValue] = extractParams(args, "object", "name", "as")

  AddSlot(obj, slotName, slotValue)

  return Null
}))

AddSlot(BuiltIn, ToObject("objectGetSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName] = extractParams(args, "object", "name")
  return GetSlot(obj, slotName)
}))

AddSlot(BuiltIn, ToObject("objectGetSlotNames"), builtInFunc(function(args): IObject {
  let [obj, includeParents] = extractParams(args, "object", "includeParents")

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

AddSlot(BuiltIn, ToObject("objectHasSlot"), builtInFunc(function(args): IObject {
  let [obj, slotName] = extractParams(args, "object", "slotName")

  return FindIn(obj, (o) => o.slots.has(slotName.data)) ? True : False
}))

AddSlot(BuiltIn, ToObject("objectIs"), builtInFunc(function(args): IObject {
  let [obj, expected] = extractParams(args, "object", "type")

  return ObjectIs(obj, expected)
}))


/**
 * Number BuiltIns
 */

AddSlot(BuiltIn, ToObject("numberOp"), builtInFunc(function(args): IObject {
  let left = args["left"]
  let op = args["op"]
  let right = args["right"]

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

AddSlot(BuiltIn, ToObject("numberTimes"), builtInFunc(function(args, meta = {}, vm): IObject {
  let [count, blockAR] = extractParams(args, "count", "block")
  // TODO Need to figure out a way to clean up activation records for built-in arguments.
  // This is a huge GOTCHA!
  // Or maybe evalBlockWithArgs can handle this for us?
  let block = SendMessage(blockAR, ToObject("block"))
  let rawCount = count.data

  for(let i = 0; i < rawCount; i++) {
    vm.evalBlockWithArgs(null, block, [])
  }

  return count
}))

AddSlot(BuiltIn, ToObject("numberToString"), builtInFunc(function(args): IObject {
  let num = args["number"]
  return ToObject("" + num.data)
}))

/**
 * String BuiltIns
 */

AddSlot(BuiltIn, ToObject("stringOp"), builtInFunc(function(args): IObject {
  let [left, op, right] = extractParams(args, "left", "op", "right")

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

AddSlot(BuiltIn, ToObject("puts"), builtInFunc(function(args): IObject {
  console.log(args["message"].toString())
  return Null
}))

AddSlot(BuiltIn, ToObject("print"), builtInFunc(function(args): IObject {
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
AddSlot(Array, ToObject("new"), builtInFunc(function(args): IObject {
  let array = []

  for(var slotName in args) {
    array[slotName] = args[slotName]
  }

  return NewObject(Array, array)
}))

AddSlot(BuiltIn, ToObject("arrayGet"), builtInFunc(function(args): IObject {
  let array = args["array"]
  let index = args["index"]

  // TODO index needs to be a Number
  return array.data[index.data]
}))

AddSlot(BuiltIn, ToObject("arraySet"), builtInFunc(function(args): IObject {
  let array = args["array"]
  let index = args["index"]
  let value = args["to"]

  // TODO index needs to be a Number
  array.data[index.data] = value
  return value
}))

AddSlot(BuiltIn, ToObject("arrayEach"), builtInFunc(function(args, meta = {}, vm): IObject {
  let [array, blockAR] = extractParams(args, "array", "block")

  // Block as passed in from the language is actually an ActivationRecord
  // which we need to unwrap to get the actual block to evaluate.
  let block = SendMessage(blockAR, ToObject("block"))
  let parameters = SendMessage(block, ToObject("parameters")).data
  let paramName = ToObject(parameters[0].name)

  for(var entry of array.data) {
    vm.evalBlockWithArgs(null, block, [[paramName, entry]])
  }

  return Null
}))

AddSlot(BuiltIn, ToObject("arrayPush"), builtInFunc(function(args): IObject {
  let array = args["array"]
  array.data.push(args["object"])
  return array
}))

AddSlot(BuiltIn, ToObject("arrayPop"), builtInFunc(function(args): IObject {
  let array = args["array"]
  return array.data.pop() || Null
}))

AddSlot(BuiltIn, ToObject("arraySlice"), builtInFunc(function(args): IObject {
  let [array, start, end] = extractParams(args, "array", "start", "end")

  if(end === Null) {
    return ToObject(array.data.slice(start.data))
  } else {
    return ToObject(array.data.slice(start.data, end.data))
  }
}))

AddSlot(BuiltIn, ToObject("arrayLength"), builtInFunc(function(args): IObject {
  let [array] = extractParams(args, "array")

  return ToObject(array.data.length)
}))

/**
 * Time / Date BuiltIns
 */

// Return the current unix timestamp (milliseconds since epoc: Jan 1, 1970)
AddSlot(BuiltIn, ToObject("timeUTC"), builtInFunc(function(): IObject {
  return ToObject(Date.now())
}))

/**
 * File BuiltIns
 */

// Supports a single path, multiple paths, a single glob, or multiple globs.
// Returns an array of file paths.
AddSlot(BuiltIn, ToObject("fileSearch"), builtInFunc(function(args): IObject {
  let [glob] = extractParams(args, "glob")
  let rawEntries = []

  // TODO Each entry needs to be a String or this will explody
  if(isArray(glob.data)) {
    rawEntries = glob.data.map(entry => path.normalize(entry.data))
  } else {
    rawEntries = [path.normalize(glob.data)]
  }

  return ToObject(fastGlob.sync(rawEntries))
}))

AddSlot(BuiltIn, ToObject("fileIsDirectory"), builtInFunc(function(args): IObject {
  let path = args["path"] || args["0"]

  try {
    let stats = fs.lstatSync(path.data)
    return ToObject(stats.isDirectory())
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
AddSlot(BuiltIn, ToObject("debugObjectSlots"), builtInFunc(function(args): IObject {
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

// Requires running the system through `node --inspect` to do anything.
AddSlot(BuiltIn, ToObject("debugger"), builtInFunc(function(): IObject {
  debugger
  return Null
}))

/**
 * The World is the top-level, global object and context.
 * All main constants are defined here.
 * The World is alway accessible directly via the 'World' constant.
 */
var World = NewObject(Objekt, null, {objectName: "World", objectId: 20})
AddSlot(World, ToObject("World"), World)

AddSlot(World, ToObject("BuiltIn"), BuiltIn)

AddSlot(World, ToObject("Object"), Objekt)
AddSlot(World, ToObject("Number"), Number)
AddSlot(World, ToObject("String"), String)
AddSlot(World, ToObject("Array"),  Array)

AddSlot(World, ToObject("True"),   True)
AddSlot(World, ToObject("False"),  False)
AddSlot(World, ToObject("Null"),   Null)

// World.load is implemented as a direct built-in instead of a wrapped call because
// we want `load` to evaluate the file in the current space as the call to `load`.
// This may not be the best path here but I don't know if there is a "correct" expectation
// on how something like `load` should work.
AddSlot(World, ToObject("load"), builtInFunc(function(args, meta = {}, vm): IObject {
  let path = args["path"] || args["0"]

  return vm.loadFile(path)
}))

// World.try is our exception handling catching and handling tool.
// It takes a block in which to execute that may throw an exception.
// If `catch` is provided, it is called with the error.
// If `finally` is provided, it is called after any `catch`.
// Finally the value is returned from `try` or `catch` if there was an error.
AddSlot(World, ToObject("try"), builtInFunc(function(args, meta = {}, vm): IObject {
  let block = args["block"] || args["0"]
  let catchBlock = args["catch"]
  let finallyBlock = args["finally"]
  let result = Null

  try {
    result = vm.evalBlockWithArgs(null, block, [])
  } catch(e) {
    if(catchBlock) {
      result = vm.evalBlockWithArgs(null, catchBlock, [[ToObject("error"), e]])
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
AddSlot(World, ToObject("throw"), builtInFunc(function(args, meta = {}, vm): IObject {
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
}
