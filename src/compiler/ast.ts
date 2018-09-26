export enum NodeType {
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,

  Identifier,
}

export interface Node {
  type: NodeType
  value?: number | string | boolean
}

export interface Expression {
  node: Node
}
