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

      // Does not match as a number
      { type: TokenType.Identifier, value: "start" },
      { type: TokenType.Identifier, value: "end5" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes identifiers", () => {
    let input = `
      variable
      snake_case
      smallCamelCase
      CamelCase
      _ignoreMe

      a1
      b2two
      c3three3

      こんにちは
      Здравствуйте
      Χαίρετε
    `

    let expected = [
      // Basic identifiers
      { type: TokenType.Identifier, value: "variable" },
      { type: TokenType.Identifier, value: "snake_case" },
      { type: TokenType.Identifier, value: "smallCamelCase" },
      { type: TokenType.Identifier, value: "CamelCase" },

      // Prefix with underscore is valid (a "ignore me" type value)
      { type: TokenType.Identifier, value: "_ignoreMe" },

      // Numbers
      { type: TokenType.Identifier, value: "a1" },
      { type: TokenType.Identifier, value: "b2two" },
      { type: TokenType.Identifier, value: "c3three3" },

      // Unicode
      { type: TokenType.Identifier, value: "こんにちは" },
      { type: TokenType.Identifier, value: "Здравствуйте" },
      { type: TokenType.Identifier, value: "Χαίρετε" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes strings", () => {
    let input = `
      "one"
      'two'
      "thr'ee"
      'fo"ur'
      "fi\\"ve"
      'si\\'x'
      "sev\nen"
      "ei\tght"
      "nine\\"nine\\\\"nine\\\\\\"nine"
      "こんにちは"
    `

    let expected = [
      { type: TokenType.String, value: `one` },
      { type: TokenType.String, value: `two` },
      { type: TokenType.String, value: `thr'ee` },
      { type: TokenType.String, value: `fo"ur` },
      { type: TokenType.String, value: `fi\\"ve` },
      { type: TokenType.String, value: `si\\'x` },
      { type: TokenType.String, value: `sev\nen` },
      { type: TokenType.String, value: `ei\tght` },
      { type: TokenType.String, value: `nine\\"nine\\\\"nine\\\\\\"nine` },
      { type: TokenType.String, value: `こんにちは` },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes operators", () => {
    let input = `
      1 + 2 * 3 - 4 / 5
      obj = 1
      1 > 2
      1 >= 2
      1 < 2
      1 <= 2
      1 == 2
      1 != 2
      obj.message
      !true
      -1
    `

    let expected = [
      // Normal math
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.Operator, value: "*" },
      { type: TokenType.Number, value: "3" },
      { type: TokenType.Operator, value: "-" },
      { type: TokenType.Number, value: "4" },
      { type: TokenType.Operator, value: "/" },
      { type: TokenType.Number, value: "5" },

      // Assignment
      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Operator, value: "=" },
      { type: TokenType.Number, value: "1" },

      // Comparisons
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: ">" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: ">=" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "<" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "<=" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "==" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "!=" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Operator, value: "." },
      { type: TokenType.Identifier, value: "message" },

      // Unary
      { type: TokenType.Operator, value: "!" },
      { type: TokenType.Identifier, value: "true" },

      { type: TokenType.Operator, value: "-" },
      { type: TokenType.Number, value: "1" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes parentheses and groupings", () => {
    let input = `
      (1 + 2) * 3
      obj.method(1)
    `

    let expected = [
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.CloseParen, value: ")" },
      { type: TokenType.Operator, value: "*" },
      { type: TokenType.Number, value: "3" },

      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Operator, value: "." },
      { type: TokenType.Identifier, value: "method" },
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.CloseParen, value: ")" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes method calls with arguments", () => {
    let input = `
      send(arg1: 1, arg2: var1, arg3: (1 + 2))
    `

    let expected = [
      { type: TokenType.Identifier, value: "send" },
      { type: TokenType.OpenParen, value: "(" },

      { type: TokenType.Identifier, value: "arg1" },
      { type: TokenType.Colon, value: ":" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Comma, value: "," },

      { type: TokenType.Identifier, value: "arg2" },
      { type: TokenType.Colon, value: ":" },
      { type: TokenType.Identifier, value: "var1" },
      { type: TokenType.Comma, value: "," },

      { type: TokenType.Identifier, value: "arg3" },
      { type: TokenType.Colon, value: ":" },
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Operator, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.CloseParen, value: ")" },
      { type: TokenType.CloseParen, value: ")" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes method bodies", () => {
    let input = `
      map { |arg1, arg2: default| arg1 + arg2 }
    `

    let expected = [
      { type: TokenType.Identifier, value: "map" },
      { type: TokenType.OpenBlock, value: "{" },

      { type: TokenType.Pipe, value: "|" },
      { type: TokenType.Identifier, value: "arg1" },
      { type: TokenType.Comma, value: "," },

      { type: TokenType.Identifier, value: "arg2" },
      { type: TokenType.Colon, value: ":" },
      { type: TokenType.Identifier, value: "default" },
      { type: TokenType.Pipe, value: "|" },

      { type: TokenType.Identifier, value: "arg1" },
      { type: TokenType.Operator, value: "+" },
      { type: TokenType.Identifier, value: "arg2" },

      { type: TokenType.CloseBlock, value: "}" },
    ]

    assertTokens(input, expected)
  })
})

function assertTokens(input, expected) {
  let lexer = new Lexer(input)
  let tokens = lexer.tokenize()

  assert.equal(tokens.length, expected.length)

  for(var i = 0; i < tokens.length; i++) {
    assert.equal(tokens[i].type, expected[i].type)
    assert.equal(tokens[i].value, expected[i].value)
  }
}
