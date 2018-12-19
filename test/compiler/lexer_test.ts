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
      "sev\\nen"
      "ei\\tght"
      "nine\\"nine\\\"nine\\\\\\\"nine"
      "こんにちは"
      "\\n\\t"
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
      { type: TokenType.String, value: `nine\\"nine\\\"nine\\\\\"nine` },
      { type: TokenType.EOS, value: "\n" },
      { type: TokenType.String, value: `こんにちは` },
      { type: TokenType.EOS, value: "\n" },
      // These need to be escaped in the test string above to work
      // around Javascript itself turning them into their characters.
      { type: TokenType.String, value: "\n\t"},
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
      1 && 2
      1 || 2
      !true
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

      // Boolean operators
      { type: TokenType.Number, value: "1" },
      { type: TokenType.AndAnd, value: "&&" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Number, value: "1" },
      { type: TokenType.OrOr, value: "||" },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Not, value: "!" },
      { type: TokenType.Identifier, value: "true" },
      { type: TokenType.EOS, value: "\n" },

      // Message sending is an operator
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

      #
      # This comment has lots
      #
      # of stray
      #
      # Whitespace
      #
      #   Keeping Indents
      #
      c
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

      { type: TokenType.Comment, value: "" },
      { type: TokenType.Comment, value: "This comment has lots" },
      { type: TokenType.Comment, value: "" },
      { type: TokenType.Comment, value: "of stray" },
      { type: TokenType.Comment, value: "" },
      { type: TokenType.Comment, value: "Whitespace" },
      { type: TokenType.Comment, value: "" },
      { type: TokenType.Comment, value: "  Keeping Indents" },
      { type: TokenType.Comment, value: "" },

      { type: TokenType.Identifier, value: "c" },

      { type: TokenType.EOS, value: "\n" },
    ]

    assertTokens(input, expected)
  })

  it("includes input positioning information in tokens", () => {
    let input = `
      a
      b; c + d
      "long string
        multiline"
        nested
    `

    let lexer = new Lexer(input)
    let tokens = lexer.tokenize()

    assert.equal(tokens[0].pos, 7, "Wrong position for a")
    assert.equal(tokens[1].pos, 8, "Wrong position for EOS after a")
    assert.equal(tokens[2].pos, 15, "Wrong position for b")
    assert.equal(tokens[3].pos, 16, "Wrong position for EOS (;) after b")
    assert.equal(tokens[4].pos, 18, "Wrong position for c")
    assert.equal(tokens[5].pos, 20, "Wrong position for +")
    assert.equal(tokens[6].pos, 22, "Wrong position for d")
    assert.equal(tokens[7].pos, 23, "Wrong position for EOS after d")
    assert.equal(tokens[8].pos, 30, "Wrong position for string")
    assert.equal(tokens[9].pos, 61, "Wrong position for EOS after string")
    assert.equal(tokens[10].pos, 70, "Wrong position for nested")

    assert.equal(tokens[0].line, 1, "Wrong line for a")
    assert.equal(tokens[1].line, 1, "Wrong line for EOS after a")
    assert.equal(tokens[2].line, 2, "Wrong line for b")
    assert.equal(tokens[3].line, 2, "Wrong line for EOS (;) after b")
    assert.equal(tokens[4].line, 2, "Wrong line for c")
    assert.equal(tokens[5].line, 2, "Wrong line for +")
    assert.equal(tokens[6].line, 2, "Wrong line for d")
    assert.equal(tokens[7].line, 2, "Wrong line for EOS after d")
    assert.equal(tokens[8].line, 3, "Wrong line for string")
    assert.equal(tokens[9].line, 4, "Wrong line for EOS after string")
    assert.equal(tokens[10].line, 5, "Wrong line for nested")

    assert.equal(tokens[0].ch, 6, "Wrong character for a")
    assert.equal(tokens[1].ch, 7, "Wrong character for EOS after a")
    assert.equal(tokens[2].ch, 6, "Wrong character for b")
    assert.equal(tokens[3].ch, 7, "Wrong character for EOS (;) after b")
    assert.equal(tokens[4].ch, 9, "Wrong character for c")
    assert.equal(tokens[5].ch, 11, "Wrong character for +")
    assert.equal(tokens[6].ch, 13, "Wrong character for d")
    assert.equal(tokens[7].ch, 14, "Wrong character for EOS after d")
    assert.equal(tokens[8].ch, 6, "Wrong character for string")
    assert.equal(tokens[9].ch, 18, "Wrong character for EOS after string")
    assert.equal(tokens[10].ch, 8, "Wrong character for nested")
  })

  it("tokenizes other operators", () => {
    let input = `
      [1, 2, 3]
      list[1]
    `

    let expected = [
      { type: TokenType.OpenSquare, value: "[" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.Comma, value: "," },
      { type: TokenType.Number, value: "2" },
      { type: TokenType.Comma, value: "," },
      { type: TokenType.Number, value: "3" },
      { type: TokenType.CloseSquare, value: "]" },

      { type: TokenType.EOS, value: "\n" },

      { type: TokenType.Identifier, value: "list" },
      { type: TokenType.OpenSquare, value: "[" },
      { type: TokenType.Number, value: "1" },
      { type: TokenType.CloseSquare, value: "]" },

      { type: TokenType.EOS, value: "\n" },
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
        assertError(test, "Unterminated String", 0)
      }
    })

    it("errors on unknown escape sequences", () => {
      let tests = [
        `"\\e"`,
        `"\\%"`
      ]

      for(var test of tests) {
        assertError(test, "Unknown Escape Sequence", 0)
      }
    })

    it("errors on unknown tokens", () => {
      // This set of tests will probably shrink as new tokens are allowed
      // in the lexer. But for now, these are errors!
      let tests = [
        `^`,
        `$`,
      ]

      for(var test of tests) {
        assertError(test, `Unknown Token '${test}'`, 0)
      }
    })

    function assertError(input, expectedType, expectedPos) {
      try {
        let lexer = new Lexer(input)
        let tokens = lexer.tokenize()

        assert.fail("Expected lexer to throw an error, none thrown")
      } catch(error) {
        assert.equal(error.errorType(), expectedType)
        assert.equal(error.pos, expectedPos)
      }
    }
  })
})

function assertTokens(input, expected) {
  try {
    let lexer = new Lexer(input, {filePath: "[test file]"})
    let tokens = lexer.tokenize()

    //console.log("Expected: %o", expected)
    //console.log("Got: %o", tokens)
    assert.equal(tokens.length, expected.length, "Wrong token lengths recorded")

    for(var i = 0; i < tokens.length; i++) {
      assert.equal(tokens[i].type, expected[i].type, `Wrong type on index ${i}`)
      assert.equal(tokens[i].value, expected[i].value, `Wrong value on index ${i}`)
      assert.equal(tokens[i].file, "[test file]", `Did not store the source file path on ${i}`)
    }
  } catch(e) {
    assert.fail(e)
  }
}
