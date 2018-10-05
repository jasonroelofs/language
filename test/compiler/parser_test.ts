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
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          name: "message",
          arguments: [],
        },
      },
      // Parens are optional when no parameters
      "obj.message" : {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          name: "message",
          arguments: [],
        },
      },
      "obj.message(1)": {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          name: "message",
          arguments: [
            { type: NodeType.NumberLiteral, value: 1 }
          ]
        },
      },
      // Expressions can be arguments
      "obj.message(a + b)": {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          name: "message",
          arguments: [
            {
              type: NodeType.MessageSend,
              object: { type: NodeType.Identifier, value: "a" },
              message: {
                type: NodeType.Message,
                name: "+",
                arguments: [
                  { type: NodeType.Identifier, value: "b" }
                ]
              }
            }
          ]
        },
      },
      // > 1 parameter, must be keywords
      "obj.message(a1: a1, a2: a.b)": {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          name: "message",
          arguments: [
            {
              type: NodeType.Argument,
              name: "a1",
              value: { type: NodeType.Identifier, value: "a1" }
            },
            {
              type: NodeType.Argument,
              name: "a2",
              value: {
                type: NodeType.MessageSend,
                object: { type: NodeType.Identifier, value: "a" },
                message: { type: NodeType.Message, name: "b", arguments: [] },
              }
            }
          ]
        }
      }
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
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
        object: { type: NodeType.NumberLiteral, value: "1" },
        message: { type: NodeType.Message, name: op, arguments: [{ type: NodeType.NumberLiteral, value: "2" }] }
      }
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses complex infix expressions", () => {
  })
})

function assertExpression(input, expected) {
  let lexer = new Lexer(input)
  let tokens = lexer.tokenize()

  let parser = new Parser(tokens)
  let expressions = parser.parse()

  assert.equal(expressions.length, 1)
  assert.deepEqual(expressions[0].node, expected)
}
