export enum NodeType {
  NumberLiteral
}

export interface Node {
  type: NodeType
  value: number | string
}

export interface Expression {
  node: Node
}
