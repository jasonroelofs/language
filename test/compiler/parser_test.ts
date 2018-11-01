import "mocha"
import * as assert from "assert"
import * as util from "util"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import { NodeType, Node } from "@compiler/ast"
import * as errors from "@compiler/errors"

describe("Parser", () => {
  it("parses Numbers", () => {
    let tests = {
      "1"   : { type: NodeType.NumberLiteral, value: 1 },
      "2.0" : { type: NodeType.NumberLiteral, value: 2.0 },
      "3.3" : { type: NodeType.NumberLiteral, value: 3.3 },
      "-1" : { type: NodeType.NumberLiteral, value: -1 },
      "-2.0" : { type: NodeType.NumberLiteral, value: -2.0 },
      "-.3" : { type: NodeType.NumberLiteral, value: -0.3 },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses Strings", () => {
    let tests = {
      '"one"'      : { type: NodeType.StringLiteral, value: "one" },
      '"two and"'  : { type: NodeType.StringLiteral, value: "two and" },
      '"three\'s"' : { type: NodeType.StringLiteral, value: "three's" },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses identifiers", () => {
    let tests = {
      "var1"       : { type: NodeType.Identifier, value: "var1" },
      "こんにちは" : { type: NodeType.Identifier, value: "こんにちは" },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses special literals", () => {
    let tests = {
      "true"  : { type: NodeType.BooleanLiteral, value: true },
      "false" : { type: NodeType.BooleanLiteral, value: false },
      "null"  : { type: NodeType.NullLiteral },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses message sends", () => {
    let tests = {
      // Sending a message, no parameters
      "obj.message()" : {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [],
        },
      },
      // Parens are optional when no parameters
      "obj.message" : {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [],
        },
      },
      "obj.message(1)": {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [
            { value: { type: NodeType.NumberLiteral, value: 1 } }
          ]
        },
      },
      // Expressions can be arguments
      "obj.message(a + b)": {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [
            { value: {
              type: NodeType.MessageSend,
              receiver: { type: NodeType.Identifier, value: "a" },
              message: {
                name: "+",
                arguments: [{ value: { type: NodeType.Identifier, value: "b" } }]
              }
            }}
          ]
        },
      },
      // > 1 parameter, must be keywords
      "obj.message(a1: a1, a2: a.b)": {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [
            {
              name: "a1",
              value: { type: NodeType.Identifier, value: "a1" }
            },
            {
              name: "a2",
              value: {
                type: NodeType.MessageSend,
                receiver: { type: NodeType.Identifier, value: "a" },
                message: { name: "b", arguments: [] },
              }
            }
          ]
        }
      },
      // > 1 parameter, but first parameter can still be unnamed
      "obj.message(a1, a2: a.b)": {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [
            {
              value: { type: NodeType.Identifier, value: "a1" }
            },
            {
              name: "a2",
              value: {
                type: NodeType.MessageSend,
                receiver: { type: NodeType.Identifier, value: "a" },
                message: { name: "b", arguments: [] },
              }
            }
          ]
        }
      },
      // Keys can also be strings, for situations where the key wouldn't make
      // a legit identifier.
      [`obj.message("a": a, "b": b)`]: {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: {
          name: "message",
          arguments: [
            {
              name: "a",
              value: { type: NodeType.Identifier, value: "a" }
            },
            {
              name: "b",
              value: { type: NodeType.Identifier, value: "b" }
            }
          ]
        }
      },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("allows messages to be given blocks as arguments", () => {
    // Blocks can be passed in as arguments.
    // The `b` at the end helped trigger a parser error that this
    // test proves is fixed.
    let test = "a.call(\n{},\nc: {}\n)\nb"
    let expected = {
      type: NodeType.MessageSend,
      receiver: { type: NodeType.Identifier, value: "a" },
      message: {
        name: "call",
        arguments: [
          { value: { type: NodeType.Block, parameters: [], body: [] } },
          { name: "c", value: { type: NodeType.Block, parameters: [], body: [] } },
        ]
      }
    }

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 2)
    assert.deepEqual(expressions[0].node, expected, `Comparison failed for ''${test}''`)
  })

  it("parses assignment", () => {
    let tests = {
      "a = 1" : {
        type: NodeType.Assignment,
        name: "a",
        right: {
          type: NodeType.NumberLiteral,
          value: 1,
        }
      },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  /**
   * The following are syntax sugar and need to be rewritten to be
   * message sends on the object.
   */
  it("parses infix expressions", () => {
    let operators = [
      "+", "-", "*", "/", "<", "<=", ">", ">=", "==", "!="
    ]
    var tests = {}

    for(var op of operators) {
      tests[`1 ${op} 2`] = {
        type: NodeType.MessageSend,
        receiver: { type: NodeType.NumberLiteral, value: "1" },
        message: {
          name: op,
          arguments: [{ value: { type: NodeType.NumberLiteral, value: "2" } }]
        }
      }
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses complex infix expressions", () => {
    let tests = {
      "1 + 2 - 3": {
        // (1.+(2)).-(3))
        type: NodeType.MessageSend,
        receiver: {
          type: NodeType.MessageSend,
          receiver: { type: NodeType.NumberLiteral, value: "1" },
          message: {
            name: "+",
            arguments: [{ value: { type: NodeType.NumberLiteral, value: "2" } }],
          }
        },
        message: {
          name: "-",
          arguments: [{ value: { type: NodeType.NumberLiteral, value: "3" } }]
        }
      },
      "1 + 2 * 3": {
        // Operator precedence
        // 1.+(2.*(3))
        type: NodeType.MessageSend,
        receiver: { type: NodeType.NumberLiteral, value: "1" },
        message: {
          name: "+",
          arguments: [{ value: {
            type: NodeType.MessageSend,
            receiver: { type: NodeType.NumberLiteral, value: "2" },
            message: {
              name: "*",
              arguments: [{ value: { type: NodeType.NumberLiteral, value: "3" } }]
            }
          }}]
        }
      },
      "1 * 2 + 3 / 4": {
        // Operator precedence
        // (1.*(2)).+(3./(4))

        // left * right
        type: NodeType.MessageSend,
        receiver: {
          // 1 * 2
          type: NodeType.MessageSend,
          receiver: { type: NodeType.NumberLiteral, value: "1" },
          message: {
            name: "*",
            arguments: [{ value: { type: NodeType.NumberLiteral, value: "2" } }]
          }
        },
        message: {
          name: "+",
          arguments: [{ value: {
            // 3 / 4
            type: NodeType.MessageSend,
            receiver: { type: NodeType.NumberLiteral, value: "3" },
            message: {
              name: "/",
              arguments: [{ value: { type: NodeType.NumberLiteral, value: "4"} }]
            }
          }}]
        }
      },
      "(1 + 2) * (3 - 4)": {
        // Forced grouping of expressions
        type: NodeType.MessageSend,
        receiver: {
          // 1 + 2
          type: NodeType.MessageSend,
          receiver: { type: NodeType.NumberLiteral, value: "1" },
          message: {
            name: "+",
            arguments: [{ value: { type: NodeType.NumberLiteral, value: "2" } }]
          }
        },
        message: {
          name: "*",
          arguments: [{ value: {
            // 3 / 4
            type: NodeType.MessageSend,
            receiver: { type: NodeType.NumberLiteral, value: "3" },
            message: {
              name: "-",
              arguments: [{ value: { type: NodeType.NumberLiteral, value: "4"} }]
            }
          }}]
        }
      }
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses blocks", () => {
    let tests = {
      // Plain block, no parameters
      "{ 1 }": {
        type: NodeType.Block,
        parameters: [],
        body: [
          { node: { type: NodeType.NumberLiteral, value: "1" } }
        ]
      },
      // Block with one parameter
      "{ |a| a }": {
        type: NodeType.Block,
        parameters: [
          { type: NodeType.Parameter, name: "a", default: null }
        ],
        body: [
          { node: { type: NodeType.Identifier, value: "a" } }
        ]
      },
      // Multiple parameters
      "{ |a, b, c| a; b; c }": {
        type: NodeType.Block,
        parameters: [
          { type: NodeType.Parameter, name: "a", default: null },
          { type: NodeType.Parameter, name: "b", default: null },
          { type: NodeType.Parameter, name: "c", default: null },
        ],
        body: [
          { node: { type: NodeType.Identifier, value: "a" } },
          { node: { type: NodeType.Identifier, value: "b" } },
          { node: { type: NodeType.Identifier, value: "c" } },
        ]
      },
      // Parameters with defaults
      "{ |a: 1, b: 2 + 4, c: a + b| c }": {
        type: NodeType.Block,
        parameters: [
          {
            type: NodeType.Parameter,
            name: "a",
            default: { type: NodeType.NumberLiteral, value: "1" }
          },
          {
            type: NodeType.Parameter,
            name: "b",
            default: {
              type: NodeType.MessageSend,
              receiver: { type: NodeType.NumberLiteral, value: "2" },
              message: { name: "+", arguments: [{ value: { type: NodeType.NumberLiteral, value: "4" } }] }
            }
          },
          {
            type: NodeType.Parameter,
            name: "c",
            default: {
              type: NodeType.MessageSend,
              receiver: { type: NodeType.Identifier, value: "a" },
              message: { name: "+", arguments: [{ value: { type: NodeType.Identifier, value: "b" } }] }
            }
          },
        ],
        body: [
          { node: { type: NodeType.Identifier, value: "c" } }
        ]
      },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("attaches comments to AST nodes", () => {
    let test = `
      # Attach to the next expression
      a

      b # This comment is ignored

      # Multi-line
      # Comments
      # are re-combined
      c

      # Attach me to d
      d = Object.new()
    `

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 4)

    assert.deepEqual(
      expressions[0].node,
      { type: NodeType.Identifier, value: "a", comment: "Attach to the next expression" }
    )

    assert.deepEqual(
      expressions[1].node,
      { type: NodeType.Identifier, value: "b" }
    )

    assert.deepEqual(
      expressions[2].node,
      { type: NodeType.Identifier, value: "c", comment: "Multi-line\nComments\nare re-combined" }
    )

    assert.deepEqual(
      expressions[3].node,
      {
        type: NodeType.Assignment,
        name: "d",
        right: {
          type: NodeType.MessageSend,
          receiver: { type: NodeType.Identifier, value: "Object" },
          message: {
            name: "new",
            arguments: []
          }
        },
        comment: "Attach me to d"
      }
    )
  })

  it("supports attaching comments to method arguments", () => {
    let test = `
      Object.new(
        # This is the first method
        first: 1,

        # This is the second method
        second: 2,
      )
    `

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 1)

    let message = expressions[0].node.message

    assert.equal(message.arguments[0].comment, "This is the first method")
    assert.equal(message.arguments[1].comment, "This is the second method")
  })

  describe("Error handling", () => {
    it("errors on tokens that aren't supposed to start a statement", () => {
      assertError("*15", {
        errorType: errors.InvalidStartOfExpressionError,
        position: 0
      })
    })

    it("errors where a statement is supposed to end but doesn't", () => {
      assertError("a + b c + d", {
        errorType: errors.ExpectedEndOfExpressionError,
        position: 6
      })
    })

    it("errors on unclosed grouping expressions", () => {
      let tests = [
        "(a + b",
        "{a + b",
      ]

      for(var test of tests) {
        let error = assertError(test, {
          errorType: errors.UnmatchedClosingTagError,
          position: 6
        }) as errors.UnmatchedClosingTagError

        // We also have a startToken that points at the opening
        // of the expression
        assert.equal(error.startToken.pos, 0)
      }
    })

    it("errors properly on nested unclosed groups", () => {
      let test = "(a + b * (c - d\n)"

      let error = assertError(test, {
        errorType: errors.UnmatchedClosingTagError,
        position: 17,
      }) as errors.UnmatchedClosingTagError

      // We should find the first opening (
      assert.equal(error.startToken.pos, 0, "Wrong startToken position")
    })

    it("errors on incomplete binary operations", () => {
      // [input, position]
      let tests = [
        ["a = ", 2],
        ["1 + ", 2],
        ["3 < ", 2],
        ["thing *", 6],
        // Across new-lines shouldn't matter
        ["1 +\n", 2],
      ]

      for(var test of tests) {
        assertError(test[0], {
          errorType: errors.IncompleteExpressionError,
          position: test[1]
        })
      }
    })

    it("errors on invalid block expressions", () => {
      // [input, position, errorType]
      let tests = [
        // Unclosed parameters
        ["{|a }", 4, errors.ExpectedTokenMissingError],
        // Invalid argument name
        ["{|1| }", 2, errors.InvalidParameterError],
        // Missing a comma or colon
        ["{|a b| }", 4, errors.ExpectedTokenMissingError],
        ["{|a 'default'| }", 4, errors.ExpectedTokenMissingError],
        ["{|a 1 + 2| }", 4, errors.ExpectedTokenMissingError],
        // Missing a default value
        ["{|a: ", 3, errors.IncompleteParameterError],
        ["{|a:, b| }", 3, errors.IncompleteParameterError],
        // Invalid expression as a default value
        ["{|a: 1+| }", 7, errors.IncompleteExpressionError],
      ]

      for(var test of tests) {
        assertError(test[0], {
          errorType: test[2],
          position: test[1]
        })
      }
    })

    it("errors on invalid message send syntax", () => {
      // [input, position, errorType]
      let tests = [
        // Unclosed
        ["obj.message(", 12, errors.UnmatchedClosingTagError],
        // Missing keywords
        ["obj.message(1, 2)", 15, errors.MissingArgumentNameError],
        // Invalid token for keyword
        ["obj.message(1, 2: 2)", 15, errors.InvalidArgumentNameError],
        // Missing value
        ["obj.message(arg:)", 16, errors.MissingArgumentValueError],
        // Missing colon
        ["obj.message(arg 1, arg2: 2)", 16, errors.ExpectedTokenMissingError],
        // Invalid argument expression
        ["obj.message(arg: 1 +)", 20, errors.IncompleteExpressionError],
      ]

      for(var test of tests) {
        assertError(test[0], {
          errorType: test[2],
          position: test[1]
        })
      }
    })

    function assertError(input, {errorType, position}) {
      let lexer = new Lexer(input)
      var {tokens, errors} = lexer.tokenize()

      assert.equal(errors.length, 0, `Lexer found errors in ${input}`)

      let parser = new Parser(tokens)
      var {expressions, errors} = parser.parse()

      assert.equal(errors.length, 1, `Parser should have thrown errors in ${input}`)
      assert(errors[0] instanceof errorType, `Wrong error type for '${input}' got: ${errors[0].errorType()}`)
      assert.equal(errors[0].position, position, `Wrong position for '${input}'`)

      // Let tests do further checks against the error object
      return errors[0]
    }
  })
})

function assertExpression(input, expected) {
  let lexer = new Lexer(input)
  let {tokens, errors} = lexer.tokenize()

  assert.equal(errors.length, 0, util.format("Lexer returned some errors: %o", errors))

  let parser = new Parser(tokens)
  let {expressions} = parser.parse()

  assert.equal(expressions.length, 1)
  assert.deepEqual(expressions[0].node, expected, `Comparison failed for ''${input}''`)
}
