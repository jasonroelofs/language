export enum NodeType {
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,

  MessageSend,
  Message,
  Argument,

  Identifier,
}

export interface Node {
  type: NodeType
  [propName: string]: any
}

export interface Expression {
  node: Node
}
