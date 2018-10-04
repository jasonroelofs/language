export enum TokenType {
  Number = "NUMBER",
  Identifier = "IDENTIFIER",
  String = "STRING",

  OpenParen = "OPEN_PAREN",
  CloseParen = "CLOSE_PAREN",
  OpenBlock = "OPEN_BLOCK",
  CloseBlock = "CLOSE_BLOCK",
  Comma = "COMMA",
  Colon = "COLON",
  Pipe = "PIPE",
  Dot = "DOT",

  Plus = "PLUS",
  Minus = "MINUS",
  Multiply = "MULTIPLY",
  Divide = "DIVIDE",
  Assign = "ASSIGN",
  LessThan = "LESS_THAN",
  LessThanEqual = "LESS_THAN_OR_EQUAL",
  GreaterThan = "GREATER_THAN",
  GreaterThanEqual = "GREATER_THAN_OR_EQUAL",
  Equal = "EQUAL",
  NotEqual = "NOT_EQUAL",
  Bang = "BANG",

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
