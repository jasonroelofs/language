import * as util from "util"
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
  ObjectIs,
  FindIn,
  Number,
  True,
  False,
  Null,
} from "@vm/object"
import {
  World,
} from "@vm/core"
import { isArray } from "@vm/js_core"
import * as errors from "@vm/errors"
import { SyntaxError } from "@compiler/errors"
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

  // Code stack. The set of expressions that need to be evaluated
  codeStack = null

  // Data stack. What people normally think of when they hear "stack"
  dataStack = null

  // Keep track of actual block calls so we can build a nice in-language backtrace
  callStack: IObject[]

  // Pointers to some in-language objects that we make use of directly here.
  Block: IObject
  Array: IObject
  Sender: IObject
  Exception: IObject

  // Ensure we only set up a nextTick once per execution window
  ticked: boolean = false

  constructor(vm) {
    this.vm = vm

    this.codeStack = new Array()
    this.dataStack = new Array()
    this.callStack = new Array()

    // The World is our top-level storage space.
    this.currentSpace = World
  }

  ready(argv = []) {
    this.Block = SendMessage(this.currentSpace, AsString("Block"))
    this.Array = SendMessage(this.currentSpace, AsString("Array"))
    this.Sender = SendMessage(this.currentSpace, AsString("Sender"))
    this.Exception = SendMessage(this.currentSpace, AsString("Exception"))

    // Expose static values from the runtime into the language
    let Process = SendMessage(this.currentSpace, AsString("Process"))
    SetSlot(Process, AsString("argv"), ToObject(argv))

    this.pushSpace(this.currentSpace)
  }

  // Given an object, a message, and optionally some arguments, return
  // the result of the message or the block at that message.
  // Arguments need to be a Javascript array of IObjects with the correct
  // matching names that the underlying block expects.
  //
  // For situations where you're passing in a single argument to a block
  // and don't care about the name, pass in a single-element array to `args`
  // instead of an object.
  //
  // To get just the value for a message without evaluating any block, use
  // SendMessage instead.
  //
  // Returns a promise that will contain the results
  async call(obj: IObject, message: string, args = {}): Promise<IObject> {
    let block = SendMessage(obj, ToObject(message))
    return this.callBlock(obj, block, args)
  }

  async callBlock(obj: IObject, block: IObject, args = {}): Promise<IObject> {
    let codeBody = SendMessage(block, AsString("body")).data
    let scope = SendMessage(block, AsString("scope"))
    let receiver = obj
    let unwrappedArgs = []

    if(isArray(args)) {
      let blockParams = SendMessage(block, AsString("parameters")).data
      let arg = args[0]

      // TODO Error handling if block expects more arguments
      // TODO Error if we get more than one element in the args array

      unwrappedArgs.push({
        name: ToObject(blockParams[0].name),
        value: ToObject(arg),
      })
    } else {
      for(let name in args) {
        unwrappedArgs.push({
          name: ToObject(name),
          value: ToObject(args[name])
        })
      }
    }

    let returnVal = this.pushEval(
      block.astNode,
      codeBody,
      NodeType.FinishBlock,
      { previousSpace: this.currentSpace }
    )

    this.pushEval(block.astNode, [], NodeType.StartBlock, {
      receiver: receiver,
      scope: scope,
      arguments: unwrappedArgs
    })

    return returnVal.promise
  }

  // Parse and eval the given file in the context of an object.
  // See `World.load` for more details.
  loadFile(path: IObject, into: IObject) {
    let previousSpace = this.currentSpace
    this.currentSpace = into

    let script = Platform.readFile(path.data)
    let fileBody = this.vm.lexAndParse(script.toString(), path.data)

    // We treat loading the file as loading a block of code.
    // This lets us drop back to our previous state when the file has finished loading.
    this.pushEval(path.astNode, fileBody, NodeType.FinishBlock, { previousSpace: this.currentSpace })
  }

  // We've been asked to wrap a block in a `try` clause. This will set up the appropriate
  // code hooks to grab and catch any exceptions, handling them with a catchBlock and
  // ensuring code runs in the provided finallyBlock.
  insertTryHook(codeBlock: IObject, catchBlock: IObject, finallyBlock: IObject) {
    // Our hook to handle exceptions
    this.pushEval(
      codeBlock.astNode,
      [],
      NodeType.HandleException,
      { catchBlock: catchBlock, finallyBlock: finallyBlock }
    )

    // Run the original block
    this.callBlock(null, codeBlock)
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

    let result = new ReturnValue()
    this.pushCode(result)

    for(let i = nodes.length - 1; i >= 0; i--) {
      this.pushCode(nodes[i])
    }

    this._nextTick()

    return result
  }

  // The workhorse of the evaluator.
  // This works through the current codeStack and evaluates each expression
  // but only runs for a set amount of time before releasing control back
  // to the JS vm. I've tried to set up _evalNode to be mostly deterministic
  // such that the code should never get into a blocking loop that never
  // leaves this function.
  _evalNextChunk() {
    let start = Platform.now()
    // Start at 10ms windows
    let window = 10
    this.ticked = false

    let next: Node

    try {
      while((Platform.now() - start) < window) {
        next = this.popCode()
        if(next) {
          this._evalNode(next)
        } else {
          break
        }
      }
    } finally {
      this._nextTick()
    }
  }

  _nextTick() {
    if(!this.ticked && this.codeStack.length > 0) {
      this.ticked = true
      Platform.nextTick(() => this._evalNextChunk())
    }
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

        if(found) {
          this.pushData(found)
        } else {
          this.throwException(node, new errors.SlotNotFoundError(node, slotName))
        }
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

      case NodeType.FinishAssignment:
        this.finishAssignment(node as EvalNode)
        break

      case NodeType.FinishMessageSend:
        this.finishMessageSend(node as EvalNode)
        break

      case NodeType.PushArgument:
        this.pushArgument(node as EvalArgumentNode)
        break

      case NodeType.StartBlock:
        this.startBlock(node as StartBlockNode)
        break

      case NodeType.FinishBlock:
        this.finishBlock(node as FinishBlockNode)
        break

      case NodeType.CallBuiltIn:
        this.callBuiltIn(node as BuiltInNode)
        break

      case NodeType.ThrowException:
        this.propogateException(node as ExceptionNode)
        break

      case NodeType.HandleException:
        this.handleException(node as HandleExceptionNode)
        break

      default:
        // Throw exception: don't now how to evaluate node type
        console.log("Don't know how to handle node type ", node.type)
    }
  }

  pushBlockLiteral(node: BlockNode) {
    let block = NewObject(this.Block)
    SetSlot(block, AsString("body"), NewObject(Objekt, node.body))
    SetSlot(block, AsString("parameters"), NewObject(Objekt, node.parameters))
    SetSlot(block, AsString("scope"), this.currentSpace)
    SetSlot(block, AsString("call"), block)

    block.codeBlock = true
    block.astNode = node

    this.pushData(block)
  }

  pushAssignment(node) {
    this.pushEval(node, [node.right], NodeType.FinishAssignment)
  }

  pushMessageSend(node: MessageSendNode) {
    let toEval = []

    if(node.receiver) {
      toEval.push(node.receiver)
    }

    this.pushEval(node, toEval, NodeType.FinishMessageSend)
  }

  finishAssignment(node: EvalNode) {
    let varName = AsString(node.node.name)
    let varValue = node.returnValue.value
    varValue.astNode = node.node

    SetSlot(varValue, AsString("objectName"), varName)

    // Look up the space stack to find the first scope that already has this
    // slot defined and assume that is the scope we should also be changing values in
    let owningObject = FindIn(this.currentSpace, (obj) => obj.slots.has(node.node.name))
    SetSlot(owningObject || this.currentSpace, varName, varValue, ToObject(node.node.comment))

    // Assignment always returns the value that was assigned
    this.pushData(varValue)
  }

  finishMessageSend(node: EvalNode) {
    let receiver = node.returnValue.value
    if(receiver) {
      receiver.astNode = node.node.receiver
    }

    let message = node.node.message.name
    let toAsk = receiver || this.currentSpace

    let slotValue = SendMessage(toAsk, AsString(message))

    if(!slotValue) {
      if(message === "call") {
        this.throwException(node.node, new errors.NotABlockError(node.node))
      } else if(receiver) {
        this.throwException(receiver, new errors.NoSuchMessageError(receiver, AsString(message)))
      } else {
        this.throwException(node.node, new errors.SlotNotFoundError(node.node, AsString(message)))
      }

      return
    }

    if(message === "call") {
      if(slotValue.builtIn) {
        this.evalBuiltIn(node.node as MessageSendNode, slotValue)
      } else {
        this.evalBlock(node.node as MessageSendNode, slotValue)
      }

      return
    } else if(slotValue.codeBlock && receiver) {
      // Keep track of the receiver / owner of this block for this call
      // by using a child object. This then acts exactly like the parent
      // block object without polluting that object with call-specific information.
      slotValue = this.wrapBlock(slotValue, receiver)
    }

    this.pushData(slotValue)
  }

  wrapBlock(block: IObject, receiver: IObject): IObject {
    let wrapper = NewObject(block)
    wrapper.codeBlock = true
    wrapper.builtIn = block.builtIn

    SetSlot(wrapper, AsString("receiver"), receiver)

    // TODO Remove this when `self` scoping is fixed again
    SetSlot(wrapper, AsString("call"), wrapper)

    // TODO Should callBuiltIn be looking for our data or check the parent?
    wrapper.data = block.data

    return wrapper
  }

  /**
   * TODO: For the sake of getting this working, argument handling is duplicated
   * here and in evalBlock. I would like to get built-ins working even closer to
   * language methods, but the lack of any explicit parameter definition makes that harder.
   * So for built-ins, we just take the list of arguments given, eval those, and pass them
   * in as the currentSpace, without any validation checking.
   */
  evalBuiltIn(node: MessageSendNode, block: IObject) {
    let scope = SendMessage(block, AsString("scope"))
    let receiver = SendMessage(block, AsString("receiver"))
    let toEval = [], arg, argName

    let startBlockOps = {
      receiver: receiver,
      scope: scope,
      arguments: []
    }

    for(let arg of node.message.arguments) {
      argName = arg.name || "0"
      toEval.push([node, [arg.value], NodeType.PushArgument, { name: argName, comment: arg.comment, startBlock: startBlockOps }])
    }

    this.pushEval(
      node,
      [],
      NodeType.CallBuiltIn,
      {
        builtIn: block,
        previousSpace: this.currentSpace,
      }
    )

    // Push the block starter which will set up the block's new space,
    // take our arguments off the data stack, and apply them
    this.pushEval(node, [], NodeType.StartBlock, startBlockOps)

    // Push each argument evaluation
    for(let code of toEval) {
      // @ts-ignore
      this.pushEval(...code)
    }
  }

  evalBlock(node: MessageSendNode, block: IObject) {
    let codeBody = SendMessage(block, AsString("body")).data
    let parameters = SendMessage(block, AsString("parameters")).data
    let scope = SendMessage(block, AsString("scope"))
    let receiver = SendMessage(block, AsString("receiver"))

    // Order of operations here is tricky.
    // Prepare the block itself to be evaluated.
    // Set up the space that this block will run in and prep for that.
    // For each argument
    // - Evaluate it in the current space and assign to the block's space
    // Finally push the call stack and let the block eval

    // Figure out argument / parameter matching first so we know if we need
    // to throw an error before trying to evaluate the block.
    let args = node.message.arguments

    if(args.length > 0 && parameters.length == 0) {
      this.throwException(node, new errors.ArgumentMismatchError(node.receiver, parameters, args))
      return
    }

    let arg, param
    let toEval = []
    let usedArgs = []
    let unusedParams = []

    let startBlockOps = {
      receiver: receiver,
      scope: scope,
      arguments: [],
    }

    for(let i = 0; i < parameters.length; i++) {
      param = parameters[i]

      if(i == 0 && args[0] && args[0].name == null) {
        arg = args[0]
      } else {
        arg = args.find((a) => { return a.name == param.name })
      }

      if(arg) {
        usedArgs.push(arg)
        toEval.push([node, [arg.value], NodeType.PushArgument, { name: param.name, comment: arg.comment, startBlock: startBlockOps }])
      } else if(param.default) {
        toEval.push([node, [param.default], NodeType.PushArgument, { name: param.name, startBlock: startBlockOps }])
      } else {
        unusedParams.push(param)
      }
    }

    let unusedArgs = args.filter((a) => { return !usedArgs.includes(a) })
    if(unusedParams.length > 0 || unusedArgs.length > 0) {
      this.throwException(node, new errors.ArgumentMismatchError(node.receiver, parameters, args))
      return
    }

    this.pushEval(node, codeBody, NodeType.FinishBlock, { previousSpace: this.currentSpace })

    // Push the block starter which will set up the block's new space,
    // take our arguments off the data stack, and apply them
    this.pushEval(node, [], NodeType.StartBlock, startBlockOps)

    // Push each argument evaluation
    for(let code of toEval) {
      // @ts-ignore
      this.pushEval(...code)
    }
  }

  pushArgument(node: EvalArgumentNode) {
    let argValue = node.returnValue.value
    argValue.astNode = node.node

    node.startBlock.arguments.push({
      name: ToObject(node.name),
      value: argValue,
      comment: ToObject(node.comment)
    })
  }

  startBlock(node: StartBlockNode) {
    let argNames = []

    this.pushSpace(node.scope)
    this.pushCallStack(node.node)

    for(let arg of node.arguments) {
      argNames.push(arg.name)

      SetSlot(
        this.currentSpace,
        arg.name,
        arg.value,
        arg.comment
      )
    }

    // We also keep track of the exact set of names assigned
    // to this space, so as to keep track of which are the arguments
    // and which ones are system-level slots.
    SetSlot(
      this.currentSpace,
      AsString("__argumentNames__"),
      NewObject(this.Array, argNames)
    )

    // Expose a copy of the call stack
    SetSlot(this.currentSpace, AsString("sender"), ToObject(this.callStack))

    if(node.receiver) {
      SetSlot(this.currentSpace, AsString("self"), node.receiver)

      // Also inject the receiver in the current scope to ensure slot lookups
      // properly check this object.
      // We inject the parent first in the parents list to ensure it's values
      // are found over what else may be in the space stack
      this.currentSpace.parents.unshift(node.receiver)
    }
  }

  finishBlock(node: FinishBlockNode) {
    this.finishBlockCall(node, node.returnValue.value)
  }

  callBuiltIn(node: BuiltInNode) {
    let builtIn = node.builtIn.data
    let receiver = SendMessage(this.currentSpace, AsString("self"))

    // All variables for this built-in are in the current space.
    // It's up to the built-in itself to pull them out with the given
    // helper methods and ensure all exist and are of the right type.
    let result = null

    try {
      result = builtIn.call(receiver, this.currentSpace, this)
    } catch(error) {
      this.throwException(node, error)
    } finally {
      this.finishBlockCall(node, result)
    }
  }

  finishBlockCall(node: FinishBlockNode | BuiltInNode, value: IObject) {
    this.pushData(value ? value : Null)
    this.popCallStack()
    this.currentSpace = node.previousSpace
  }

  // When an exception is thrown we need to grab the current callStack
  // and then trigger the eval to unwind the current call stack until we hit
  // a command that can handle the exception or we end execution entirely.
  throwException(node: Node, exception) {
    let orig = exception

    // If we've got a Javascript-level exception, built a new Exception object
    // providing the JS exception as its `data` field.
    if(orig instanceof Error) {
      exception = NewObject(this.Exception, orig)
      SetSlot(exception, AsString("message"), ToObject(orig.message))
    }

    // Try to get our message exposed as well, which is different depending on
    // a JS-level error or one of our own custom errors
    //
    // TODO This is a little messy checking for lexer/parser errors
    // at this level. Possibly a place for pulling out logic.
    if((orig instanceof errors.RuntimeError) || (orig instanceof SyntaxError)) {
      SetSlot(exception, AsString("message"), ToObject(orig.errorType()))
    }

    // Apply our language-level call stack to the new exception
    // but only if there isn't already a callstack. We don't want to clobber if
    // this exception goes through multiple handlers!
    if(ObjectIs(exception, this.Exception) == True) {
      // TODO: If this exception is re-thrown, do we need to make sure the
      // backtrace isn't clobbered?

      // By default the call stack is just the series of calls that led to
      // the current line, and does not include the current line.
      // We have to push one more time at the point of failure to make sure
      // the top of the exceptions backtrace points to the actual line of failure/throw.
      this.pushCallStack((exception.data && exception.data.token) ? exception.data : exception.astNode)
      SetSlot(exception, AsString("backtrace"), ToObject(this.callStack))
      this.popCallStack()
    }

    this.pushEval(
      node,
      [],
      NodeType.ThrowException,
      { exception: exception }
    )
  }

  // The above function, throwException, prepares a Javascript-level exception
  // or an in-language exception to be thrown and sets up a ThrowException eval Node.
  // That node is then passed into this function to actually be processed.
  propogateException(node: ExceptionNode) {
    let nextNode

    while(this.codeStack.length > 0) {
      nextNode = this.codeStack.pop()

      if(nextNode.type === NodeType.HandleException) {
        if(this.handleException(nextNode, node)) {
          return
        }
      }
    }

    // If we end up here, nextNode is the first node of our callstack, which
    // is always the initial ReturnValue. Reject that so it will throw and
    // end all execution in the VM
    nextNode.reject(node.exception)
  }

  // This hook pulls double duty. If we hit this node through normal evaluation,
  // we need to set up the finalizer and make sure it works, when one exists.
  // If we're being called from propogateException above then we need to catch
  // that exception, if so configured, and also ensure finalize runs.
  handleException(node: HandleExceptionNode, catching: ExceptionNode = null) {
    if(node.finallyBlock && node.finallyBlock != Null) {
      this.callBlock(null, node.finallyBlock)
    }

    if(catching && node.catchBlock != Null) {
      this.callBlock(null, node.catchBlock, [catching.exception])
      return true
    }

    return false
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

  pushEval(node: Node, toEval: Node[], finishingNodeType: NodeType, extraOps = {}) {
    let evalNode = {
      type: finishingNodeType,
      node: node,
      token: node.token,

      // These will get filled in in a sec
      returnValue: null,
      promise: null,
    }

    for(let key in extraOps) {
      evalNode[key] = extraOps[key]
    }

    // Manually push this node onto the stack.
    // `eval` sets up a ReturnValue for every call and we don't
    // need a return value for this intermediary node.
    // This is done before we run toEval because we need our evalNode
    // to only run once all of its prequisites (toEval) are processed.
    this.pushCode(evalNode)
    let returnValue

    if(toEval.length > 0) {
      returnValue = this.eval(toEval)
    } else {
      returnValue = new ImmediateReturnValue(null)
    }

    evalNode.returnValue = returnValue
    evalNode.promise = returnValue.promise

    return evalNode
  }

  pushCallStack(node: Node) {
    let sender = NewObject(this.Sender)

    // TODO Something that lets us print out the name of the message?
    // Line is 0-based internally, so we push it to 1-based here for user readability
    SetSlot(sender, AsString("line"), ToObject(node.token.line + 1))
    SetSlot(sender, AsString("file"), AsString(node.token.file))

    // We make use of shift/unshift to keep a reverse order so that in the language
    // `sender` is in the order of most recent call stack first.
    this.callStack.unshift(sender)
  }

  popCallStack() {
    this.callStack.shift()
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
 *
 * If an exception is thrown that is not caught by in-language use of `try`
 * then the ReturnValue will recieve a `reject` on its promise, trigging
 * a throw in javascript land of that exception object (which will be an in-language
 * child of Exception)
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
  }

  resolve(value: IObject) {
    this._resolve(value)
    this._value = value
  }

  reject(exception: IObject) {
    this._reject(exception)
  }

  get value() {
    return this._value
  }

  toString() {
    return "ReturnValue"
  }
}

