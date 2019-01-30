import { Token } from "@compiler/tokens"

export enum NodeType {
  NumberLiteral = "NumberLiteral",
  StringLiteral = "StringLiteral",
  BooleanLiteral = "BooleanLiteral",
  NullLiteral = "NullLiteral",
  BlockLiteral = "BlockLiteral",

  Identifier = "Identifier",
  Assignment = "Assignment",

  MessageSend = "MessageSend",
  Message = "Message",
  Argument = "Argument",
  Parameter = "Parameter",

  EvalAssignment = "EvalAssignment",
  EvalMessageSend = "EvalMessageSend",
  EvalBlock = "EvalBlock",
  ReturnValue = "ReturnValue",
}

export interface Node {
  type: NodeType
  token: Token
  comment?: string
  [propName: string]: any
}

export interface NumberNode extends Node {
  value: number
}

export interface StringNode extends Node {
  value: string
}

export interface MessageSendNode extends Node {
  receiver?: Node,
  message: MessageNode
}

export interface MessageNode {
  name: string
  token: Token
  arguments: ArgumentNode[]
}

export interface ArgumentNode {
  // Single arguments won't be keyworded so won't have a name
  name?: string
  value: Node
  comment?: string
}

export interface AssignmentNode extends Node {
  name: string
  right: Node
}

export interface ParameterNode extends Node {
  name: string
  default: Node
}

export interface BlockNode extends Node {
  parameters: ParameterNode[]
  body: Node[]
}
