import * as util from "util"

/**
 * An internal-only type-checker on the objects we build in the typescript layer.
 */
interface IObject {
  parents: IObject[]
  slots: {}

  // `data` is internal-only storage of the Javascript value that this object
  // represents, used e.g. for Number and String
  data: any
}

/**
 * Create a new object from a given parent.
 * Can be used to pre-fill the initial set of slots.
 * The `data` parameter is meant for internal use only, as a pointer
 * to the Javascript value of a given object, e.g. a number (1) or a string ("").
 */
function NewObject(parent: IObject, slots = {}, data = null): IObject {
  return {
    parents: (parent ? [parent] : []),
    slots: slots,
    data: data
  }
}

/**
 * Given an object, a message name, a set of arguments,
 * send the message to the object. This will work its way up the parent tree
 * looking for the object that responds to this message, returning the result
 */
function SendMessage(object, message, args = {}) {
}

/**
 * The base of all objects. Should not ever be used directly.
 * Provides the slots for Object, through which everything else should build off of.
 */
let ObjectBase = NewObject(null)

// Sorry, this can't be "Object" in javascript land. That object is already taken
// and will cause weird problems if we try to reuse it.
// This will be properly renamed back to "Object" when in the language.
let Objekt = NewObject(ObjectBase)

let Null = NewObject(Objekt, {}, null)
let True = NewObject(Objekt, {}, true)
let False = NewObject(Objekt, {}, false)

let Number = NewObject(Objekt, {}, 0)
let String = NewObject(Objekt, {}, "")

/**
 * Mapping of the results of (typeof object) to our internal
 * object type representation.
 */
let typeMapping = {
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
    return NewObject(parentObject, {}, nativeValue)
  }

  throw new Error(util.format("Don't know how to convert from native type %o", typeof nativeValue))
}

export {
  IObject,
  NewObject,
  SendMessage,
  toObject,
  Objekt,
  Null,
  True,
  False,
  Number,
  String,
}
