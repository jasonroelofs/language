
enum ObjectType {
  Null     = "Null",
  Boolean  = "Boolean",
  Number   = "Number"
}

interface Object {
  type: ObjectType
  value: any
}

let Null = { type: ObjectType.Null, value: null }
let True = { type: ObjectType.Boolean, value: true }
let False = { type: ObjectType.Boolean, value: false }

export { ObjectType, Object, Null, True, False }
