import * as util from "util"
import * as errors from "@vm/errors"
import { Node } from "@compiler/ast"
import { isArray } from "@vm/js_core"

/**
 * An internal-only type-checker on the objects we build in the typescript layer.
 */
interface IObject {
  parents: IObject[]

  // TODO: Slot keys should be themselves IObjects but we don't have logic set up
  // yet to hash objects into good look-up keys. For now forcing to a string in
  // javascript.
  slots: Map<string, IObject>

  // This is a mapping of a slot name to some metadata we keep around for that slot.
  // I'd like this to live with the slot itself somehow but doing that probably requires
  // some extra work to let IObjects be keys (hashing or the like) that I'll get to
  // later. Data in this map is accessible via GetSlot
  metaSlots: Map<string, IObject>

  // Unique identifier for this object
  objectId: number

  // A link back to the section of the AST that led to the creation of this object
  // Can be null
  astNode?: Node

  // `data` is internal-only storage of the Javascript value that this object
  // represents, used e.g. for Number and String
  data: any

  // Flag that this object is actually a block of code that can be itself
  // evaluated.
  codeBlock: boolean

  // Are we wrapping a built-in, pure javascript function?
  builtIn: boolean

  // Output ourselves to the world as a String
  toString(): string
}

interface ObjectAttrs {
  // Should this object have an explicit objectId?
  objectId?: number
}

/**
 * Internal toString implementation of objects in Javascript land.
 * In the language, objects will have a toString message defined to return
 * the string representation of themselves.
 */
let baseToString = function() {
  if(this.data != undefined && this.data != null) {
    if(this.builtIn) {
      return "BuiltIn function"
    } else if(this.codeBlock) {
      return "Code Block"
    } else if(isArray(this.data)) {
      return "Array (" + this.data.length + ")"
    } else {
      return this.data
    }
  } else if(this === Null) {
    return "null"
  } else {
    let objName = SendMessage(this, AsString("objectName"))
    if(objName) {
      return objName.data
    } else {
      // This blasts the whole structure which can be very verbose.
      return util.format(this)
    }
  }
}

// Every object gets a unique ID
// The first 100 are reserved for internal use
// TODO Not multi-interpreter or thread safe at all :D
var objectIdSeq = 100;

// Global memoization of String objects
// Make use of the AsString helper method to make use of this cache.
var cachedStrings: Map<string, IObject> = new Map()

// TODO: WeakMap usage to allow these things to be garbage collected
// over time.
var cachedNumbers: Map<number, IObject> = new Map()

/**
 * Create a new object from a given parent.
 * The `data` parameter is meant for internal use only, as a pointer
 * to the Javascript value of a given object, e.g. a number (1) or a string ("").
 */
function NewObject(parent: IObject, data = null, attrs: ObjectAttrs = null): IObject {
  let objId

  if(attrs && attrs.objectId) {
    objId = attrs.objectId
  } else {
    objId = objectIdSeq++
  }

  return {
    parents: (parent ? [parent] : []),
    slots: new Map(),
    metaSlots: new Map(),
    objectId: objId,
    data: data,
    codeBlock: false,
    builtIn: false,
    toString: baseToString,
  }
}

/**
 * Given an object, a message name, a set of arguments,
 * send the message to the object. This will work its way up the parent tree
 * looking for the object that responds to this message, returning the result.
 * This can return the Javascript `null`. In this case there was no such slot
 * found in the parent tree. This then lets the caller handle this case itself.
 */
function SendMessage(receiver: IObject, messageName: IObject): IObject {
  // TODO Ensure this is a String
  let message = messageName.data

  let hasSlot = FindIn(receiver, (obj) => obj.slots.has(message))

  if(hasSlot) {
    return hasSlot.slots.get(message)
  } else {
    return null
  }
}

type EachParentFunc = (IObject) => void

/**
 * Iterate over an object and all of its parents, depth first, running callbackFunc
 * against each object in the set.
 */
function EachParent(obj: IObject, callbackFunc: EachParentFunc, seen: Set<number> = null) {
  // Protection against lookup loops where parents can point
  // to objects in the current or other parent stacks.
  if(seen == null) {
    seen = new Set<number>()
  }

  if(seen.has(obj.objectId)) {
    return
  }

  seen.add(obj.objectId)

  callbackFunc(obj)

  for(var parent of obj.parents) {
    EachParent(parent, callbackFunc, seen)
  }
}

type FindInCheckFunc = (IObject) => boolean

/**
 * For a given object and a check function, find the first object
 * or the first in it's parents (depth first) that matches the check function.
 * Returns javascript null if no match found.
 */
function FindIn(obj: IObject, checkFunc: FindInCheckFunc, seen: Set<number> = null): IObject {
  let found = null

  EachParent(obj, (o) => {
    // TODO: Is there a nice way to trigger EachParent to cancel
    // any future iterations?
    if(found != null) {
      return
    }

    if(checkFunc(o)) {
      found = o
    }
  })

  return found
}

/**
 * Apply a slot to the given Object.
 * Name of the slot needs to be a String. The value can be any object.
 */