/**
 * For the cases that there isn't anything to evaluate but where
 * there needs to be something returned, provide one of these
 * with the value that's expected. The promise will be immediately resolved
 * so there will be no waiting.
 * This can be given Javascript's `null` in the case that you need to differentiate
 * between `null` and the language's `Null`.
 */
class ImmediateReturnValue extends ReturnValue {
  constructor(value: IObject) {
    super()
    this.resolve(value)
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

interface EvalArgumentNode extends EvalNode {
  // Name of the argument
  name: string

  // Optional comment to this argument from the parser
  comment?: string

  // Link to the StartBlock command, allowing each pushArgument
  // to update the startBlock data with the arguments it needs.
  startBlock: any
}

interface StartBlockNode extends EvalNode {
  // The owner of the block we are calling.
  // This is used to set `self`.
  // Can be null
  receiver?: IObject

  // Link to the block's scope, used to create a properly encapsulated
  // Space for local assignment.
  scope: IObject

  // How many arguments will be on the stack to apply to this block?
  arguments: Array<any>
}

interface FinishBlockNode extends EvalNode {
  // Link to the space that was active before this block was ran
  // so we know how to pop back out.
  previousSpace: IObject
}

interface BuiltInNode extends FinishBlockNode {
  // Object wrapping our built-in function
  builtIn: IObject
}

interface ExceptionNode extends EvalNode {
  // Our in-language Exception object encapsulating all error details
  exception: IObject
}

interface HandleExceptionNode extends EvalNode {
  // User-provided block to handle any exception this node catches
  catchBlock: IObject

  // User-provided finally block to run as necessary
  finallyBlock: IObject
}
