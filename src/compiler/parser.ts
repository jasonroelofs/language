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
import * as errors from "@compiler/errors"

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

interface ParserResults {
  expressions: Array<Expression>
  errors: Array<errors.SyntaxError>
}

export default class Parser {

  tokens: Array<Token>

  index: number

  prefixParse: Object
  infixParse: Object

  // Keep a running track of the most recent comment we've seen
  // to attach it to the expression it's describing
  currentComment: string[]

  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
    this.currentComment = []

    this.prefixParse = {
      [TokenType.Number]: () => this.parseNumberLiteral(),
      [TokenType.String]: () => this.parseStringLiteral(),
      [TokenType.Identifier]: () => this.parseIdentifier(),
      [TokenType.OpenBlock]: () => this.parseBlock(),
      [TokenType.OpenParen]: () => this.parseGroupedExpression(),
      [TokenType.Pipe]: () => this.incompleteExpressionError(),
      [TokenType.CloseParen]: () => this.incompleteExpressionError(),
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

  parse(): ParserResults {
    var expressions = []
    var errors = []

    try {
      while (this.index < this.tokens.length) {
        expressions.push({
          node: this.parseStatement()
        })
      }
    } catch (error) {
      errors.push(error)
    }

    return {
      expressions: expressions,
      errors: errors
    }
  }

  parseStatement() {
    this.checkForComments()

    let stmt = this.parseExpression(Precedence.Lowest)

    this.checkEndOfStatement()

    let comment = this.getAndClearCurrentComments()
    if(comment != "") {
      stmt.comment = comment
    }

    return stmt
  }

  checkForComments() {
    while(this.currTokenIs(TokenType.Comment)) {
      this.currentComment.push(this.currToken().value)
      this.nextToken()
    }
  }

  getAndClearCurrentComments(): string {
    let comments = this.currentComment.join("\n")
    this.clearCurrentComments()
    return comments
  }

  clearCurrentComments() {
    this.currentComment = []
  }

  checkEndOfStatement() {
    switch(this.currToken().type) {
      case TokenType.EOS:
        this.nextToken()
      case TokenType.CloseParen:
      case TokenType.CloseBlock:
      case TokenType.Comma:
        break;
      case TokenType.Comment:
        // Comments added to the end of a line are thrown away, as
        // they aren't intended to contribute to public documentation
        this.nextToken()
        break;
      default:
        throw new errors.ExpectedEndOfExpressionError(this.currToken())
    }
  }

  parseExpression(precedence: number): Node {
    let token = this.currToken()

    let prefix = this.prefixParse[token.type]
    if (prefix == null) {
      throw new errors.InvalidStartOfExpressionError(token)
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
    let openingToken = this.currToken()
    this.nextToken()

    let exp = this.parseExpression(Precedence.Lowest)

    // Handle end-of-statements that may be new-lines before we find
    // the closing )
    if(this.isEndOfStatement()) {
      this.nextToken()
    }

    if(!this.currTokenIs(TokenType.CloseParen)) {
      throw new errors.UnmatchedClosingTagError(openingToken,  this.currOrPreviousToken(), ")")
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
    let startToken = this.currToken()
    this.nextToken()

    let node: BlockNode = { type: NodeType.Block, parameters: [], body: [] }

    // Block parameters
    if(this.currTokenIs(TokenType.Pipe)) {
      let pipeStart = this.currToken()
      this.nextToken()
      var param: ParameterNode

      while(this.currToken() && !this.currTokenIs(TokenType.Pipe)) {

        if(!this.currTokenIs(TokenType.Identifier)) {
          throw new errors.InvalidParameterError(this.currToken())
        }

        param = {
          type: NodeType.Parameter,
          name: this.currToken().value,
          default: null
        }

        // Move past the name
        this.nextToken()

        // Default value set for this parameter
        if(this.currTokenIs(TokenType.Colon)) {
          let colonToken = this.currToken()
          this.nextToken()

          if(this.isEndOfStatement() ||
            this.currTokenIs(TokenType.Comma) ||
            this.currTokenIs(TokenType.Pipe)) {
            throw new errors.IncompleteParameterError(colonToken)
          }

          param.default = this.parseExpression(Precedence.Lowest)
        }

        // More parameters?
        if(this.currTokenIs(TokenType.Comma)) {
          this.nextToken()
        } else if(!this.currTokenIs(TokenType.Pipe)) {
          throw new errors.ExpectedTokenMissingError(this.currToken(), ", or |")
        }

        node.parameters.push(param)
      }

      if(this.isEndOfStatement()) {
        throw new errors.UnmatchedClosingTagError(pipeStart, this.currOrPreviousToken(), "|")
      }

      // Move past the last Pipe
      this.nextToken()
    }

    // Block body
    while(this.currToken() && !this.currTokenIs(TokenType.CloseBlock)) {
      node.body.push({ node: this.parseStatement() })
    }

    if(!this.currTokenIs(TokenType.CloseBlock)) {
      throw new errors.UnmatchedClosingTagError(startToken, this.currOrPreviousToken(), "}")
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
    let assignment = {
      type: NodeType.Assignment,
      name: left.value,
      right: null,
    }

    let comments = this.getAndClearCurrentComments()

    if(comments != "") {
      assignment["comment"] = comments
    }

    if(this.isEndOfStatement()) {
      throw new errors.IncompleteExpressionError(token)
    }

    assignment.right = this.parseExpression(Precedence.Lowest)

    return assignment
  }

  /**
   * Convert non-custom-case infix expressions into regular
   * message sends
   */
  parseInfixExpression(left: Node): MessageSendNode {
    let token = this.currToken()
    let precedence = this.currPrecedence()
    this.nextToken()

    if(this.isEndOfStatement()) {
      throw new errors.IncompleteExpressionError(token)
    }

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
    let start = this.currToken()

    if(this.peekTokenIs(TokenType.CloseParen)) {
      // We have an empty param set `()` so no arguments added.
      // Skip our current token `(` and the close `)` to move forward.
      this.nextToken()
      this.nextToken()
      return left
    }

    // Move past the OpenParen
    this.nextToken()

    if(this.isEndOfStatement()) {
      throw new errors.UnmatchedClosingTagError(start, this.currOrPreviousToken(), ")")
    }

    this.checkForComments()

    // At this point we have parameters. This can be a single plain parameter
    // or a series of keyworded parameters. Look for the single case first then
    // run through keywords.

    // We aren't at the start of a keyword, so we are probably a plain param.
    // There can only be one of these.
    if (!this.peekTokenIs(TokenType.Colon)) {
      // Throw away any comments, there's nothing really to attach to
      this.clearCurrentComments()

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
      } else {
        // No colon, no comma, no close paren. Something else is here
        // and that's an error. Most likely this is someone forgetting to add
        // the colon to designate the name of the argument.
        throw new errors.ExpectedTokenMissingError(this.currToken(), ": or ,")
      }
    }

    // Alright we are keywording it up!
    while(this.peekToken()) {
      this.checkForComments()

      // The second argument and onward must be in the form of `name: value` or `"name": value`
      if(!this.peekTokenIs(TokenType.Colon)) {
        throw new errors.MissingArgumentNameError(this.currToken())
      }

      // We only support identifiers or strings as names of arguments
      if(!(this.currTokenIs(TokenType.Identifier) || this.currTokenIs(TokenType.String))) {
        throw new errors.InvalidArgumentNameError(this.currToken())
      }

      let argNode = {
        name: this.currToken().value
      }

      // Move past the identifier and the colon
      this.nextToken()
      this.nextToken()

      // See if we have any comments for attaching,
      // and if so grab them before parseStatement does.
      if(this.currentComment.length > 0) {
        argNode['comment'] = this.currentComment.join("\n")
        this.clearCurrentComments()
      }

      if(this.currTokenIs(TokenType.Comma) ||
        this.currTokenIs(TokenType.CloseParen) ||
        this.isEndOfStatement()) {
        throw new errors.MissingArgumentValueError(this.currToken())
      }

      argNode['value'] = this.parseStatement()

      left.message.arguments.push(argNode)

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

    if(!this.currTokenIs(TokenType.CloseParen)) {
      throw new errors.UnmatchedClosingTagError(start, this.currOrPreviousToken(), ")")
    }

    // Move past the close paren, we're done
    this.nextToken()

    return left
  }

  incompleteExpressionError() {
    throw new errors.IncompleteExpressionError(this.currToken())
  }

  currToken(): Token {
    return this.tokens[this.index]
  }

  currTokenIs(expected: TokenType): boolean {
    return this.currToken() && this.currToken().type == expected
  }

  currOrPreviousToken(): Token {
    if(this.currToken()) {
      return this.currToken()
    } else {
      return this.tokens[this.index - 1]
    }
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

  isEndOfStatement(): boolean {
    return this.currToken() == null || this.currTokenIs(TokenType.EOS)
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
