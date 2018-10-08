import * as util from "util"
import { ParameterNode, Expression } from "@compiler/ast"

enum ObjectType {
  Null     = "Null",
  Boolean  = "Boolean",
  Number   = "Number",
  String   = "String",
  Block    = "Block",
}

interface Object {
  type: ObjectType
}

interface ValueObject extends Object {
  value: any
}

interface BlockObject extends Object {
  // How many arguments does this block have
  parameters: ParameterNode[]

  // Body of the block, in a list of AST expressions
  body: Expression[]
}

let Null = { type: ObjectType.Null }
let True : ValueObject = { type: ObjectType.Boolean, value: true }
let False : ValueObject = { type: ObjectType.Boolean, value: false }

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
    return { type: objectType, value: nativeValue } as ValueObject
  }

  throw new Error(util.format("Don't know how to convert from native type %o", typeof nativeValue))
}

export {
  ObjectType,
  Object,
  ValueObject,
  BlockObject,
  toObject,
  Null,
  True,
  False
}
