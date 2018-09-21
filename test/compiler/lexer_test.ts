import "mocha"
import * as assert from "assert"
import Lexer from "@compiler/lexer"
import {Token, TokenType} from "@compiler/tokens"

describe("Lexer", () => {
  it("tokenizes numbers", () => {
    let input = "1 2.0 3.3 1.2.3 4start end5"
    let expected = [
      // Good matches
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Number, value: "2.0" },
      { type: TokenType.Number, value: "3.3" },

      // Invalid syntax is not invalid tokenization!
      { type: TokenType.Number, value: "1.2" },
      { type: TokenType.Number, value: ".3" },
      { type: TokenType.Number, value: "4" },

      // Does not match
      { type: TokenType.Unknown, value: "start" },
      { type: TokenType.Unknown, value: "end5" },
      { type: TokenType.EOF }
    ]

    assertTokens(input, expected)
  })
})

function assertTokens(input, expected) {
  let lexer = new Lexer(input)

  for(let token of expected) {
    let next = lexer.nextToken()

    assert.deepEqual(token, next)
  }
}
