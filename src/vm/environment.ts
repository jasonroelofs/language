import { IObject, Null } from "@vm/object"

class Scope {

  parent?: Scope
  storage: Map<string, IObject>

  constructor(parent = null) {
    this.parent = parent
    this.storage = new Map()
  }

  get(name: string): IObject {
    let found = this.storage[name]

    if(found) {
      return found
    } else if(this.parent) {
      return this.parent.get(name)
    } else {
      return Null
    }
  }

  set(name: string, value: IObject) {
    this.storage[name] = value
  }
}

export default class Environment {

  currentScope: Scope

  constructor() {
    this.currentScope = new Scope()
  }

  pushScope() {
    this.currentScope = new Scope(this.currentScope)
  }

  popScope() {
    this.currentScope = this.currentScope.parent
  }

  get(name: string): IObject {
    return this.currentScope.get(name)
  }

  set(name: string, value: IObject) {
    return this.currentScope.set(name, value)
  }
}

