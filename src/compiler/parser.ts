import * as util from "util"
import { Token, TokenType } from "@compiler/tokens"
import { Expression, Node, NodeType } from "@compiler/ast"

enum Precedence {
  Lowest,
  Assign,  // =
  Equals,  // ==, !=
  Compare, // <, >, <=, >=
  Sum,     // +, -
  Product, // *, /
  Prefix,  // -X
  Index,   // []
}


let Precedences = {
  [TokenType.Dot]: Precedence.Index,
  [TokenType.Assign]: Precedence.Assign,
  [TokenType.Plus]: Precedence.Sum,
  [TokenType.Minus]: Precedence.Sum,
  [TokenType.Multiply]: Precedence.Product,
  [TokenType.Divide]: Precedence.Product,
  [TokenType.LessThan]: Precedence.Compare,
  [TokenType.LessThanEqual]: Precedence.Compare,
  [TokenType.GreaterThan]: Precedence.Compare,
  [TokenType.GreaterThanEqual]: Precedence.Compare,
  [TokenType.Equal]: Precedence.Equals,
  [TokenType.NotEqual]: Precedence.Equals,
}

export default class Parser {

  tokens: Array<Token>

  index: number

  prefixParse: Object
  infixParse: Object

  constructor(tokens) {
    this.tokens = tokens
    this.index = 0

    this.prefixParse = {
      [TokenType.Number]: () => this.parseNumberLiteral(),
      [TokenType.String]: () => this.parseStringLiteral(),
      [TokenType.Identifier]: () => this.parseIdentifier(),
    }

    this.infixParse = {
      [TokenType.Dot]: (left) => this.parseMessageSend(left),
      [TokenType.Assign]: (left) => this.parseAssignment(left),
      [TokenType.Plus]: (left) => this.parseInfixExpression(left),
      [TokenType.Minus]: (left) => this.parseInfixExpression(left),
      [TokenType.Multiply]: (left) => this.parseInfixExpression(left),
      [TokenType.Divide]: (left) => this.parseInfixExpression(left),
      [TokenType.LessThan]: (left) => this.parseInfixExpression(left),
      [TokenType.LessThanEqual]: (left) => this.parseInfixExpression(left),
      [TokenType.GreaterThan]: (left) => this.parseInfixExpression(left),
      [TokenType.GreaterThanEqual]: (left) => this.parseInfixExpression(left),
      [TokenType.Equal]: (left) => this.parseInfixExpression(left),
      [TokenType.NotEqual]: (left) => this.parseInfixExpression(left),
    }
  }

  parse(): Array<Expression> {
    var expressions = []
    let node: Node

    while (this.index < this.tokens.length) {
      expressions.push({
        node: this.parseExpression(Precedence.Lowest)
      })
    }

    return expressions
  }

  parseExpression(precedence: number): Node {
    let token = this.currToken()

    let prefix = this.prefixParse[token.type]
    if (prefix == null) {
      throw new Error(util.format("[Parser] No defined prefix function for token: %o", token))
    }

    var leftExp = prefix()

    while (this.currToken() && precedence < this.currPrecedence()) {
      let infix = this.infixParse[this.currToken().type]

      if (infix == null) {
        return leftExp
      }

      leftExp = infix(leftExp)
    }

    return leftExp
  }

  parseNumberLiteral(): Node {
    let token = this.currToken()
    this.nextToken()
    return { type: NodeType.NumberLiteral, value: parseFloat(token.value) }
  }

  parseStringLiteral(): Node {
    let token = this.currToken()
    this.nextToken()
    return { type: NodeType.StringLiteral, value: token.value }
  }

  parseIdentifier(): Node {
    let token = this.currToken()
    this.nextToken()

    switch(token.value) {
      case "true":
        return { type: NodeType.BooleanLiteral, value: true }
      case "false":
        return { type: NodeType.BooleanLiteral, value: false }
      case "null":
        return { type: NodeType.NullLiteral }
      default:
        return { type: NodeType.Identifier, value: token.value }
    }
  }

  parseMessageSend(left: Node): Node {
    // Move pass the "."
    this.nextToken()

    return {
      type: NodeType.MessageSend,
      object: left,
      message: this.parseMessage()
    }
  }

  parseMessage(): Node {
    let token = this.currToken()
    this.nextToken()

    return {
      type: NodeType.Message,
      value: token.value,
      arguments: []
    }
  }

  parseAssignment(left: Node): Node {
    let token = this.currToken()
    let precedence = this.currPrecedence()
    this.nextToken()

    // TODO: Make sure that left is an Identifier
    // so that we are always assigning to something that can be looked up
    // and used later.

    return {
      type: NodeType.Assignment,
      name: left.value,
      right: this.parseExpression(precedence)
    }
  }

  /**
   * Convert non-custom-case infix expressions into regular
   * message sends
   */
  parseInfixExpression(left: Node): Node {
    let token = this.currToken()
    this.nextToken()

    return {
      type: NodeType.MessageSend,
      object: left,
      message: {
        type: NodeType.Message,
        name: token.value,
        arguments: [
          this.parseExpression(Precedence.Lowest)
        ]
      }
    }
  }

  currToken(): Token {
    return this.tokens[this.index]
  }

  peekToken(): Token {
    if (this.index >= this.tokens.length) {
      return null
    } else {
      return this.tokens[this.index + 1]
    }
  }

  currPrecedence(): number {
    let curr = Precedences[this.currToken().type]
    if (curr) {
      return curr
    } else {
      return Precedence.Lowest
    }
  }

  nextToken() {
    this.index += 1
  }
}
