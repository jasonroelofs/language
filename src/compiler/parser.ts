import { Token, TokenType } from "@compiler/tokens"
import { Expression, Node, NodeType } from "@compiler/ast"

export default class Parser {

  tokens: Array<Token>

  index: number

  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
  }

  parse(): Array<Expression> {
    var expressions = []
    let node: Node

    while(this.index < this.tokens.length) {
      expressions.push({
        node: this.parseExpression()
      })
    }

    return expressions
  }

  parseExpression(): Node {
    let token = this.currToken()

    switch(token.type) {
    case TokenType.Number:
      this.index += 1
      return { type: NodeType.NumberLiteral, value: parseFloat(token.value) }
    }

    throw new Error("Don't know how to handle a token of type: " + token.type)
  }

  currToken(): Token {
    return this.tokens[this.index]
  }
}
