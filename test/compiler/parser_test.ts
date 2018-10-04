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
      "obj.message" : {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          value: "message",
          arguments: [],
        },
      },
      /*
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
      "obj.message(a1: a1, a2: a.b)": {
        type: NodeType.MessageSend,
        object: { type: NodeType.Identifier, value: "obj" },
        message: {
          type: NodeType.Message,
          value: "message",
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
        },
      }
      */
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
   * plain message sends on the object.
   *
   * e.g. -1 => 1.send("*", -1)
  it("parses prefix expressions", () => {
    let tests = {
      "-1"  : {
        type: NodeType.PrefixExpression,
        operator: "-",
        right: { type: NodeType.NumberLiteral, value: 1 }
      },
      "!true" : {
        type: NodeType.PrefixExpression,
        operator: "!",
        right: { type: NodeType.BooleanLiteral, value: true }
      },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses infix expressions", () => {
  })

  it("parses complex infix expressions", () => {
  })
  */
})

function assertExpression(input, expected) {
  let lexer = new Lexer(input)
  let tokens = lexer.tokenize()

  let parser = new Parser(tokens)
  let expressions = parser.parse()

  assert.equal(expressions.length, 1)
  assert.deepEqual(expressions[0].node, expected)
}
