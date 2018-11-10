import * as util from "util"
import {
  Node,
  BlockNode,
  MessageSendNode,
  ArgumentNode,
  NodeType,
  Expression
} from "@compiler/ast"
import * as errors from "@vm/errors"
import {
  IObject,
  NewObject,
  SendMessage,
  AddSlot,
  toObject,
  Objekt,
  Number,
  String,
  Null,
  True,
  False,
} from "@vm/object"

export default class Interpreter {

  currentSpace: IObject

  constructor(baseSpace: IObject) {
    this.currentSpace = baseSpace
  }

  ready() {
    // Initialize our own execution space and we are ready to go
    this.newNestedSpace()
  }

  eval(expressions: Array<Expression>): IObject {
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
        AddSlot(this.currentSpace, toObject(varName), varValue, toObject(node.comment))
        return varValue

      case NodeType.Identifier:
        let slotName = toObject(node.value)
        let found = SendMessage(this.currentSpace, slotName)

        if(found == null) {
          throw new errors.SlotNotFoundError(node, slotName)
        }

        return found

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
    AddSlot(block, toObject("body"), NewObject(Objekt, node.body))
    AddSlot(block, toObject("parameters"), NewObject(Objekt, node.parameters))

    block.codeBlock = true

    return block
  }

  evalMessageSend(node: MessageSendNode): IObject {
    let receiver = this.evalNode(node.receiver)
    let message = toObject(node.message.name)
    let args = node.message.arguments

    if(node.message.name == "call") {
      if(!receiver.codeBlock) {
        throw new errors.NotABlockError(node)
      }

      let context = null

      if(node.message.context) {
        context = this.evalNode(node.message.context)
      }

      if(receiver.builtIn) {
        // We're a built-in, call it via javascript
        let toFunc = {}
        let meta = {}
        var argName: string

        for(var idx in args) {
          // TODO: For things like addSlot, if the first parameter doesn't have a name,
          // what should the name of the argument be?
          // Maybe builtInFunc should take a list of the argument names we expect?
          argName = args[idx].name ? args[idx].name : "0"

          toFunc[argName] = this.evalNode(args[idx].value)
          meta[argName] = args[idx]
        }

        return receiver.data.call(context, toFunc, meta)
      }

      return this.evalCodeBlock(context, receiver, args)
    }

    // Not executing a code block, return the raw value of this node
    let slotValue = SendMessage(receiver, message)

    if(slotValue == null) {
      throw new errors.SlotNotFoundError(node, message)
    }

    return slotValue
  }

  evalCodeBlock(receiver: IObject, codeBlock: IObject, args: ArgumentNode[]): IObject {
    let codeBody = SendMessage(codeBlock, toObject("body")).data
    let parameters = SendMessage(codeBlock, toObject("parameters")).data

    // Check for plain first argument and fix it up to match the name
    // of the first parameter
    if(args.length > 0 && args[0].name == null) {
      args[0].name = parameters[0].name
    }

    let evaldArgs = []

    // Check that arguments match expected parameters and evaluate all
    // provided arguments or default parameter values in the current Space
    for(var param of parameters) {
      let arg = args.find((a) => { return a.name == param.name })

      if(arg) {
        evaldArgs.push([toObject(param.name), this.evalNode(arg.value), toObject(arg.comment)])
      } else if(param.default) {
        evaldArgs.push([toObject(param.name), this.evalNode(param.default)])
      } else {
        throw new Error(`Unmatched required parameter '${param.name}'`)
      }
    }

    // Set up our new execution context (a nested Space) for this block call.
    // This will set `self` to either the Space or the actual receiver of this
    // message. Then we set the values of all arguments also as slot values before
    // evaluating the block itself.
    let blockSpace = this.newNestedSpace(receiver)

    for(var argValue of evaldArgs) {
      AddSlot.call(null, blockSpace, ...argValue)
    }

    let result = this.eval(codeBody)

    this.popSpace()

    return result
  }

  newNestedSpace(selfObj = null): IObject {
    let newSpace = NewObject(this.currentSpace)
    let self = selfObj || newSpace

    this.currentSpace = newSpace
    AddSlot(newSpace, toObject("self"), self)

    return newSpace
  }

  popSpace() {
    this.currentSpace = this.currentSpace.parents[0]
  }
}
