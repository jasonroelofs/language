import {
  Node,
  BlockNode,
  MessageSendNode,
  MessageNode,
  NodeType,
} from "@compiler/ast"
import {
  Objekt,
  IObject,
  AddParent,
  NewObject,
  SendMessage,
  SetSlot,
  ToObject,
  AsString,
  Number,
  True,
  False,
  Null,
} from "@vm/object"
import {
  World,
} from "@vm/core"

import Platform from "@vm/platform"

/**
 * Node and Javascript runtimes on the web are implemented in an event-loop
 * fashion, which means that if a client-side script takes all of the execution
 * time, the Javascript core is unable to handle everything its supposed to,
 * like events and I/O.
 *
 * The previous Interpeter was a naiive recursive tree walker that never released
 * control back to the JS runtime until IO explicitly happened, which means it will
 * never work as a web-based tool. This version takes a different tact: dropping
 * recursion and using multiple stacks to allow running the code in time-based
 * releasing back to the JS runtime every few milliseconds.
 *
 * This means that the interpeter needs to be treated as an asyncronous process,
 * where interactions with it are handled and resolved through Promises.
 */
export default class WebSafeInterpreter {

  // Pointer back to the main VM object running us
  vm = null

  // Keep track of the current execution Space, which is a normal object provided
  // as the execution context of each block.
  currentSpace: IObject

  codeStack = null
  dataStack = null

  // Pointers to some in-language objects that we make use of directly here.
  Block: IObject
  Sender: IObject
  ActivationRecord: IObject
  Exception: IObject

  // Ensure we only set up a nextTick once per execution window
  ticked: boolean = false

  DATA_STACK_SIZE: number = 1024
  CODE_STACK_SIZE: number = 1024

  constructor(vm) {
    this.vm = vm

    // Code stack. The set of expressions that need to be evaluated
    this.codeStack = new Array(this.CODE_STACK_SIZE)

    // Data stack. What people normally think of when they hear "stack"
    this.dataStack = new Array(this.DATA_STACK_SIZE)

    // The World is our top-level storage space.
    this.currentSpace = World
  }

  ready(argv = []) {
    /*
    this.Block = SendMessage(this.currentSpace, AsString("Block"))
    this.Sender = SendMessage(this.currentSpace, AsString("Sender"))
    this.ActivationRecord = SendMessage(this.currentSpace, AsString("ActivationRecord"))
    this.Exception = SendMessage(this.currentSpace, AsString("Exception"))

    // Expose static values from the runtime into the language
    let Process = SendMessage(this.currentSpace, AsString("Process"))
    SetSlot(Process, AsString("argv"), ToObject(argv))
    */

    this.pushSpace(this.currentSpace)
  }

  // Push a new Space onto the stack, building it off of the passed in object.
  // Returns the previous currentSpace for restoration.
  // Changes `this.currentSpace`
  pushSpace(newSpace: IObject): IObject {
    let previousSpace = this.currentSpace

    this.currentSpace = NewObject(newSpace)
    SetSlot(this.currentSpace, AsString("space"), this.currentSpace)
    SetSlot(this.currentSpace, AsString("objectName"), ToObject(`Space (${this.currentSpace.objectId})`))

    // Link this space back to the previous space so we can keep a proper
    // stack of spaces, ensuring correct scoping at all times.
    if(newSpace != previousSpace) {
      AddParent(this.currentSpace, previousSpace)
    }

    return previousSpace
  }

  // Evaluate the given set of expressions and return the value of
  // the final expression.
  //
  // Returns a Promise<IObject>
  eval(nodes: Array<Node>): Promise<IObject> {

    // As our code storage is a stack, we want the last element in
    // the list to be the first expression to evaluate, so we need
    // to reverse the incoming list before pushing all values onto
    // the code stack.

    // Also, we also have to set up a Return expression that will
    // run as the last expression in the list, so it goes on first.

    //let promise = new Promise<IObject>((resolve, reject) => {})
    let result = new ReturnValue()
    this.codeStack.push(result)

    for(var node of nodes.reverse()) {
      this.pushCode(node)
    }

    this._nextTick()

    return result.promise
  }

