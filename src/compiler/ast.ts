export enum NodeType {
  NumberLiteral = "NumberLiteral",
  StringLiteral = "StringLiteral",
  BooleanLiteral = "BooleanLiteral",
  NullLiteral = "NullLiteral",

  Identifier = "Identifier",
  Assignment = "Assignment",

  MessageSend = "MessageSend",
  Message = "Message",
  Argument = "Argument",
  Parameter = "Parameter",
  Block = "Block",
}

export interface Node {
  type: NodeType
  [propName: string]: any
}

export interface ParameterNode extends Node {
  name: string
  default: Node
}

export interface BlockNode extends Node {
  parameters: ParameterNode[]
  body: Expression[]
}

export interface Expression {
  node: Node
}
