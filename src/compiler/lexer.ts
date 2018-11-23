import { Token, TokenType, tokenLength } from "@compiler/tokens"
import { SyntaxError, UnterminatedStringError, UnknownTokenError } from "@compiler/errors"

interface LexerResults {
  tokens: Array<Token>
  errors: Array<SyntaxError>
}

interface LexerOptions {
  // Path to the file that gave us the input we're parsing.
  filePath?: string
}

export default class Lexer {

  input: string
  currentPos: number
  filePath: string

  tokens: Array<Token>
  errors: Array<SyntaxError>

  constructor(input: string, opts: LexerOptions = {}) {
    this.input = input
    this.currentPos = 0
    this.filePath = opts.filePath

    this.tokens = []
    this.errors = []
  }

  tokenize(): LexerResults {
    // Bypass any leading whitespace
    this.skipWhitespace(true)

    // Neat pattern from CoffeeScript's lexer.
    var chunk: string
    var token: Token
    while(chunk = this.input.substring(this.currentPos)) {

      if(chunk == "") {
        break
      }

      try {
        token =
          this.commentToken(chunk) ||
          this.numberToken(chunk) ||
          this.stringToken(chunk) ||
          this.operatorToken(chunk) ||
          this.identifierToken(chunk) ||
          this.unknownToken(chunk)
      } catch(error) {
        error.position = this.currentPos
        this.errors.push(error)
        break
      }

      token.pos = this.currentPos
      token.file = this.filePath

      this.consume(token)
      this.tokens.push(token)

      // We should be at a newline at this time
      // Check to see if it's a proper "End of Statement" marker
      // and mark it as such.
      let eol = this.endOfStatementToken(this.input.substring(this.currentPos), token)
      if(eol) {
        eol.pos = this.currentPos
        eol.file = this.filePath
        this.tokens.push(eol)
        this.currentPos += tokenLength(eol)
      }

      // Now skip past all whitespace to the next non whitespace token
      this.skipWhitespace(true)
    }

    // Add one final End of Statement to the list as we're at the end of
    // the final statement of the program
    if(this.tokens.length > 0 && this.tokens[this.tokens.length - 1].type != TokenType.EOS) {
      this.tokens.push({ type: TokenType.EOS, value: "", pos: this.currentPos, file: this.filePath })
    }

    return {
      tokens: this.tokens,
      errors: this.errors
    }
  }

  /**
   * Much in the way of Go (https://golang.org/ref/spec#Semicolons) look
   * for situations where we are at the End of a Statement.
   * This could be explicit with a semicolon (;) or implicit with newlines.
   */
  endOfStatementToken(chunk: string, lastToken: Token): Token {
    if(chunk[0] == ";") {
      return { type: TokenType.EOS, value: ";" }
    }

    let eol = chunk.match(/^(\r?\n)/)
    if(eol) {
      // End of a line, check the last token we generated to see
      // if we need to insert a token.
      switch(lastToken.type) {
        case TokenType.CloseParen:
        case TokenType.CloseBlock:
        case TokenType.CloseSquare:
        case TokenType.Number:
        case TokenType.String:
        case TokenType.Identifier:
          return { type: TokenType.EOS, value: eol[0] }
        default:
          return null
      }
    } else {
      return null
    }
  }

  commentToken(chunk: string): Token {
    let test = chunk.match(this.COMMENT_REGEX)

    if(test) {
      return { type: TokenType.Comment, value: test[1], source: test[0] }
    } else {
      return null
    }
  }

  numberToken(chunk: string): Token {
    let test = chunk.match(this.NUMBER_REGEX)

    if(test) {
      return { type: TokenType.Number, value: test[0] }
    } else {
      return null
    }
  }

  // Find a string that contains all letters between matching single (')
  // or double (") quotes, but not including those wrapping quotes, and making
  // sure to handle escaped matching quotes, e.g. ("\"" should return the string: `"`)
  stringToken(chunk: string): Token {
    let starter = chunk[0]
    if(starter == '"' || starter == "'") {

      for(var i = 1; i < chunk.length; i++) {
        if(chunk[i] == starter && chunk[i-1] != "\\") {
          return { type: TokenType.String, value: chunk.substring(1, i), source: chunk.substring(0, i+1) }
        }
      }

      throw new UnterminatedStringError({ type: TokenType.String, value: chunk })
    } else {
      return null
    }
  }

