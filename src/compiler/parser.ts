import * as util from "util"
import { Token, TokenType } from "@compiler/tokens"
import {
  Node,
  NumberNode,
  StringNode,
  AssignmentNode,
  MessageSendNode,
  MessageNode,
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
      [TokenType.OpenParen]: () => this.parseGroupedExpression(),
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
        node: this.parseStatement()
      })
    }

    return expressions
  }

  parseStatement() {
    let stmt = this.parseExpression(Precedence.Lowest)

    this.checkEndOfStatement()

    return stmt
  }

  checkEndOfStatement() {
    switch(this.currToken().type) {
      case TokenType.EOS:
        this.nextToken()
      case TokenType.CloseParen:
      case TokenType.CloseBlock:
      case TokenType.Comma:
        break;
      default:
        throw new Error(`Unexpected ${this.currToken().type} found at the end of the current statement`)
    }
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

  parseGroupedExpression(): Node {
    // Move past the opening (
    this.nextToken()

    let exp = this.parseExpression(Precedence.Lowest)

    if(!this.currTokenIs(TokenType.CloseParen)) {
      throw new Error(`Expected ${TokenType.CloseParen} to close explicit group, found ${this.currToken().type} (${this.currToken().value})`)
    }

    // Move past the closing )
    this.nextToken()

    return exp
  }

  parseNumberLiteral(): NumberNode {
    let token = this.currToken()
    this.nextToken()
    return { type: NodeType.NumberLiteral, value: parseFloat(token.value) }
  }

  parseStringLiteral(): StringNode {
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

  parseBlock(): BlockNode {
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
      node.body.push({ node: this.parseStatement() })
    }

    // Move past the closing '}'
    this.nextToken()

    return node
  }

  parseMessageSend(left: Node): MessageSendNode {
    // Move pass the "."
    this.nextToken()

    return {
      type: NodeType.MessageSend,
      receiver: left,
      message: this.parseMessage()
    }
  }

  parseMessage(): MessageNode {
    let token = this.currToken()
    this.nextToken()

    // This may look incorrect but the actual arguments get filled out
    // in parseCallSite below, as this node gets treated as the "left" node
    // when an open-paren token is found. That parsing then fills out this
    // node's arguments list accordingly.
    return {
      name: token.value,
      arguments: []
    }
  }

  parseAssignment(left: Node): AssignmentNode {
    let token = this.currToken()
    this.nextToken()

    // TODO: Make sure that left is an Identifier
    // so that we are always assigning to something that can be looked up
    // and used later.

    return {
      type: NodeType.Assignment,
      name: left.value,
      right: this.parseExpression(Precedence.Lowest)
    }
  }

  /**
   * Convert non-custom-case infix expressions into regular
   * message sends
   */
  parseInfixExpression(left: Node): MessageSendNode {
    let token = this.currToken()
    let precedence = this.currPrecedence()
    this.nextToken()

    return {
      type: NodeType.MessageSend,
      receiver: left,
      message: {
        name: token.value,
        arguments: [{
          value: this.parseExpression(precedence)
        }]
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

    // Move past the OpenParen
    this.nextToken()

    // At this point we have parameters. This can be a single plain parameter
    // or a series of keyworded parameters. Look for the single case first then
    // run through keywords.

    // We aren't at the start of a keyword, so we are probably a plain param.
    // There can only be one of these.
    if (!this.peekTokenIs(TokenType.Colon)) {
      left.message.arguments.push({
        value: this.parseExpression(Precedence.Lowest)
      })

      // No more arguments, move on
      if(this.currTokenIs(TokenType.CloseParen)) {
        this.nextToken()
        return left
      }

      // Prepare for more arguments!
      if(this.currTokenIs(TokenType.Comma)) {
        this.nextToken()
      }
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

      let argValue = this.parseStatement()

      left.message.arguments.push({
        name: argName,
        value: argValue,
      })

      // Skip past our comma if it exists
      if(this.currTokenIs(TokenType.Comma)) {
        this.nextToken()
      }

      // If we're currently on a close paren, then
      // we are also done. This can happen if a block is the value
      // of the last argument.
      if(this.currTokenIs(TokenType.CloseParen)) {
        break
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
