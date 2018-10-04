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
}

export interface Node {
  type: NodeType
  [propName: string]: any
}

export interface Expression {
  node: Node
}
