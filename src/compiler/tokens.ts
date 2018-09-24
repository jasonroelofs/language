export enum TokenType {
  Number = "NUMBER",
  Identifier = "IDENTIFIER",
  Operator = "OPERATOR",

  Unknown = "UNKNOWN",
  EOF = "EOF",
}

export interface Token {
  type: TokenType
  value?: string | number
}
