import { Object, Null } from "@vm/object"

class Scope {

  parent?: Scope
  storage: Map<string, Object>

  constructor(parent = null) {
    this.parent = parent
    this.storage = new Map()
  }

  get(name: string): Object {
    let found = this.storage[name]

    if(found) {
      return found
    } else if(this.parent) {
      return this.parent.get(name)
    } else {
      return Null
    }
  }

  set(name: string, value: Object) {
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

  get(name: string) {
    return this.currentScope.get(name)
  }

  set(name: string, value: Object) {
    return this.currentScope.set(name, value)
  }
}

