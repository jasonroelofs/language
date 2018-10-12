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
  Number,
  String
} from "@vm/object"
import Environment from "@vm/environment"

export default class Interpreter {

  currentScope: Environment

  constructor() {
    this.currentScope = new Environment()
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

      // TODO
      // Should also check arguments against the method's defined
      // parameters but that can come next
      this.currentScope.pushScope()

      for(var idx in args) {
        this.currentScope.set(
          parameters[idx].name,
          this.evalNode(args[idx].value)
        )
      }

      let result = this.evalExpressions(codeBody)

      this.currentScope.popScope()

      return result
    }

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
