import * as util from "util"
import { Token, TokenType } from "@compiler/tokens"
import {
  Node,
  BlockNode,
  ParameterNode,
  Expression,
  NodeType
} from "@compiler/ast"

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
  [TokenType.OpenParen]: Precedence.Index,
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
      [TokenType.OpenBlock]: () => this.parseBlock(),
      // [TokenType.OpenParen]: () => this.parseGroupedExpression(),
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
      [TokenType.OpenParen]: (left) => this.parseCallSite(left),
    }
  }

  parse(): Array<Expression> {
    var expressions = []

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

  parseBlock(): Node {
    // Move past the '{'
    this.nextToken()

    let node: BlockNode = { type: NodeType.Block, parameters: [], body: [] }

    // Block parameters
    if(this.currTokenIs(TokenType.Pipe)) {
      this.nextToken()
      var param: ParameterNode

      while(!this.currTokenIs(TokenType.Pipe)) {
        param = {
          type: NodeType.Parameter,
          name: this.currToken().value,
          default: null
        }

        // Move past the name and following colon
        this.nextToken()

        // Default value set for this parameter
        if(this.currTokenIs(TokenType.Colon)) {
          this.nextToken()

          param.default = this.parseExpression(Precedence.Lowest)
        }

        // More parameters?
        if(this.currTokenIs(TokenType.Comma)) {
          this.nextToken()
        }

        node.parameters.push(param)
      }

      // Move past the last Pipe
      this.nextToken()
    }

    // Block body
    while(!this.currTokenIs(TokenType.CloseBlock)) {
      node.body.push({ node: this.parseExpression(Precedence.Lowest) })
    }

    // Move past the closing '}'
    this.nextToken()

    return node
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
      name: token.value,
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

  /**
   * Found an OpenParen which means left should be a MessageSend,
   * and now we get to add parameters to that MessageSend.
   */
  parseCallSite(left: Node): Node {
    if(this.peekTokenIs(TokenType.CloseParen)) {
      // We have an empty param set `()` so no arguments added.
      // Skip our current token `(` and the close `)` to move forward.
      this.nextToken()
      this.nextToken()
      return left
    }

    this.nextToken()

    // At this point we have parameters. This can be a single plain parameter
    // or a series of keyworded parameters. Look for the single case first then
    // run through keywords.

    // We aren't at the start of a keyword, so we are probably a plain param.
    if (!this.peekTokenIs(TokenType.Colon)) {
      // TODO Should this also create a NodeType.Argument wrapping the argument
      left.message.arguments.push(
        this.parseExpression(Precedence.Lowest)
      )

      this.nextToken()

      return left
    }

    // Alright we are keywording it up!
    while(this.peekToken() && !this.peekTokenIs(TokenType.CloseParen)) {
      if(!this.currTokenIs(TokenType.Identifier)) {
        throw new Error(`Expected ${TokenType.Identifier} for keyword arguments, found ${this.currToken().type} (${this.currToken().value})`)
      }

      if(!this.peekTokenIs(TokenType.Colon)) {
        throw new Error(`Expected ${TokenType.Colon} after argument name, found ${this.peekToken().type} (${this.peekToken().value})`)
      }

      let argName = this.currToken().value

      // Move past the identifier and the colon
      this.nextToken()
      this.nextToken()

      let argValue = this.parseExpression(Precedence.Lowest)

      left.message.arguments.push({
        type: NodeType.Argument,
        name: argName,
        value: argValue,
      })

      // Skip past our comma if it exists
      if(this.currTokenIs(TokenType.Comma)) {
        this.nextToken()
      }
    }

    // Move past the close paren, we're done
    this.nextToken()

    return left
  }

  currToken(): Token {
    return this.tokens[this.index]
  }

  currTokenIs(expected: TokenType): boolean {
    return this.currToken() && this.currToken().type == expected
  }

  peekToken(): Token {
    if (this.index >= this.tokens.length) {
      return null
    } else {
      return this.tokens[this.index + 1]
    }
  }

  peekTokenIs(expected: TokenType): boolean {
    return this.peekToken() && this.peekToken().type == expected
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
