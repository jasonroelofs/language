import * as util from "util"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import {
  Node,
  BlockNode,
  MessageSendNode,
  NodeType,
  Expression
} from "@compiler/ast"
import {
  IObject,
  NewObject,
  SendMessage,
  Objekt,
  Null,
  True,
  False,
} from "@vm/object"
import {
  Number,
  String,
  IO,
} from "@vm/core"
import Environment from "@vm/environment"

export default class Interpreter {

  currentScope: Environment

  constructor() {
    this.currentScope = new Environment()

    // HACK. I will be moving the "scoping" setup here to actually be
    // just more objects, so the global "scope" will be the World object,
    // Constant and variable lookup will be messages on World slots.
    // A user's workspace is a Space. Blocks will have a Locals (and figure out
    // closure handling).
    this.currentScope.set("Object", Objekt)
    this.currentScope.set("Number", Number)
    this.currentScope.set("String", String)
    this.currentScope.set("IO", IO)
  }

  eval(program: string): IObject {
    let l = new Lexer(program)
    let p = new Parser(l.tokenize())

    return this.evalExpressions(p.parse())
  }

  evalExpressions(expressions: Array<Expression>): IObject {
    var ret = Null

    for(var expression of expressions) {
      ret = this.evalNode(expression.node)
    }

    return ret
  }

  evalNode(node: Node): IObject {
    switch(node.type) {
      case NodeType.Assignment:
        let varName = node.name
        let varValue = this.evalNode(node.right)
        this.currentScope.set(varName, varValue)
        return varValue

      case NodeType.Identifier:
        return this.currentScope.get(node.value)

      case NodeType.NumberLiteral:
        return NewObject(Number, {}, node.value)

      case NodeType.BooleanLiteral:
        return node.value ? True : False

      case NodeType.StringLiteral:
        return NewObject(String, {}, node.value)

      case NodeType.NullLiteral:
        return Null

      case NodeType.Block:
        return this.evalBlockLiteral(node as BlockNode)

      case NodeType.MessageSend:
        return this.evalMessageSend(node as MessageSendNode)

      default:
        throw new Error(util.format("[Eval] Don't know how to evaluate node %o of type %o", node, node.type))
        return Null
    }
  }

  evalBlockLiteral(node: BlockNode): IObject {
    let block = NewObject(Objekt, {
      "body": NewObject(Objekt, {}, node.body),
      "parameters": NewObject(Objekt, {}, node.parameters),
    })

    block.codeBlock = true

    return block
  }

  evalMessageSend(node: MessageSendNode): IObject {
    let receiver = this.evalNode(node.receiver)
    let message = node.message.name

    // TODO figure out how other like languages do this.
    //
    // We need a way to trigger evaluation of a block's AST through a message passing
    // structure, but it's kind of a chicken-and-egg problem.
    // I would like the `call` message to simply return the object itself then we can
    // just check the codeBlock flag.
    //
    // So hard-coding a look for a node marked as a code block
    // and the "call" message.
    if(receiver.codeBlock && message == "call") {
      // Execute the code block with the arguments
      let args = node.message.arguments
      let codeBody = SendMessage(receiver, "body").data
      let parameters = SendMessage(receiver, "parameters").data

      this.currentScope.pushScope()

      // Check for plain first argument and fix it up to match the name
      // of the first parameter
      if(args.length > 0 && args[0].name == null) {
        args[0].name = parameters[0].name
      }

      for(var param of parameters) {
        let arg = args.find((a) => { return a.name == param.name })

        if(arg) {
          this.currentScope.set(param.name, this.evalNode(arg.value))
        } else if(param.default) {
          this.currentScope.set(param.name, this.evalNode(param.default))
        } else {
          // ERROR Unmatched required parameter
        }
      }

      let result = this.evalExpressions(codeBody)

      this.currentScope.popScope()

      return result
    }

    // Not a code block, figure out what's at this location
    let slotValue = SendMessage(receiver, message)

    if(slotValue.codeBlock && slotValue.builtIn) {
      // We're a built-in, call it via javascript
      let args = node.message.arguments
      let toFunc = []

      for(var idx in args) {
        toFunc.push(this.evalNode(args[idx].value))
      }

      return slotValue.data.apply(receiver, toFunc)
    }

    return slotValue
  }
}
