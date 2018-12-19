import { Token, TokenType } from "@compiler/tokens"
import {
  Node,
  NodeType,
  MessageNode,
  MessageSendNode,
  ArgumentNode,
  ParameterNode,
} from "@compiler/ast"
import { IObject } from "@vm/object"

/**
 * Define all errors related to execution.
 * Similar setup and expected structure to SyntaxError from compiler/errors.
 * Must match the SystemError interface. See vm/error_report`
 */
class RuntimeError extends Error {

  token: Token

  constructor(token: Token) {
    super()

    this.token = token
  }

  get chunk(): string {
    return this.token.value
  }

  get line(): number {
    return this.token.line
  }

  set line(to: number) {
    this.token.line = to
  }

  get ch(): number {
    return this.token.ch
  }

  set ch(to: number) {
    this.token.ch = to
  }

  get file(): string {
    return this.token.file
  }

  set file(to: string) {
    this.token.file = to
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

  constructor(node: Node, message: IObject) {
    super(node.token)
    this.message = message.data
  }

  errorType(): string {
    return `Slot '${this.message}' Not Found`
  }
}

class NoSuchMessageError extends RuntimeError {

  message: string
  receiver: Node

  constructor(node: Node, message: IObject) {
    super(node.token)
    this.message = message.data
    this.receiver = node.receiver
  }

  errorType(): string {
    return `'${this.receiver.token.value}' does not respond to the '${this.message}' message`
  }
}

class NotABlockError extends RuntimeError {

  constructor(node: Node | MessageSendNode) {
    let infoNode

    if(node.token.type == TokenType.Dot) {
      infoNode = node.message
    } else {
      infoNode = node
    }

    super(infoNode.token)
  }

  errorType(): string {
    return `Value at '${this.chunk}' is not a block`
  }
}

class ArgumentMismatchError extends RuntimeError {

  args: Array<ArgumentNode>
  params: Array<ParameterNode>

  constructor(
    node: Node | MessageSendNode,
    params: Array<ParameterNode>,
    args: Array<ArgumentNode>,
  ) {
    let infoNode

    if(node.token.type == TokenType.Dot) {
      infoNode = node.message
    } else {
      infoNode = node
    }

    super(infoNode.token)

    this.params = params
    this.args = args
  }

  errorType(): string {
    // Error message possibilities:
    // * Provided arguments but no known parameters
    // * Did not provide arguments but required parameters
    // * Did not provide enough arguments that matched parameters
    //   - arguments provided that don't match a defined parameter
    //   - all arguments used but required parameters still unfilled
    //
    // Also make sure to provide information on default / optional parameters

    let prefix = `The block at '${this.chunk}'`

    if(this.params.length == 0 && this.args.length > 0) {
      return `${prefix} does not expect any arguments but received ${this.args.length}`
    }

    // required, optional
    let requiredCount = 0
    let optionalCount = 0
    let paramNames = []
    this.params.forEach((param) => {
      paramNames.push(param.name)

      if(param.default) {
        optionalCount += 1
      } else {
        requiredCount += 1
      }
    })

    if(requiredCount > 0 && this.args.length == 0) {
      let paramCount = ""
      let plural = ""

      if(optionalCount > 0) {
        paramCount = `between ${requiredCount} and ${requiredCount + optionalCount}`
        plural = "s"
      } else {
        paramCount = `${requiredCount}`
        plural = requiredCount > 1 ? "s" : ""
      }

      return `${prefix} expected ${paramCount} argument${plural} but received ${this.args.length}`
    }

    let argNames = this.args.map(arg => arg.name)
    let unusedArgs = argNames.filter(argName => !paramNames.includes(argName))

    if(unusedArgs.length > 0) {
      let plural = unusedArgs.length > 1 ? "s" : ""

      return `${prefix} does not accept the argument${plural} ${unusedArgs.join(", ")}`
    }

    let unfilledParams = paramNames.filter(paramName => !argNames.includes(paramName))

    if(unfilledParams.length > 0) {
      let plural = unfilledParams.length > 1 ? "s" : ""
      let wereWas = unfilledParams.length > 1 ? "were" : "was"

      return `${prefix} expected the argument${plural} ${unfilledParams.join(", ")} which ${wereWas} not provided`
    }

    return `The arguments provided to '${this.chunk}' do not match the expected parameters`
  }
}

export {
  RuntimeError,
  SlotNotFoundError,
  NoSuchMessageError,
  NotABlockError,
  ArgumentMismatchError,
}
