import * as util from "util"

enum ObjectType {
  Null     = "Null",
  Boolean  = "Boolean",
  Number   = "Number",
  String   = "String",
}

interface Object {
  type: ObjectType
  value: any
}

let Null = { type: ObjectType.Null, value: null }
let True = { type: ObjectType.Boolean, value: true }
let False = { type: ObjectType.Boolean, value: false }

/**
 * Mapping of the results of (typeof object) to our internal
 * object type representation.
 */
let typeMapping = {
  "number": ObjectType.Number,
  "string": ObjectType.String,
}

function toObject(nativeValue: any): Object {
  if(nativeValue === true) {
    return True
  }

  if(nativeValue === false) {
    return False
  }

  if(nativeValue === undefined || nativeValue === null) {
    return Null
  }

  let objectType = typeMapping[typeof nativeValue]

  if(objectType) {
    return { type: objectType, value: nativeValue }
  }

  throw new Error(util.format("Don't know how to convert from native type %o", typeof nativeValue))
}

export { ObjectType, Object, toObject, Null, True, False }
