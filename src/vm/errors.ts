import { Token } from "@compiler/tokens"
import { Node, MessageNode } from "@compiler/ast"
import { IObject } from "@vm/object"

/**
 * Define all errors related to execution.
 * Similar setup and expected structure to SyntaxError from compiler/errors.
 * Must match the SystemError interface. See vm/error_report`
 */
class RuntimeError extends Error {

  token: Token

  chunk: string

  position: number

  file: string

  constructor(token: Token) {
    super()

    this.token = token
    this.chunk = token.value
    this.position = token.pos
    this.file = token.file
  }

  baseType(): string {
    return "Runtime Error"
  }

  errorType(): string {
    return null
  }

  description(): string {
    return null
  }

  // A plain object of possible options for configuring this error's
  // output. See ReportOptions in vm/error_report for details.
  reportOptions(): Object {
    return {}
  }

}

class SlotNotFoundError extends RuntimeError {
  message: string

  constructor(node: Node | MessageNode, message: IObject) {
    super(node.token)
    this.message = message.data
  }

  errorType(): string {
    return `Slot '${this.message}' Not Found`
  }
}

class NotABlockError extends RuntimeError {

  constructor(node: Node | MessageNode) {
    super(node.token)
  }

  errorType(): string {
    return `Value at '${this.chunk}' is not a block`
  }
}

export {
  RuntimeError,
  SlotNotFoundError,
  NotABlockError,
}
