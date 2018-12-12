import * as util from "util"
import {
  Token
} from "@compiler/tokens"
import {
  Node,
  BlockNode,
  MessageSendNode,
  ArgumentNode,
  ParameterNode,
  NodeType,
  Expression,
} from "@compiler/ast"
import * as errors from "@vm/errors"
import {
  IObject,
  NewObject,
  SendMessage,
  AddSlot,
  AddParent,
  FindIn,
  toObject,
  Objekt,
  Number,
  String,
  Array,
  Null,
  True,
  False,
} from "@vm/object"

export default class Interpreter {

  currentSpace: IObject

  // Keep a callstack that's a list of in-language objects
  // For each space we make this list available as a snapshot of the call stack
  // at that point in time.
  callStack: IObject[]

  Block: IObject
  Sender: IObject
  ActivationRecord: IObject

  constructor(baseSpace: IObject) {
    this.callStack = []

    this.currentSpace = baseSpace
  }

  ready() {
    // Initialize our initial execution space and we are ready to go
    this.pushSpace(this.currentSpace)

    // Grab a hold of some objects that we make use of that are defined
    // in the core lib
    this.Block = SendMessage(this.currentSpace, toObject("Block"))
    this.Sender = SendMessage(this.currentSpace, toObject("Sender"))
    this.ActivationRecord = SendMessage(this.currentSpace, toObject("ActivationRecord"))
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
      case NodeType.Assignment:
        let varName = toObject(node.name)
        let varValue = this.evalNode(node.right)
        AddSlot(varValue, toObject("objectName"), varName)

        // Look up the space stack to find the first scope that already has this
        // slot defined and assume that is the scope we should also be changing values in
        let owningObject = FindIn(this.currentSpace, (obj) => obj.slots.has(node.name))
        AddSlot(owningObject || this.currentSpace, varName, varValue, toObject(node.comment))

        return varValue

      case NodeType.Identifier:
        let slotName = toObject(node.value)
        let found = SendMessage(this.currentSpace, slotName)

        if(found == null) {
          throw new errors.SlotNotFoundError(node, slotName)
        }

        if(found.codeBlock) {
          return this.newActivationRecord(found)
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
    let block = NewObject(this.Block)
    AddSlot(block, toObject("body"), NewObject(Objekt, node.body))
    AddSlot(block, toObject("parameters"), NewObject(Objekt, node.parameters))
    AddSlot(block, toObject("scope"), this.currentSpace)

    block.codeBlock = true

    return block
  }

  evalMessageSend(node: MessageSendNode): IObject {
    let receiver: IObject = null

    if(node.receiver) {
      receiver = this.evalNode(node.receiver)
    }

    let message = toObject(node.message.name)
    let args = node.message.arguments

    if(node.message.name == "call") {
      if(!receiver.codeBlock) {
        throw new errors.NotABlockError(node.receiver)
      }

      // We're an activation record wrapping the actual code block to execute
      // Unwrap this and pull out the intended receiver object.
      let block = SendMessage(receiver, toObject("block"))
      let context = SendMessage(receiver, toObject("receiver"))
      let result

      this.pushCallStack(node)

      // However in the case of direct block evaluation `{ ... }()` we won't
      // be an ActivationRecord, we will be the block itself so work around that.
      // TODO: Should we be an AR here?
      if(block == null) {
        block = receiver
      }

      if(block.builtIn) {
        // We're a built-in, call it directly
        let toFunc = {}
        let meta = {}
        let argName: string

        for(var idx in args) {
          // TODO: For things like addSlot, if the first parameter doesn't have a name,
          // what should the name of the argument be?
          // Maybe builtInFunc should take a list of the argument names we expect?
          argName = args[idx].name ? args[idx].name : "0"

          toFunc[argName] = this.evalNode(args[idx].value)
          meta[argName] = args[idx]
        }

        // We don't apply as stringent argument error checking here as the intent
        // is that all code that triggers a built-in should be itself wrapped in a code-level
        // block that will check for argument / parameter mismatches.
        result = block.data.call(context, toFunc, meta, this)
      } else {
        result = this.evalCodeBlock(node.receiver, context, block, args)
      }

      this.popCallStack()

      return result
    }

    // Not executing a code block, return the raw value stored at this slot
    let slotValue = SendMessage(receiver ? receiver : this.currentSpace, message)

    if(slotValue == null) {
      if(receiver) {
        throw new errors.NoSuchMessageError(node, message)
      } else {
        throw new errors.SlotNotFoundError(node, message)
      }
    }

    if(slotValue.codeBlock) {
      return this.newActivationRecord(slotValue, receiver)
    }

    return slotValue
  }

  evalCodeBlock(receiverNode, receiver: IObject, codeBlock: IObject, args: ArgumentNode[]): IObject {
    let parameters = SendMessage(codeBlock, toObject("parameters")).data

    // Param/Arg agreement checks.
    // We need to make sure that the arguments given can match directly to
    // parameters defined on the block. This needs to match by arity (taking
    // defaults into account) and name, while handling the case of a single
    // argument not requiring a name but still requiring at least one defined
    // parameter.

    // Gave us arguments, but we don't have parameters
    if(args.length > 0 && parameters.length == 0) {
      throw new errors.ArgumentMismatchError(receiverNode, parameters, args)
    }

    // Check for plain first argument and fix it up to match the name
    // of the first parameter
    if(args.length > 0 && args[0].name == null && parameters[0]) {
      args[0].name = parameters[0].name
    }

    let evaldArgs = []
    let unusedParams: Array<ParameterNode> = []
    let usedArgs: Array<ArgumentNode> = []

    // Check that arguments match expected parameters and evaluate all
    // provided arguments or default parameter values in the current Space
    for(var param of parameters) {
      let arg = args.find((a) => { return a.name == param.name })

      if(arg) {
        evaldArgs.push([toObject(param.name), this.evalNode(arg.value), toObject(arg.comment)])
        usedArgs.push(arg)
      } else if(param.default) {
        evaldArgs.push([toObject(param.name), this.evalNode(param.default)])
      } else {
        unusedParams.push(param)
      }
    }

    let unusedArgs = args.filter((a) => { return !usedArgs.includes(a) })

    if(unusedParams.length > 0 || unusedArgs.length > 0) {
      throw new errors.ArgumentMismatchError(receiverNode, parameters, args)
    }

    return this.evalBlockWithArgs(receiver, codeBlock, evaldArgs)
  }

  // Split out in its own method to allow built-ins to call back into the VM
  // to evaluate blocks as necessary (e.g. BuiltIn.arrayEach).
  //
  //  receiver can be null
  //  block must be a Block
  //  args must be a multi-dimentional array of the form:
  //    [
  //      [paramName, argValue, (optional meta data)],
  //      [paramName2, argValue2, (optional meta data)],
  //      ...
  //    ]
  //
  evalBlockWithArgs(receiver, block, args = []) {
    let codeBody = SendMessage(block, toObject("body")).data
    let scope = SendMessage(block, toObject("scope"))

    // Set up our own execution space for this block call to the scope
    // that was stored when the block was defined.
    // To make sure the stored scope it's itself corrupted by the block execution
    // we wrap that scope in a new object for this execution.
    let previousSpace = this.pushSpace(scope)

    // If this block is owned by an explicit object, we need to make sure
    // that the `self` slot is set appropriately to that object.
    if(receiver) {
      AddSlot(this.currentSpace, toObject("self"), receiver)

      // Also inject the receiver in the current scope to ensure slot lookups
      // properly check this object.
      // We inject the parent first in the parents list to ensure it's values
      // are found over what else may be in the space stack
      this.currentSpace.parents.unshift(receiver)
    }

    // Expose a copy of the call stack
    AddSlot(this.currentSpace, toObject("sender"), toObject(this.callStack))

    for(var parts of args) {
      AddSlot.call(null, this.currentSpace, ...parts)
    }

    let result = this.eval(codeBody)

    // "Pop" back to the previous scope to keep things clean
    this.currentSpace = previousSpace

    return result
  }

  // We've accessed a block, around which we need to build an ActivationRecord that will
  // keep track of the object receiving this message for proper setting of `self`.
  // `receiver` can be Null, in which `self` will not be set (e.g. it's a standalone block).
  newActivationRecord(codeBlock: IObject, receiver: IObject = null): IObject {
    // Are we already an activation record?
    if(codeBlock.slots.has("block")) {
      return codeBlock
    }

    let activation = NewObject(this.ActivationRecord)
    activation.codeBlock = true

    AddSlot(activation, toObject("block"), codeBlock)

    if(receiver) {
      AddSlot(activation, toObject("receiver"), receiver)
    }

    return activation
  }

  pushCallStack(node: Node) {
    let sender = NewObject(this.Sender)

    // TODO Something that lets us print out the name of the message?
    // Line is 0-based internally, so we push it to 1-based here for user readability
    AddSlot(sender, toObject("line"), toObject(node.token.line + 1))
    AddSlot(sender, toObject("file"), toObject(node.token.file))

    // We make use of shift/unshift to keep a reverse order so that in the language
    // `sender` is in the order of most recent call stack first.
    this.callStack.unshift(sender)
  }

  popCallStack() {
    this.callStack.shift()
  }

  // Push a new Space onto the stack, building it off of
  // the passed in object.
  // Returns the previous currentSpace for restoration.
  // Changes `this.currentSpace`
  pushSpace(newSpace: IObject): IObject {
    let previousSpace = this.currentSpace

    this.currentSpace = NewObject(newSpace)
    AddSlot(this.currentSpace, toObject("space"), this.currentSpace)
    AddSlot(this.currentSpace, toObject("objectName"), toObject(`Space (${this.currentSpace.objectId})`))

    // Link this space back to the previous space so we can keep a proper
    // stack of spaces, ensuring correct scoping at all times.
    AddParent(this.currentSpace, previousSpace)

    return previousSpace
  }
}
