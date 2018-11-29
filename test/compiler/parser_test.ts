import "mocha"
import * as assert from "assert"
import * as util from "util"
import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import { NodeType, Node, ArgumentNode } from "@compiler/ast"
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
      // Sending a plain message
      "obj.message" : messageSendNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: []
      }),

      // Sending a message, expecting and calling a block
      // This is syntax sugar for: `obj.message.call()`
      "obj.message()" : blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: []
      }),

      // But if we are explicitly using "call", that's alright too
      "block.call()": messageSendNode({
        receiver: { type: NodeType.Identifier, value: "block" },
        message: "call",
        args: []
      }),

      "obj.message(1)": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: [{ value: { type: NodeType.NumberLiteral, value: 1 } }]
      }),

      // Expressions can be arguments
      "obj.message(a + b)": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: [
          { value: blockCallNode({
              receiver: { type: NodeType.Identifier, value: "a" },
              message: "+",
              args: [{ value: { type: NodeType.Identifier, value: "b" } }]
            })
          }
        ]
      }),

      // > 1 parameter, must be keywords
      "obj.message(a1: a1, a2: a.b)": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: [
          {
            name: "a1",
            value: { type: NodeType.Identifier, value: "a1" }
          },
          {
            name: "a2",
            value: messageSendNode({
              receiver: { type: NodeType.Identifier, value: "a" },
              message: "b",
              args: []
            }),
          }
        ]
      }),

      // > 1 parameter, but first parameter can still be unnamed
      "obj.message(a1, a2: a.b)": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: [
          {
            value: { type: NodeType.Identifier, value: "a1" }
          },
          {
            name: "a2",
            value: messageSendNode({
              receiver: { type: NodeType.Identifier, value: "a" },
              message: "b",
              args: []
            }),
          }
        ]
      }),

      // Keys can also be strings, for situations where the key wouldn't make
      // a legit identifier.
      [`obj.message("a": a, "b": b)`]: blockCallNode({
        receiver: { type: NodeType.Identifier, value: "obj" },
        message: "message",
        args: [
          {
            name: "a",
            value: { type: NodeType.Identifier, value: "a" }
          },
          {
            name: "b",
            value: { type: NodeType.Identifier, value: "b" }
          }
        ]
      }),

      // No receiver will trigger the interpreter to treat it as `self`
      "message()": blockCallNode({
        receiver: null,
        message: "message",
        args: []
      }),

      "message(a: 1)": blockCallNode({
        receiver: null,
        message: "message",
        args: [
          {
            name: "a",
            value: { type: NodeType.NumberLiteral, value: 1 }
          },
        ]
      })
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
    let expected = messageSendNode({
      receiver: { type: NodeType.Identifier, value: "a" },
      message: "call",
      args: [
        { value: { type: NodeType.Block, parameters: [], body: [] } },
        { name: "c", value: { type: NodeType.Block, parameters: [], body: [] } },
      ]
    })

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 2)
    assert.deepEqual(removeStrayKeys(expressions[0].node), expected, `Comparison failed for ''${test}''`)
  })

  it("parses array literals into message sends", () => {
    let tests = {
      // [] is syntax sugar for Array.new()
      "[]": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "Array" },
        message: "new",
        args: []
      }),

      // Static initialization gets converted to Array.new arguments:
      // Array.new("0": 1)
      "[1]": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "Array" },
        message: "new",
        args: [
          { name: "0", value: { type: NodeType.NumberLiteral, value: 1 }}
        ]
      }),

      // Multiple values become their own arguments to Array.new()
      "[1, 2, 3]": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "Array" },
        message: "new",
        args: [
          { name: "0", value: { type: NodeType.NumberLiteral, value: 1 }},
          { name: "1", value: { type: NodeType.NumberLiteral, value: 2 }},
          { name: "2", value: { type: NodeType.NumberLiteral, value: 3 }}
        ]
      }),

      // Ensure expressions are properly worked through inside of an array literal
      "[1 + 2]": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "Array" },
        message: "new",
        args: [
          {
            name: "0",
            value: blockCallNode({
              receiver: { type: NodeType.NumberLiteral, value: 1 },
              message: "+",
              args: [
                { value: { type: NodeType.NumberLiteral, value: 2 }}
              ]
            })
          }
        ]
      }),
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  it("parses array access and setting into message sends", () => {
    let tests = {
      // Index access is syntax sugar for the `[]` message
      "array[0]": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "array" },
        message: "[]",
        args: [
          { name: "index", value: { type: NodeType.NumberLiteral, value: 0 } }
        ]
      }),

      // Likewise setting a value on an index is syntax sugar for `[]=`
      "array[0] = 1": blockCallNode({
        receiver: { type: NodeType.Identifier, value: "array" },
        message: "[]=",
        args: [
          { name: "index", value: { type: NodeType.NumberLiteral, value: 0 } },
          { name: "to", value: { type: NodeType.NumberLiteral, value: 1 } },
        ]
      }),
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
      "+", "-", "*", "/", "<", "<=", ">", ">=", "==", "!=", "&&", "||",
    ]
    var tests = {}

    for(var op of operators) {
      tests[`1 ${op} 2`] = blockCallNode({
        receiver: { type: NodeType.NumberLiteral, value: 1 },
        message: op,
        args: [{ value: { type: NodeType.NumberLiteral, value: 2 } }]
      })
    }

    for(var test in tests) {
      assertExpression(test, tests[test])
    }
  })

  /**
   * Much like infix above, prefix expressions are syntax sugar that need to be
   * rewritten to message sends
   */
  it("parses prefix expressions", () => {
    let expected = blockCallNode({
      receiver: { type: NodeType.BooleanLiteral, value: true },
      message: "!",
      args: []
    })

    assertExpression("!true", expected)
  })

  it("parses complex infix expressions", () => {
    let tests = {
      // (1.+(2)).-(3))
      "1 + 2 - 3": blockCallNode({
        receiver: infixNumberNode(1, "+", 2),
        message: "-",
        args: [{ value: { type: NodeType.NumberLiteral, value: 3 } }]
      }),

      // Operator precedence
      // 1.+(2.*(3))
      "1 + 2 * 3": blockCallNode({
        receiver: { type: NodeType.NumberLiteral, value: 1 },
        message: "+",
        args: [{ value: infixNumberNode(2, "*", 3) }]
      }),

      // Operator precedence
      // (1.*(2)).+(3./(4))
      "1 * 2 + 3 / 4": blockCallNode({
        receiver: infixNumberNode(1, "*", 2),
        message: "+",
        args: [{ value: infixNumberNode(3, "/", 4) }]
      }),

      "(1 + 2) * (3 - 4)": blockCallNode({
        receiver: infixNumberNode(1, "+", 2),
        message: "*",
        args: [{ value: infixNumberNode(3, "-", 4) }]
      })
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
          { node: { type: NodeType.NumberLiteral, value: 1 } }
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
            default: { type: NodeType.NumberLiteral, value: 1 }
          },
          {
            type: NodeType.Parameter,
            name: "b",
            default: infixNumberNode(2, "+", 4)
          },
          {
            type: NodeType.Parameter,
            name: "c",
            default: infixNode(NodeType.Identifier, "a", "+", "b")
          },
        ],
        body: [
          { node: { type: NodeType.Identifier, value: "c" } }
        ]
      },
      // Direct calls to standalone blocks
      "{ 1 }()": {
        type: NodeType.MessageSend,
        receiver: {
          type: NodeType.Block,
          parameters: [],
          body: [
            { node: { type: NodeType.NumberLiteral, value: 1 } }
          ]
        },
        message: {
          name: "call",
          arguments: [],
        }
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
      removeStrayKeys(expressions[0].node),
      { type: NodeType.Identifier, value: "a", comment: "Attach to the next expression" }
    )

    assert.deepEqual(
      removeStrayKeys(expressions[1].node),
      { type: NodeType.Identifier, value: "b" }
    )

    assert.deepEqual(
      removeStrayKeys(expressions[2].node),
      { type: NodeType.Identifier, value: "c", comment: "Multi-line\nComments\nare re-combined" }
    )

    assert.deepEqual(
      removeStrayKeys(expressions[3].node),
      {
        type: NodeType.Assignment,
        name: "d",
        right: blockCallNode({
          receiver: { type: NodeType.Identifier, value: "Object" },
          message: "new",
          args: []
        }),
        comment: "Attach me to d"
      }
    )
  })

  it("aborts on files that are nothing but comments", () => {
    let test = `
      # This is a bunch
      # of commented out
      # stuff I don't
      # want running.
    `

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 0)
  })

  it("handles blocks that are nothing but comments", () => {
    let test = `
      a = {
        # This is a bunch
        # of commented out
        # stuff I don't
        # want running.
      }
    `

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 1)
  })

  it("handles blocks that end with a comment", () => {
    let test = `
      a = {
        1 + 2
        # 3 + 4
      }
    `

    let lexer = new Lexer(test)
    let {tokens} = lexer.tokenize()

    let parser = new Parser(tokens)
    let {expressions} = parser.parse()

    assert.equal(expressions.length, 1)
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

    it("errors on invalid or incomplete static array syntax", () => {
      // [input, position, errorType]
      let tests = [
        // Unclosed
        ["[1 ", 3, errors.ExpectedTokenMissingError],
        // Missing values
        ["[,]", 1, errors.InvalidStartOfExpressionError],
        // Invalid argument expression
        ["[1 +]", 4, errors.IncompleteExpressionError],
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

function infixNumberNode(left, op, right) {
  return infixNode(NodeType.NumberLiteral, left, op, right)
}

function infixNode(nodeType, left, op, right) {
  return blockCallNode({
    receiver: { type: nodeType, value: left },
    message: op,
    args: [{ value: { type: nodeType, value: right } }]
  })
}

function blockCallNode({receiver, message, args}) {
  return {
    type: NodeType.MessageSend,
    receiver: messageSendNode({ receiver: receiver, message: message, args: [] }),
    message: {
      name: "call",
      arguments: args
    }
  }
}

function messageSendNode({receiver, message, args}) {
  return {
    type: NodeType.MessageSend,
    receiver: receiver,
    message: {
      name: message,
      arguments: args,
    }
  }
}

function assertExpression(input, expected) {
  let lexer = new Lexer(input)
  var {tokens, errors} = lexer.tokenize()

  assert.equal(errors.length, 0, util.format("Lexer returned some errors: %o", errors))

  let parser = new Parser(tokens)
  var {expressions, errors} = parser.parse()

  assert.equal(errors.length, 0, util.format("Parser returned some errors: %o", errors))
  assert.equal(expressions.length, 1, "Wrong number of expressions returned")

  assert.deepEqual(removeStrayKeys(expressions[0].node), expected, `Comparison failed for ''${input}''`)
}

// There are some things that get added to AST nodes that we don't want to deal with
// testing against, like `token`, as it would drastically clutter up an already hard-to-follow
// suite of tests. This function removes those regardless of how deep the node is.
// This function modifies the object directly but also returns the object for chaining purposes.
//
// Copied and modified from https://gist.github.com/aurbano/383e691368780e7f5c98
function removeStrayKeys(obj) {
  removeKeys(obj, ['token'])
  return obj
}

function removeKeys(obj, keys){
  var index;
  for (var prop in obj) {
    // important check that this is objects own property
    // not from prototype prop inherited
    if(obj.hasOwnProperty(prop)){
      switch(typeof(obj[prop])){
        case 'string':
          index = keys.indexOf(prop)
          if(index > -1){
            delete obj[prop]
          }
          break;
        case 'object':
          index = keys.indexOf(prop)
          if(index > -1){
            delete obj[prop];
          } else {
            removeKeys(obj[prop], keys)
          }
          break
      }
    }
  }
}