  operatorToken(chunk: string): Token {
    switch(chunk[0]) {
      case "(":
        return { type: TokenType.OpenParen, value: "(" }
      case ")":
        return { type: TokenType.CloseParen, value: ")" }
      case "[":
        return { type: TokenType.OpenSquare, value: "[" }
      case "]":
        return { type: TokenType.CloseSquare, value: "]" }
      case "{":
        return { type: TokenType.OpenBlock, value: "{" }
      case "}":
        return { type: TokenType.CloseBlock, value: "}" }
      case ":":
        return { type: TokenType.Colon, value: ":" }
      case ",":
        return { type: TokenType.Comma, value: "," }
      case "|" :
        return { type: TokenType.Pipe, value: "|" }
      case ".":
        return { type: TokenType.Dot, value: "." }
    }

    var test = chunk.substring(0, 2)
    var tokenType = this.COMPOUND_OPERATORS[test]
    if(tokenType) {
      return { type: tokenType, value: test }
    }

    test = chunk[0]
    tokenType = this.SINGLE_OPERATORS[test]
    if(tokenType) {
      return { type: tokenType, value: test }
    }

    return null
  }

  identifierToken(chunk: string): Token {
    let test = chunk.match(this.IDENTIFIER_REGEX)

    if(test) {
      return { type: TokenType.Identifier, value: test[0] }
    } else {
      return null
    }
  }

  // Fall-through final token type if nothing else matches
  // We will error only on the first character as it doesn't
  // match the previous rules. The error reporting will provide
  // context.
  unknownToken(chunk: string): Token {
    throw new UnknownTokenError({ type: TokenType.String, value: chunk[0] })
  }

  consume(token: Token) {
    this.currentPos += tokenLength(token)
    this.skipWhitespace()
  }

  skipWhitespace(skipNewlines = false) {
    let regex = skipNewlines ?  this.WS_WITH_NEWLINES_REGEX : this.WHITESPACE_REGEX
    let ws = this.input.substring(this.currentPos).match(regex)

    if(skipNewlines && ws) {
      this.currentPos += ws[0].length

      // Lets try again to see if we found a new-line and if the next line
      // is itself whitespace.
      // Javascript doesn't really support the \A anchor making multiline matches
      // problematic
      this.skipWhitespace()
    }
  }

  /**
   * Regex matchers
   */

  // Match a comment (always starts with # and goes to the end of the line)
  COMMENT_REGEX = /^#\s?(.*)/

  // Match all number types.
  NUMBER_REGEX = /^-?\d*\.?\d+/

  // Identifiers:
  //
  // * Unicode
  // * Any case
  // * Have underscores
  // * Start with an underscore
  // * Cannot contain spaces
  // * Cannot contain dashes
  //
  // Taken and modified from Coffeescript
  //
  // This will technically match things like `123ident` but the lexer
  // will first catch the `123` as a number for us so we don't need
  // to worry about it at this point.
  //
  IDENTIFIER_REGEX = /^(?:(?!\s)[\u00BF-\u1FFF\u2C00-\uD7FF\w])+/

  // Operators
  SINGLE_OPERATORS = {
    '+': TokenType.Plus,
    '-': TokenType.Minus,
    '*': TokenType.Multiply,
    '/': TokenType.Divide,
    '<': TokenType.LessThan,
    '>': TokenType.GreaterThan,
    '=': TokenType.Assign,
  }

  COMPOUND_OPERATORS = {
    '<=': TokenType.LessThanEqual,
    '>=': TokenType.GreaterThanEqual,
    '==': TokenType.Equal,
    '!=': TokenType.NotEqual,
  }

  // Don't immediately catch newlines, as those could be an End Of Statement.
  // Uses a double negative to find all other whitespace
  WHITESPACE_REGEX = /^([^\S\r\n])/
  WS_WITH_NEWLINES_REGEX = /^\s+/
}
