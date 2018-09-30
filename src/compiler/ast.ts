export enum NodeType {
  NumberLiteral = "NumberLiteral",
  StringLiteral = "StringLiteral",
  BooleanLiteral = "BooleanLiteral",
  NullLiteral = "NullLiteral",

  MessageSend = "MessageSend",
  Message = "Message",
  Argument = "Argument",

  Identifier = "Identifier",
}

export interface Node {
  type: NodeType
  [propName: string]: any
}

export interface Expression {
  node: Node
}
