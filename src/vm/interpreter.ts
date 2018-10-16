import * as util from "util"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import {
  Node,
  BlockNode,
  MessageSendNode,
  ArgumentNode,
  NodeType,
  Expression
} from "@compiler/ast"
import {
  IObject,
  NewObject,
  SendMessage,
  AddSlot,
  Objekt,
  Null,
  True,
  False,
} from "@vm/object"
import {
  Number,
  String,
  IO,
  World,
  Space,
} from "@vm/core"

export default class Interpreter {

  theWorld: IObject
  currentSpace: IObject

  constructor() {
    this.theWorld = World
    this.currentSpace = Space
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
      // TODO: Update the parser to convert assignment to a MessageSend
      // so we can drop this branch entirely.
      case NodeType.Assignment:
        let varName = node.name
        let varValue = this.evalNode(node.right)
        this.currentSpace.slots.set(varName, varValue)
        return varValue

      case NodeType.Identifier:
        return SendMessage(this.currentSpace, node.value)

      case NodeType.NumberLiteral:
        return NewObject(Number, node.value)

      case NodeType.BooleanLiteral:
        return node.value ? True : False

      case NodeType.StringLiteral:
        return NewObject(String, node.value)

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
    let block = NewObject(Objekt)
    AddSlot(block, "body", NewObject(Objekt, node.body))
    AddSlot(block, "parameters", NewObject(Objekt, node.parameters))

    block.codeBlock = true

    return block
  }

  evalMessageSend(node: MessageSendNode): IObject {
    let receiver = this.evalNode(node.receiver)
    let message = node.message.name
    let args = node.message.arguments

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
      return this.evalCodeBlock(receiver, args)
    }

    // Not a code block, figure out what's at this location
    let slotValue = SendMessage(receiver, message)

    if(slotValue.codeBlock) {
      if(slotValue.builtIn) {
        // We're a built-in, call it via javascript
        let toFunc = []

        for(var idx in args) {
          toFunc.push(this.evalNode(args[idx].value))
        }

        return slotValue.data.apply(receiver, toFunc)
      } else {
        return this.evalCodeBlock(slotValue, args)
      }
    }

    return slotValue
  }

  evalCodeBlock(codeBlock: IObject, args: ArgumentNode[]): IObject {
    let codeBody = SendMessage(codeBlock, "body").data
    let parameters = SendMessage(codeBlock, "parameters").data

    let blockSpace = this.newNestedSpace()

    // Check for plain first argument and fix it up to match the name
    // of the first parameter
    if(args.length > 0 && args[0].name == null) {
      args[0].name = parameters[0].name
    }

    for(var param of parameters) {
      let arg = args.find((a) => { return a.name == param.name })

      if(arg) {
        blockSpace.slots.set(param.name, this.evalNode(arg.value))
      } else if(param.default) {
        blockSpace.slots.set(param.name, this.evalNode(param.default))
      } else {
        // ERROR Unmatched required parameter
      }
    }

    let result = this.evalExpressions(codeBody)

    this.popSpace()

    return result
  }

  newNestedSpace(): IObject {
    let newSpace = NewObject(this.currentSpace)
    this.currentSpace = newSpace
    return newSpace
  }

  popSpace() {
    this.currentSpace = this.currentSpace.parents[0]
  }
}
