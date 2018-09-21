import { Token, TokenType } from "@compiler/tokens"

export default class Lexer {

  input: string
  currentPos: number

  constructor(input: string) {
    this.input = input
    this.currentPos = 0
  }

  nextToken(): Token {
    // console.log("Next token. Current position is %o", this.currentPos)

    if(this.atEOF()) {
      return { type: TokenType.EOF }
    }

    // Neat pattern from CoffeeScript's lexer.
    var chunk: string
    while(chunk = this.input.substring(this.currentPos)) {

      let token =
        this.numberToken(chunk) ||
        this.unknownToken(chunk)

      if(token) {
        this.consume(token.value)
        return token
      }
    }
  }

  numberToken(chunk: string) {
    let test = chunk.match(this.NUMBER_REGEX)

    if(test) {
      return { type: TokenType.Number, value: test[0] }
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

  consume(chunk: string) {
    this.currentPos += chunk.length
    this.skipWhitespace()
  }

  skipWhitespace() {
    let ws = this.input.substring(this.currentPos).match(/^\s+/)
    if(ws) {
      this.currentPos += ws[0].length
    }
  }

  atEOF() {
    return this.currentPos >= this.input.length
  }

  /**
   * Regex matchers
   */

  // Match all number types.
  //
  NUMBER_REGEX = /^\d*\.?\d+/

  UNKNOWN_REGEX = /^\S+/
}
