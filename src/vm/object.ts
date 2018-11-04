import * as util from "util"
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

/**
 * All objects should be serializable into a string format for easy
 * debugging. This is the base form of toString that any object will use
 * if the `toString` message isn't otherwise defined.
 */
let baseToString = function() {
  if(this.data != undefined && this.data != null) {
    return this.data
  } else if(this === Null) {
    return "null"
  } else {
    return this
  }
}

/**
 * Create a new object from a given parent.
 * The `data` parameter is meant for internal use only, as a pointer
 * to the Javascript value of a given object, e.g. a number (1) or a string ("").
 */
var objectIdSeq = 0; // TODO Not multi-interpreter or thread safe at all :D
function NewObject(parent: IObject, data = null): IObject {
  return {
    parents: (parent ? [parent] : []),
    slots: new Map(),
    metaSlots: new Map(),
    objectId: objectIdSeq++,
    data: data,
    codeBlock: false,
    builtIn: false,
    toString: baseToString,
  }
}

/**
 * Given an object, a message name, a set of arguments,
 * send the message to the object. This will work its way up the parent tree
 * looking for the object that responds to this message, returning the result
 */
function SendMessage(receiver: IObject, messageName: string | IObject): IObject {
  // TODO Ensure this is a String
  let message = toObject(messageName).data

  if (receiver.slots.has(message)) {
    return receiver.slots.get(message)
  } else if (receiver.parents.length == 0) {
    // TODO: No slot error of some sort
    return Null
  } else {
    let fromParent = Null

    for(var parent of receiver.parents) {
      fromParent = SendMessage(parent, message)

      if(fromParent != Null) {
        break
      }
    }

    return fromParent
  }
}

/**
 * Apply a slot to the given Object.
 * Name of the slot needs to be a String. The value can be any object.
 */
function AddSlot(receiver: IObject, message: string | IObject, value: IObject, comments: IObject = Null) {
  let metaSlot = NewObject(Slot)
  metaSlot.slots.set("value", value)
  metaSlot.slots.set("comments", comments)

  let key = toObject(message).data
  receiver.slots.set(key, value)
  receiver.metaSlots.set(key, metaSlot)
}

/**
 * Return the internal Slot object that represents the value of a given slot.
 */
function GetSlot(receiver: IObject, slotName: string | IObject): IObject {
  // TODO: No such slot error?
  return receiver.metaSlots.get(toObject(slotName).data) || Null
}

/**
 * The base of all objects. Should not ever be used directly.
 * Provides the slots for Object, through which everything else should build off of.
 */
let ObjectBase = NewObject(null)

// Sorry, this can't be "Object" in javascript land. That name is already taken
// and will cause weird problems if we try to reuse it.
// This will be properly renamed back to "Object" when in the language.
let Objekt = NewObject(ObjectBase)

let Slot = NewObject(Objekt)

let Null = NewObject(Objekt, null)
let True = NewObject(Objekt, true)
let False = NewObject(Objekt, false)

let Number = NewObject(Objekt, 0)
let String = NewObject(Objekt, "")

let Array = NewObject(Objekt, [])

/**
 * Mapping of the results of (typeof object) to our internal
 * object type representation.
 */
const typeMapping = {
  "number": Number,
  "string": String,
}

function toObject(nativeValue: any): IObject {
  if(nativeValue === true) {
    return True
  }

  if(nativeValue === false) {
    return False
  }

  if(nativeValue === undefined || nativeValue === null) {
    return Null
  }

  let parentObject = typeMapping[typeof nativeValue]

  if(parentObject) {
    return NewObject(parentObject, nativeValue)
  }

  if(isArray(nativeValue)) {
    let array = []

    nativeValue.forEach((entry) => {
      array.push(toObject(entry))
    })

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
  GetSlot,
  toObject,
  Objekt,
  Slot,
  Null,
  True,
  False,
  Number,
  String,
  Array,
}