function SetSlot(receiver: IObject, message: IObject, value: IObject, comments: IObject = Null) {
  let metaSlot = NewObject(Slot)
  metaSlot.slots.set("value", value)
  metaSlot.slots.set("comments", comments)
  metaSlot.slots.set("originalValue", CopyObject(value))

  let key = message.data
  receiver.slots.set(key, value)
  receiver.metaSlots.set(key, metaSlot)
}

/**
 * Remove a slot entirely from this object.
 */
function RemoveSlot(receiver: IObject, message: IObject) {
  receiver.slots.delete(message.data)
}

/**
 * Return the internal Slot object that represents the value of a given slot.
 */
function GetSlot(receiver: IObject, slotName: IObject): IObject {
  // TODO: No such slot error?
  return receiver.metaSlots.get(slotName.data) || Null
}

/**
 * Add the given object as the parent of the receiver
 */
function AddParent(receiver: IObject, obj: IObject) {
  receiver.parents.push(obj)
}

/**
 * Is the given object a child of the object in `expected`?
 */
function ObjectIs(obj: IObject, expected: IObject): IObject {
  if(FindIn(obj, (test) => test.objectId == expected.objectId)) {
    return True
  }

  return False
}

/**
 * For a given Object do a deep copy and return a new object with all
 * the same data
 */
function CopyObject(copyFrom: IObject): IObject {
  let newObj = NewObject(copyFrom.parents[0], copyFrom.data)
  newObj.codeBlock = copyFrom.codeBlock
  newObj.builtIn = copyFrom.builtIn

  if(isArray(copyFrom.data)) {
    newObj.data = copyFrom.data.slice(0)
  }

  return newObj
}

/**
 * The base of all objects.
 * Sorry, this can't be "Object" in javascript land. That name is already taken
 * and causes weird compilation problems if we try to reuse it.
 * This will be properly renamed back to "Object" when in the language.
 */
var Objekt = NewObject(null, null, {objectId: 1})

var Null = NewObject(Objekt, null, {objectId: 2})
var True = NewObject(Objekt, true, {objectId: 3})
var False = NewObject(Objekt, false, {objectId: 4})

var Number = NewObject(Objekt, 0, {objectId: 5})
var String = NewObject(Objekt, "", {objectId: 6})

var Array = NewObject(Objekt, [], {objectId: 7})

var Slot = NewObject(Objekt, null, {objectId: 8})

var Block = NewObject(Objekt, null, {objectId: 9})

// Assign objectName values for each of our built-ins
// Order of operations is important here as we need to not try to use String
// before it's been defined.
SetSlot(Objekt, AsString("objectName"), AsString("Object"))
SetSlot(Null, AsString("objectName"), AsString("Null"))
SetSlot(True, AsString("objectName"), AsString("True"))
SetSlot(False, AsString("objectName"), AsString("False"))
SetSlot(Number, AsString("objectName"), AsString("Number"))
SetSlot(String, AsString("objectName"), AsString("String"))
SetSlot(Array, AsString("objectName"), AsString("Array"))
SetSlot(Slot, AsString("objectName"), AsString("Slot"))
SetSlot(Block, AsString("objectName"), AsString("Block"))

function ToObject(nativeValue: any): IObject {
  if(nativeValue === undefined || nativeValue === null) {
    return Null
  }

  // Already an Object, pass it through
  if(nativeValue.objectId) {
    return nativeValue
  }

  if(nativeValue === true) {
    return True
  }

  if(nativeValue === false) {
    return False
  }

  if((typeof nativeValue) == "number") {
    return AsNumber(nativeValue)
  }

  if((typeof nativeValue) == "string") {
    if(cachedStrings.has(nativeValue)) {
      return cachedStrings.get(nativeValue)
    }

    return NewObject(String, nativeValue)
  }

  if(isArray(nativeValue) || (Symbol.iterator in nativeValue)) {
    let array = []

    for(var entry of nativeValue) {
      array.push(ToObject(entry))
    }

    return NewObject(Array, array)
  }

  throw new Error(util.format("Don't know how to convert from native type %o", typeof nativeValue))
}

// Given a Javascript string, look first in the cache of intern'd strings
// that match the value, otherwise make a new String and put it in the cache.
//
// NOTE: Only use this method where it is ok for the String to be intern'd,
// and to NOT use it anywhere else or memory leaks will be possible.
function AsString(str: string): IObject {
  if(cachedStrings.has(str)) {
    return cachedStrings.get(str)
  }

  let strObj = NewObject(String, str)
  cachedStrings.set(str, strObj)
  return strObj
}

// As with strings, lets also memoize numbers so we aren't generating
// thousands of equal objects for the number 1
function AsNumber(num: number): IObject {
  if(cachedNumbers.has(num)) {
    return cachedNumbers.get(num)
  }

  let numObj = NewObject(Number, num)
  cachedNumbers.set(num, numObj)
  return numObj
}

export {
  IObject,
  NewObject,
  CopyObject,
  SendMessage,
  SetSlot,
  RemoveSlot,
  GetSlot,
  AddParent,
  EachParent,
  FindIn,
  ObjectIs,
  ToObject,
  AsString,
  Objekt,
  Slot,
  Null,
  True,
  False,
  Number,
  String,
  Array,
  Block,
}
