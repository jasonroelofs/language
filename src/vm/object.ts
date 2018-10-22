import * as util from "util"

/**
 * An internal-only type-checker on the objects we build in the typescript layer.
 */
interface IObject {
  parents: IObject[]

  // Map an object key to an object value. The key should be a String.
  slots: Map<IObject, IObject>

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
  let message = toObject(messageName)

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
function AddSlot(receiver: IObject, message: string | IObject, value: IObject) {
  receiver.slots.set(toObject(message), value)
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

let Null = NewObject(Objekt, null)
let True = NewObject(Objekt, true)
let False = NewObject(Objekt, false)

let Number = NewObject(Objekt, 0)
let String = NewObject(Objekt, "")

/**
* As an easy performance win and a way to simplify key lookups
* in things like arguments and slots, we will take String literals and
* store their objects as they are needed, allowing a quick look-up to return
* the same String object for every place the string literal is used in the code.
*/
let internedStrings = new Map<string, IObject>();

/**
 * If the given string value is not intern'd already, do so,
 * otherwise return the currently stored IObject for that string input.
 * This should only be called in places where it is safe to add new interned
 * strings to the system, as they will never be garbage collected.
 *
 * To just do a lookup, see FindInternedString.
 */
function InternString(value: string): IObject {
  console.log("Interning the string %o", value)

  if(!internedStrings.has(value)) {
    let strObj = NewObject(String, value)
    internedStrings.set(value, strObj)
  }

  return internedStrings.get(value);
}

/**
 * Find if there's an intern'd value for this string.
 * If not, returns javascript NULL (Not the language's NULL).
 * This function intended to only be called from the JS layer.
 */
function FindInternedString(value: string): IObject {
  if(internedStrings.has(value)) {
    return internedStrings.get(value)
  } else {
    return null
  }
}

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

  if((typeof nativeValue) == "string") {
    return FindInternedString(nativeValue) || NewObject(String, nativeValue)
  }

  if((typeof nativeValue) == "number") {
    return NewObject(Number, nativeValue)
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
  InternString,
  FindInternedString,
  toObject,
  Objekt,
  Null,
  True,
  False,
  Number,
  String,
}
