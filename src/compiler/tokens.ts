export enum TokenType {
  Number = "NUMBER",
  Identifier = "IDENTIFIER",
  String = "STRING",
  Comment = "COMMENT",

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

  // The EOS marker is used to keep track of where a statement
  // is expected to end. This can be provided by the user as an explicit
  // seperator or will be added to the token list in defined situations.
  // The value of this token will be the semi-colon if user provided, or will be
  // whitespace if automatically inserted.
  EOS = "END_OF_STATEMENT",

  Error = "ERROR",
  EOF = "EOF",
}

export interface Token {
  type: TokenType
  value?: string
  source?: string

  // 1-based line number of the input
  line?: number
  // 1-based character position on the current line
  char?: number
}

export function tokenLength(token: Token) {
  if(token.source) {
    return token.source.length
  } else {
    return token.value.length
  }
}
