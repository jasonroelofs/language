import "mocha"
import * as assert from "assert"
import * as util from "util"
import Lexer from "@compiler/lexer"
import {Token, TokenType} from "@compiler/tokens"

describe("Lexer", () => {
  it("tokenizes numbers", () => {
    let input = "1 2.0 3.3 -1 -2.0 -.3 1.2.3 4start end5"
    let expected = [
      // Good matches
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Number, value: "2.0" },
      { type: TokenType.Number, value: "3.3" },

      { type: TokenType.Number, value: "-1" },
      { type: TokenType.Number, value: "-2.0" },
      { type: TokenType.Number, value: "-.3" },

      // Invalid syntax is not invalid tokenization!
      { type: TokenType.Number, value: "1.2" },
      { type: TokenType.Number, value: ".3" },
      { type: TokenType.Number, value: "4" },

      // Does not match as a number
      { type: TokenType.Identifier, value: "start" },
      { type: TokenType.Identifier, value: "end5" },

      { type: TokenType.EOS, value: "" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes identifiers", () => {
    let input = `
      a _ variable snake_case smallCamelCase CamelCase _ignoreMe

      a1 b2two c3three3

      こんにちは Здравствуйте Χαίρετε
    `

    let expected = [
      // Basic identifiers
      { type: TokenType.Identifier, value: "a" },
      { type: TokenType.Identifier, value: "_" },
      { type: TokenType.Identifier, value: "variable" },
      { type: TokenType.Identifier, value: "snake_case" },
      { type: TokenType.Identifier, value: "smallCamelCase" },
      { type: TokenType.Identifier, value: "CamelCase" },

      // Prefix with underscore is valid (a "ignore me" type value)
      { type: TokenType.Identifier, value: "_ignoreMe" },

      // End of statement only counts when we have preceding statements
      { type: TokenType.EOS, value: "\n" },

      // Numbers
      { type: TokenType.Identifier, value: "a1" },
      { type: TokenType.Identifier, value: "b2two" },
      { type: TokenType.Identifier, value: "c3three3" },

      { type: TokenType.EOS, value: "\n" },

      // Unicode
      { type: TokenType.Identifier, value: "こんにちは" },
      { type: TokenType.Identifier, value: "Здравствуйте" },
      { type: TokenType.Identifier, value: "Χαίρετε" },

      { type: TokenType.EOS, value: "\n" },
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
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `two` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `thr'ee` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `fo"ur` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `fi\\"ve` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `si\\'x` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `sev\nen` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `ei\tght` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `nine\\"nine\\\\"nine\\\\\\"nine` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `こんにちは` },
      { type: TokenType.EOS, value: "\n" },
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
    `

    let expected = [
      // Normal math
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.Multiply, value: "*" },
      { type: TokenType.Number, value: "3" },
      { type: TokenType.Minus, value: "-" },
      { type: TokenType.Number, value: "4" },
      { type: TokenType.Divide, value: "/" },
      { type: TokenType.Number, value: "5" },
      { type: TokenType.EOS, value: "\n" },

      // Assignment
      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Assign, value: "=" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.EOS, value: "\n" },

      // Comparisons
      { type: TokenType.Number, value: "1" },
      { type: TokenType.GreaterThan, value: ">" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.GreaterThanEqual, value: ">=" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.LessThan, value: "<" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.LessThanEqual, value: "<=" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.Equal, value: "==" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.NotEqual, value: "!=" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Dot, value: "." },
      { type: TokenType.Identifier, value: "message" },
      { type: TokenType.EOS, value: "\n" },
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
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.CloseParen, value: ")" },
      { type: TokenType.Multiply, value: "*" },
      { type: TokenType.Number, value: "3" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Identifier, value: "obj" },
      { type: TokenType.Dot, value: "." },
      { type: TokenType.Identifier, value: "method" },
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.CloseParen, value: ")" },
      { type: TokenType.EOS, value: "\n" },
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
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.CloseParen, value: ")" },
      { type: TokenType.CloseParen, value: ")" },

      { type: TokenType.EOS, value: "\n" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes block bodies", () => {
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
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Identifier, value: "arg2" },

      { type: TokenType.CloseBlock, value: "}" },

      { type: TokenType.EOS, value: "\n" },
    ]

    assertTokens(input, expected)
  })

  it("supports splitting statements with a semicolon", () => {
    let input = `
      a + 1; b + 2
      map({
      })
      map(
        { a; b; }
      )
    `

    let expected = [
      { type: TokenType.Identifier, value: "a" },
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Number, value: "1" },

      { type: TokenType.EOS, value: ";" },

      { type: TokenType.Identifier, value: "b" },
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Number, value: "2" },

      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Identifier, value: "map" },
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.OpenBlock, value: "{" },

      { type: TokenType.CloseBlock, value: "}" },
      { type: TokenType.CloseParen, value: ")" },

      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Identifier, value: "map" },
      { type: TokenType.OpenParen, value: "(" },
      { type: TokenType.OpenBlock, value: "{" },

      { type: TokenType.Identifier, value: "a" },

      { type: TokenType.EOS, value: ";" },

      { type: TokenType.Identifier, value: "b" },

      { type: TokenType.EOS, value: ";" },

      { type: TokenType.CloseBlock, value: "}" },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.CloseParen, value: ")" },

      { type: TokenType.EOS, value: "\n" },
    ]

    assertTokens(input, expected)
  })

  it("tokenizes comments", () => {
    let input = `
      # This is a comment

      #This is a multi-line
      #   comment

      a + b # this is at the end of a line
    `

    let expected = [
      { type: TokenType.Comment, value: "This is a comment" },

      // Parsing will re-combine these into a single comment structure
      // Also white-space is counted from one character in from the # to support
      // structured documentation.
      { type: TokenType.Comment, value: "This is a multi-line" },
      { type: TokenType.Comment, value: "  comment" },

      { type: TokenType.Identifier, value: "a" },
      { type: TokenType.Plus, value: "+" },
      { type: TokenType.Identifier, value: "b" },

      { type: TokenType.Comment, value: "this is at the end of a line" },

      { type: TokenType.EOS, value: "" },
    ]

    assertTokens(input, expected)
  })

  describe("Error Handling", () => {
    it("errors on unterminated strings", () => {
      let tests = [
        `"one`,
        `'two`,
        `"three\\"`,
        `"four''`,
        `"five''\\"`,
        `'six""\\'`,
      ]

      for(var test of tests) {
        let lexer = new Lexer(test)
        let {tokens, errors} = lexer.tokenize()

        assert.equal(tokens.length, 0, `Returned real tokens for ${test}`)
        assert.equal(errors.length, 1, `Returned the wrong number of errors for ${test}`)

        assert.equal(errors[0].message(), "Unterminated string")
        assert.equal(errors[0].input, test)

        assert.equal(errors[0].pos, 0)
        assert.equal(errors[0].line, 1)
        assert.equal(errors[0].char, 1)
      }
    })

    it("errors on unknown tokens", () => {
    })
  })
})

function assertTokens(input, expected) {
  let lexer = new Lexer(input)
  let {tokens, errors} = lexer.tokenize()

  // console.log("Expected: %o", expected)
  // console.log("Got: %o", tokens)
  assert.equal(tokens.length, expected.length, "Wrong token lengths recorded")
  assert.equal(errors.length, 0)

  for(var i = 0; i < tokens.length; i++) {
    assert.equal(tokens[i].type, expected[i].type, `Wrong type on index ${i}`)
    assert.equal(tokens[i].value, expected[i].value, `Wrong value on index ${i}`)
  }
}
