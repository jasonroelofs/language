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
  // What's the user-visible name of this object?
  // At run-time, set on assignment. In the core, set via this option to NewObject.
  objectName?: string

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
    return this.data
  } else if(this === Null) {
    return "null"
  } else {
    let objName = SendMessage(this, ToObject("objectName"))
    if(objName) {
      return objName.data
    } else {
      // This blasts the whole structure which can be very verbose.
      return this
    }
  }
}

// Every object gets a unique ID
// The first 100 are reserved for internal use
// TODO Not multi-interpreter or thread safe at all :D
var objectIdSeq = 100;

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

  let obj = {
    parents: (parent ? [parent] : []),
    slots: new Map(),
    metaSlots: new Map(),
    objectId: objId,
    data: data,
    codeBlock: false,
    builtIn: false,
    toString: baseToString,
  }

  if(attrs && attrs.objectName) {
    AddSlot(obj, ToObject("objectName"), ToObject(attrs.objectName))
  }

  return obj
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
function AddSlot(receiver: IObject, message: IObject, value: IObject, comments: IObject = Null) {
  let metaSlot = NewObject(Slot)
  metaSlot.astNode = value.astNode
  metaSlot.slots.set("value", value)
  metaSlot.slots.set("comments", comments)

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
 * The base of all objects. Should not ever be used directly.
 * Provides the slots for Object, through which everything else should build off of.
 */
var ObjectBase = NewObject(null, null, {objectId: 0})

// Sorry, this can't be "Object" in javascript land. That name is already taken
// and will cause weird problems if we try to reuse it.
// This will be properly renamed back to "Object" when in the language.
var Objekt = NewObject(ObjectBase, null, {objectName: "Object", objectId: 1})

var Null = NewObject(Objekt, null, {objectName: "Null", objectId: 2})
var True = NewObject(Objekt, true, {objectName: "True", objectId: 3})
var False = NewObject(Objekt, false, {objectName: "False", objectId: 4})

var Number = NewObject(Objekt, 0, {objectName: "Number", objectId: 5})
var String = NewObject(Objekt, "", {objectName: "String", objectId: 6})

var Array = NewObject(Objekt, [], {objectName: "Array", objectId: 7})

var Slot = NewObject(Objekt, null, {objectName: "Slot", objectId: 8})

function ToObject(nativeValue: any): IObject {
  if(nativeValue === true) {
    return True
  }

  if(nativeValue === false) {
    return False
  }

  if(nativeValue === undefined || nativeValue === null) {
    return Null
  }

  if((typeof nativeValue) == "number") {
    return NewObject(Number, nativeValue)
  }

  if((typeof nativeValue) == "string") {
    return NewObject(String, nativeValue)
  }

  if(isArray(nativeValue) || (Symbol.iterator in nativeValue)) {
    let array = []

    for(var entry of nativeValue) {
      array.push(ToObject(entry))
    }

    return NewObject(Array, array)
  }

  // Already an Object, pass it through
  if('objectId' in nativeValue) {
    return nativeValue
  }

  throw new Error(util.format("Don't know how to convert from native type %o", typeof nativeValue))
}

export {
  IObject,
  NewObject,
  SendMessage,
  AddSlot,
  RemoveSlot,
  GetSlot,
  AddParent,
  EachParent,
  FindIn,
  ObjectIs,
  ToObject,
  ObjectBase,
  Objekt,
  Slot,
  Null,
  True,
  False,
  Number,
  String,
  Array,
}
