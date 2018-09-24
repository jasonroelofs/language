import { Token, TokenType } from "@compiler/tokens"

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
        this.operatorToken(chunk) ||
        this.identifierToken(chunk) ||
        this.unknownToken(chunk)

      if(token) {
        this.consume(token.value)
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

  identifierToken(chunk: string) {
    let test = chunk.match(this.IDENTIFIER_REGEX)

    if(test) {
      return { type: TokenType.Identifier, value: test[0] }
    } else {
      return null
    }
  }

  operatorToken(chunk: string) {
    var test: string

    test = chunk.substring(0, 2)
    if(this.COMPOUND_OPERATORS.indexOf(test) > -1) {
      return { type: TokenType.Operator, value: test }
    }

    test = chunk[0]
    if(this.SINGLE_OPERATORS.indexOf(test) > -1) {
      return { type: TokenType.Operator, value: test }
    }

    return null
  }

  // Fall-through final token type if nothing else matches
  // Grab everything up til the next whitespace.
  unknownToken(chunk: string) {
    let match = chunk.match(this.UNKNOWN_REGEX)
    return { type: TokenType.Unknown, value: match[0] }
  }

  consume(chunk: string) {
    this.currentPos += chunk.length
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
  IDENTIFIER_REGEX = /^[^\d\.](?:(?!\s)[\w\x7f-\uffff]|_)+/

  // Operators
  SINGLE_OPERATORS = ['+', '-', '*', '/', '>', '<', '!', '=', '.']
  COMPOUND_OPERATORS = ['>=', '<=', '!=', '==']

  UNKNOWN_REGEX = /^\S+/
}
