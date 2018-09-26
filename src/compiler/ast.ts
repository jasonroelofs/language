export enum NodeType {
  NumberLiteral,
  StringLiteral,
}

export interface Node {
  type: NodeType
  value: number | string
}

export interface Expression {
  node: Node
}
