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
      throw new Error("[Parser] No defined Prefix function for token type: " + token.type)
    }

    var leftExp = prefix()

    while (this.peekToken() && precedence < this.peekPrecedence()) {
      let infix = this.infixParse[this.peekToken().type]
      if (infix == null) {
        return leftExp
      }

      this.nextToken()

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

  peekPrecedence(): number {
    let peek = Precedences[this.peekToken().type]
    if (peek) {
      return peek
    } else {
      return Precedence.Lowest
    }
  }

  nextToken() {
    this.index += 1
  }
}
