import { stripIndent } from "common-tags"
import { Token } from "@compiler/tokens"

/**
 * Define all errors related to lexing or parsing.
 * Must match the SystemError interface. See vm/error_report`
 */

class SyntaxError extends Error {

  token: Token

  // The following are provided to create parity between
  // these errors and Tokens, as errors are created instead
  // of tokens.

  value: string

  line: number

  ch: number

  pos: number

  file: string

  constructor(token: Token) {
    super()
    this.token = token
    this.value = token.value
    this.line = token.line
    this.ch = token.ch
    this.pos = token.pos
    this.file = token.file
  }

  baseType(): string {
    return "Syntax Error"
  }

  errorType(): string {
    return null
  }

  description(): string {
    return null
  }

  // A plain object of possible options for configuring this error's
  // output. See ReportOptions in vm/error_report for details.
  reportOptions(): Object {
    return {}
  }
}

/**
 * Lexing errors
 */

class UnterminatedStringError extends SyntaxError {
  errorType(): string {
    return "Unterminated String"
  }

  description(): string {
    return stripIndent`
      All strings must be closed with the same quotation mark that opened them.
      For example:

        "Double Quotes"
        'Single Quotes'
        'Nested "Double" Quotes'
        "Nested 'Single' Quotes"
    `
  }

  reportOptions(): Object {
    return {
      markEndOfLine: true
    }
  }
}

class UnknownEscapeSequenceError extends SyntaxError {
  errorType(): string {
    return `Unknown Escape Sequence`
  }
}

class UnknownTokenError extends SyntaxError {
  errorType(): string {
    return `Unknown Token '${this.value}'`
  }
}

/**
 * Parsing errors
 */

class ParseError extends SyntaxError {}

class InvalidStartOfExpressionError extends ParseError {
  errorType(): string {
    return "Invalid Start of Expression"
  }
}

class ExpectedEndOfExpressionError extends ParseError {
  errorType(): string {
    return "Expected End of Expression"
  }

  description(): string {
    return stripIndent`
      Expressions such as "1 + 2" are intended to live on their own line apart from other
      expressions. To chain multiple expressions together on the same line, please seperate
      them by a semicolon (;), such as:

        1 + 2; 3 + 4
    `
  }
}

class UnmatchedClosingTagError extends ParseError {
  // The unmatched opening character
  tag: string

  startToken: Token

  constructor(startToken: Token, endToken: Token, tag: string) {
    super(endToken)
    this.startToken = startToken
    this.tag = tag
  }

  errorType(): string {
    return `Missing Closing '${this.tag}'`
  }

  reportOptions(): Object {
    return {
      startToken: this.startToken,
      startDescription: "Opened here"
    }
  }
}

class IncompleteExpressionError extends ParseError {
  errorType(): string {
    return `Incomplete Expression`
  }
}

class InvalidParameterError extends ParseError {
  errorType(): string {
    return `Missing Parameter Name`
  }
}

class IncompleteParameterError extends ParseError {
  errorType(): string {
    return `Incomplete Parameter`
  }
}

class ExpectedTokenMissingError extends ParseError {
  missing: string

  constructor(token: Token, missing: string) {
    super(token)
    this.missing = missing
  }

  errorType(): string {
    return `Expected ${this.missing} but found ${this.token.value}`
  }
}

class MissingArgumentNameError extends ParseError {
  errorType(): string {
    return `Missing Name of Argument`
  }
}

class MissingArgumentValueError extends ParseError {
  errorType(): string {
    return `Missing the Value of Argument`
  }
}

class InvalidArgumentNameError extends ParseError {
  errorType(): string {
    return `Invalid Argument Name`
  }

  description(): string {
    return stripIndent`
      Argument names can only be identifiers or strings.

        block.call(one: 1, two: 2)
        block.call("one": 1, "two": 2)
    `
  }
}

export {
  SyntaxError,
  UnterminatedStringError,
  UnknownEscapeSequenceError,
  UnknownTokenError,
  InvalidStartOfExpressionError,
  ExpectedEndOfExpressionError,
  UnmatchedClosingTagError,
  IncompleteExpressionError,
  InvalidParameterError,
  IncompleteParameterError,
  ExpectedTokenMissingError,
  MissingArgumentNameError,
  MissingArgumentValueError,
  InvalidArgumentNameError,
}
