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
  FindIn,
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

  constructor(vm) {
    this.vm = vm

    // Code stack. The set of expressions that need to be evaluated
    this.codeStack = new Array()

    // Data stack. What people normally think of when they hear "stack"
    this.dataStack = new Array()

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
  eval(nodes: Array<Node>): ReturnValue {

    // As our code storage is a stack, we want the last element in
    // the list to be the first expression to evaluate, so we need
    // to reverse the incoming list before pushing all values onto
    // the code stack.

    // Also, we also have to set up a Return expression that will
    // run as the last expression in the list, so it goes on first.

    //let promise = new Promise<IObject>((resolve, reject) => {})
    let result = new ReturnValue()
    this.pushCode(result)

    for(var node of nodes.reverse()) {
      this.pushCode(node)
    }

    this._nextTick()

    return result
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
  // to the JS vm. I've tried to set up _evalNode to be mostly deterministic
  // such that the code should never get into a blocking loop that never
  // leaves this function.
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
      /**
       * First cover the immediate value node types that we can
       * handle in-line here. These are the nodes who contain
       * all the information they need and don't need any more
       * processing or evaluation.
       */
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

      /**
       * Next handle the AST Nodes that will require further processing.
       * These nodes are trees of other nodes that will require extra
       * evaluation. We will turn these nodes into new processing nodes,
       * triggering and preparing for the results of the evaluation later
       * on.
       */

      case NodeType.Assignment:
        this.pushAssignment(node)
        break

      case NodeType.MessageSend:
        this.pushMessageSend(node as MessageSendNode)
        break

      /**
       * Finally handle the nodes built from the previous section. These nodes
       * should now have all of the values they need to continue their own processing.
       */

      case NodeType.EvalAssignment:
        this.evalAssignment(node as EvalNode)
        break

      case NodeType.EvalMessageSend:
        this.evalMessageSend(node as EvalNode)
        break

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

  pushAssignment(node) {
    this.pushEval(node, NodeType.EvalAssignment, [node.right])
  }

  pushMessageSend(node: MessageSendNode) {
    this.pushEval(node, NodeType.EvalMessageSend, [node.receiver])
  }

  evalAssignment(node: EvalNode) {
    let varName = AsString(node.node.name)
    let varValue = node.value.value
    SetSlot(varValue, AsString("objectName"), varName)

    // TODO The Ruby-esque scope / ownership lookup

    SetSlot(this.currentSpace, varName, varValue)

    // Assignment always returns the value that was assigned
    this.pushData(varValue)
  }

  evalMessageSend(node: EvalNode) {
    let receiver = node.value.value
    let message = AsString(node.node.message.name)

    let slotValue = SendMessage(receiver, message)
    this.pushData(slotValue)
  }

  pushEval(node: Node, nodeType: NodeType, toEval: Node[]) {
    let evalNode = {
      type: nodeType,
      node: node,
      token: node.token,

      // These will get filled in in a sec
      value: null,
      promise: null,
    }

    // Manually push this node onto the stack.
    // `eval` sets up a ReturnValue for every call and we don't
    // need a return value for this intermediary node.
    // This is done before we run toEval because we need our evalNode
    // to only run once all of its prequisites (toEval) are processed.
    this.pushCode(evalNode)

    let returnValue = this.eval(toEval)

    evalNode.value = returnValue
    evalNode.promise = returnValue.promise
  }

  pushCode(node: Node) {
    this.codeStack.push(node)

    // console.log("Code stack push %s. Stack now %o", node.type, this.codeStack.map((node) => node.type))
  }

  popCode(): Node {
    let code = this.codeStack.pop()

    // console.log("Popped %o", code.type)

    return code
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

  // Match the Node interface
  type = NodeType.ReturnValue
  token = null

  _resolve = null
  _reject = null

  _value = null

  constructor() {
    this.promise = new Promise<IObject>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })

    this.promise.catch((error) => {
      console.log(error)
    })
  }

  resolve(value: IObject) {
    this._resolve(value)
    this._value = value
  }

  get value() {
    return this._value
  }
}

interface EvalNode extends Node {
  // Link back to the original node that triggered this one
  node: Node

  // The promise wrapper that will receive the computation result
  value: ReturnValue

  // The underlying Promise so calls into the interpreter can
  // properly wait for a response
  promise: Promise<IObject>
}
