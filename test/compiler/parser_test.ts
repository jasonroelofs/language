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
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses Strings", () => {
    let tests = {
      '"one"'     : { type: NodeType.StringLiteral, value: "one" },
      '"two and"' : { type: NodeType.StringLiteral, value: "two and" },
      '"three\'s"' : { type: NodeType.StringLiteral, value: "three's" },
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
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
