import "mocha"
import * as assert from "assert"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import { NodeType, Node } from "@compiler/ast"

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
    let tokens = lexer.tokenize()

    let parser = new Parser(tokens)
    let expressions = parser.parse()

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
      d
    `

    let lexer = new Lexer(test)
    let tokens = lexer.tokenize()

    let parser = new Parser(tokens)
    let expressions = parser.parse()

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
      { type: NodeType.Identifier, value: "d", comment: "Attach me to d" }
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
    let tokens = lexer.tokenize()

    let parser = new Parser(tokens)
    let expressions = parser.parse()

    assert.equal(expressions.length, 1)

    let message = expressions[0].node.message

    assert.equal(message.arguments[0].comment, "This is the first method")
    assert.equal(message.arguments[1].comment, "This is the second method")
  })
})

function assertExpression(input, expected) {
  let lexer = new Lexer(input)
  let tokens = lexer.tokenize()

  let parser = new Parser(tokens)
  let expressions = parser.parse()

  assert.equal(expressions.length, 1)
  assert.deepEqual(expressions[0].node, expected, `Comparison failed for ''${input}''`)
}
