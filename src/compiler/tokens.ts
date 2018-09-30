export enum TokenType {
  Number = "NUMBER",
  Identifier = "IDENTIFIER",
  Operator = "OPERATOR",
  String = "STRING",

  OpenParen = "OPEN_PAREN",
  CloseParen = "CLOSE_PAREN",
  OpenBlock = "OPEN_BLOCK",
  CloseBlock = "CLOSE_BLOCK",
  Comma = "COMMA",
  Colon = "COLON",
  Pipe = "PIPE",
  Dot = "DOT",

  Unknown = "UNKNOWN",
  EOF = "EOF",
}

export interface Token {
  type: TokenType
  value?: string
  source?: string
}

export function tokenLength(token: Token) {
  if(token.source) {
    return token.source.length
  } else {
    return token.value.length
  }
}
