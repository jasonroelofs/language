import * as util from "util"

/**
 * An internal-only type-checker on the objects we build in the typescript layer.
 */
interface IObject {
  parents: IObject[]
  slots: Map<String, IObject>

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
  } else {
    return this
  }
}

/**
 * Create a new object from a given parent.
 * Can be used to pre-fill the initial set of slots.
 * The `data` parameter is meant for internal use only, as a pointer
 * to the Javascript value of a given object, e.g. a number (1) or a string ("").
 */
function NewObject(parent: IObject, slots = {}, data = null): IObject {
  // This can hopefully be soon replaced with `Object.entries`
  let slotMap = new Map()

  Object.keys(slots).forEach(key => {
    slotMap.set(key, slots[key])
  })

  return {
    parents: (parent ? [parent] : []),
    slots: slotMap,
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
function SendMessage(receiver: IObject, message: string): IObject {
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
