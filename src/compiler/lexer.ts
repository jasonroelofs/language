import { Token, TokenType, tokenLength } from "@compiler/tokens"

export default class Lexer {

  input: string
  currentPos: number

  constructor(input: string) {
    this.input = input
    this.currentPos = 0
  }

  tokenize(): Array<Token> {
    var tokens: Array<Token> = []

    // Bypass any leading whitespace
    this.skipWhitespace()

    // Neat pattern from CoffeeScript's lexer.
    var chunk: string
    while(chunk = this.input.substring(this.currentPos)) {

      if(chunk == "") {
        break
      }

      let token =
        this.numberToken(chunk) ||
        this.stringToken(chunk) ||
        this.operatorToken(chunk) ||
        this.identifierToken(chunk) ||
        this.unknownToken(chunk)

      if(token) {
        this.consume(token)
        tokens.push(token)
      }
    }

    return tokens
  }

  numberToken(chunk: string) {
    let test = chunk.match(this.NUMBER_REGEX)

    if(test) {
      return { type: TokenType.Number, value: test[0] }
    } else {
      return null
    }
  }

  // Find a string that contains all letters between matching single (')
  // or double (") quotes, but not including those wrapping quotes, and making
  // sure to handle escaped matching quotes, e.g. ("\"" should return the string: `"`)
  stringToken(chunk: string) {
    let starter = chunk[0]
    if(starter == '"' || starter == "'") {

      for(var i = 1; i < chunk.length; i++) {
        if(chunk[i] == starter && chunk[i-1] != "\\") {
          return { type: TokenType.String, value: chunk.substring(1, i), source: chunk.substring(0, i+1) }
        }
      }

      // TODO: We have an unterminated String, this needs to error
      return { type: TokenType.Unknown, value: chunk }
    } else {
      return null
    }
  }

  operatorToken(chunk: string) {
    switch(chunk[0]) {
      case "(":
        return { type: TokenType.OpenParen, value: "(" }
      case ")":
        return { type: TokenType.CloseParen, value: ")" }
      case "{":
        return { type: TokenType.OpenBlock, value: "{" }
      case "}":
        return { type: TokenType.CloseBlock, value: "}" }
      case ":":
        return { type: TokenType.Colon, value: ":" }
      case ",":
        return { type: TokenType.Comma, value: "," }
      case "|" :
        return { type: TokenType.Pipe, value: "|" }
      case ".":
        return { type: TokenType.Dot, value: "." }
    }

    var test = chunk.substring(0, 2)
    var tokenType = this.COMPOUND_OPERATORS[test]
    if(tokenType) {
      return { type: tokenType, value: test }
    }

    test = chunk[0]
    tokenType = this.SINGLE_OPERATORS[test]
    if(tokenType) {
      return { type: tokenType, value: test }
    }

    return null
  }

  identifierToken(chunk: string) {
    let test = chunk.match(this.IDENTIFIER_REGEX)

    if(test) {
      return { type: TokenType.Identifier, value: test[0] }
    } else {
      return null
    }
  }

  // Fall-through final token type if nothing else matches
  // Grab everything up til the next whitespace.
  unknownToken(chunk: string) {
    let match = chunk.match(this.UNKNOWN_REGEX)
    return { type: TokenType.Unknown, value: match[0] }
  }

  consume(token: Token) {
    this.currentPos += tokenLength(token)
    this.skipWhitespace()
  }

  skipWhitespace() {
    let ws = this.input.substring(this.currentPos).match(/^\s+/)
    if(ws) {
      this.currentPos += ws[0].length

      // Lets try again to see if we found a new-line and if the next line
      // is itself whitespace.
      // Javascript doesn't really support the \A anchor making multiline matches
      // problematic
      this.skipWhitespace()
    }
  }

  /**
   * Regex matchers
   */

  // Match all number types.
  NUMBER_REGEX = /^\d*\.?\d+/

  // Identifiers:
  //
  // * Unicode
  // * Any case
  // * Have underscores
  // * Start with an underscore
  // * Cannot start with a number
  // * Cannot contain spaces
  // * Cannot contain dashes
  //
  // Taken and modified from Coffeescript
  //
  IDENTIFIER_REGEX = /^[^\d\.](?:(?!\s)[\w\x7f-\uffff])*/

  // Operators
  SINGLE_OPERATORS = {
    '+': TokenType.Plus,
    '-': TokenType.Minus,
    '*': TokenType.Multiply,
    '/': TokenType.Divide,
    '<': TokenType.LessThan,
    '>': TokenType.GreaterThan,
    '!': TokenType.Bang,
    '=': TokenType.Assign,
  }

  COMPOUND_OPERATORS = {
    '<=': TokenType.LessThanEqual,
    '>=': TokenType.GreaterThanEqual,
    '==': TokenType.Equal,
    '!=': TokenType.NotEqual,
  }

  UNKNOWN_REGEX = /^\S+/
}