  _nextTick() {
    if(!this.ticked && this.codeStack.length > 0) {
      this.ticked = true
      Platform.nextTick(() => this._evalNextChunk())
    }
  }

  // The workhorse of the evaluator.
  // This works through the current codeStack and evaluates each expression
  // but only runs for a set amount of time before releasing control back
  // to the JS vm.
  _evalNextChunk() {
    let start = Date.now()
    // Start at 10ms windows
    let window = 10
    this.ticked = false

    let next: Node

    while((Date.now() - start) < window) {
      next = this.popCode()
      if(next) {
        this._evalNode(next)
      } else {
        break
      }
    }

    this._nextTick()
  }

  _evalNode(node: Node) {
    switch(node.type) {
      case NodeType.ReturnValue:
        node.resolve(this.popData())
        break

      case NodeType.NumberLiteral:
        this.pushData(NewObject(Number, node.value))
        break

      case NodeType.BooleanLiteral:
        this.pushData(node.value ? True : False)
        break

      case NodeType.StringLiteral:
        this.pushData(AsString(node.value))
        break

      case NodeType.NullLiteral:
        this.pushData(Null)
        break

      case NodeType.BlockLiteral:
        this.pushBlockLiteral(node as BlockNode)
        break

      case NodeType.Identifier:
        let slotName = AsString(node.value)
        let found = SendMessage(this.currentSpace, slotName)

        // If not found ...

        this.pushData(found)
        break

      case NodeType.Assignment:
        // TODO Finally rebuild this a syntax sugar for space.setSlot()
        // Or not?
        // This is also where we need to implement the Ruby-esque scoping management
        // That logic needs to happen at run time regardless of this node type.
        // Assignment is also a weird case because it doesn't work in all cases,
        // like `obj.value = "something"`
        break

      case NodeType.MessageSend:
        this.pushMessageSend(node as MessageSendNode)
        break

      /**
        * The following nodes are intermediate steps generated by the above node
        * types. When these types are hit, it's expected that the code stack and
        * the data stack are set up to finally evaluate the original code line.
        */

          /*
      case NodeType.EvalAssignment:
        break

      case NodeType.EvalMessageSend:
        break

      case NodeType.EvalCallBlock:
        break

      */
      default:
        // Throw exception: don't now how to evaluate node type
    }
  }

  pushBlockLiteral(node: BlockNode) {
    let block = NewObject(this.Block)
    SetSlot(block, AsString("body"), NewObject(Objekt, node.body))
    SetSlot(block, AsString("parameters"), NewObject(Objekt, node.parameters))
    SetSlot(block, AsString("scope"), this.currentSpace)

    block.codeBlock = true

    this.pushData(block)
  }

  pushMessageSend(node: MessageSendNode) {
    /*
    this.eval([{
      type: EvalMessageSend,
      node: node,
      message: node.message,
      receiver: this.eval([node.receiver])
    }])
     */
  }

  pushCallBlock(node: MessageSendNode) {

  }

  pushCode(node: Node) {
    this.codeStack.push(node)
  }

  popCode(): Node {
    return this.codeStack.pop()
  }

  pushData(obj: IObject) {
    this.dataStack.push(obj)
  }

  popData(): IObject {
    return this.dataStack.pop()
  }
}

/**
 * Due to the async-ish nature of the runtime we have to hook into
 * the execution path hooks to know when and to whom we need to return certain
 * values after execution. This object is a Node that encapsulates a Promise
 * that will resolve with the top value on the data stack.
 */
class ReturnValue {

  public promise: Promise<IObject> = null

  type = NodeType.ReturnValue
  _resolve = null
  _reject = null

  constructor() {
    this.promise = new Promise<IObject>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  resolve(value: IObject) {
    this._resolve(value)
  }
}

/**
 * The following nodes are used during evaluation
 */

  /*
export interface EvalMessageSend extends Node {
  receiver: Promise<IObject>
  message: MessageNode
}
   */
