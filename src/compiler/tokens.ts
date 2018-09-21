export enum TokenType {
  Number = "NUMBER",
  Unknown = "UNKNOWN",
  EOF = "EOF",
}

export interface Token {
  type: TokenType
  value?: string | number
}
