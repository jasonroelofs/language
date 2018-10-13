import {NewObject, toObject, IObject, Objekt, Number, String} from "@vm/object"

//
// Our core set of built-ins
//

function builtInFunc(func): IObject {
  let value = NewObject(Objekt, {}, func)
  value.codeBlock = true
  value.builtIn = true

  return value
}

Number.slots.set("+", builtInFunc(function(other) {
  return toObject(this.data + other.data)
}))

Number.slots.set("-", builtInFunc(function(other) {
  return toObject(this.data - other.data)
}))

Number.slots.set("*", builtInFunc(function(other) {
  return toObject(this.data * other.data)
}))

Number.slots.set("/", builtInFunc(function(other) {
  return toObject(this.data / other.data)
}))

Number.slots.set(">", builtInFunc(function(other) {
  return toObject(this.data > other.data)
}))

Number.slots.set(">=", builtInFunc(function(other) {
  return toObject(this.data >= other.data)
}))

Number.slots.set("<", builtInFunc(function(other) {
  return toObject(this.data < other.data)
}))

Number.slots.set("<=", builtInFunc(function(other) {
  return toObject(this.data <= other.data)
}))

Number.slots.set("==", builtInFunc(function(other) {
  return toObject(this.data == other.data)
}))

Number.slots.set("!=", builtInFunc(function(other) {
  return toObject(this.data != other.data)
}))

export {
  Number,
  String,
}
