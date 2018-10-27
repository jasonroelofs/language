import { stripIndent } from "common-tags"
import { Token } from "@compiler/tokens"

class SyntaxError extends Error {

  // The section of code that triggered the error
  chunk: string

  // The raw position in the input
  position: number

  constructor(chunk: string) {
    super()
    this.chunk = chunk
  }

  errorType(): string {
    return null
  }

  description(): string {
    return null
  }

  // TODO: This should be it's own object, ErrorReporter or something like that.
  errorString(sourceInput: string, file: string = null): string {
    let sourcePrefix = sourceInput.substring(0, this.position)
    let lines = sourcePrefix.split("\n")
    let chunkPrefix = lines[lines.length - 1]

    let lineNumberSegment = `${lines.length}| `
    let pointerIndent = " ".repeat(lineNumberSegment.length + chunkPrefix.length)
    let pointer = "^".repeat(this.chunk.length)

    let errorType = this.errorType() ? ` ${this.errorType()}` : ""
    let fileSegment = file ? ` in ${file}` : ""

    let message = stripIndent`
      [Syntax Error]${errorType}${fileSegment}:

      ${lineNumberSegment}${chunkPrefix}${this.chunk.trim()}
      ${pointerIndent}${pointer}
    `

    let description = this.description()
    if(description) {
      message += `\n\n${description}\n`
    }

    return message
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
}

class UnknownTokenError extends SyntaxError {
  errorType(): string {
    return "Unknown Token"
  }
}

/**
 * Parsing errors
 */

class ParseError extends SyntaxError {
  token: Token

  constructor(token: Token) {
    super(token.value)
    this.token = token
    this.position = token.pos || 0
  }
}

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

  constructor(startToken: Token, endToken: Token, tag: string) {
    super(startToken)
    this.tag = tag
  }

  errorType(): string {
    return `Missing Closing '${this.tag}'`
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

export {
  SyntaxError,
  UnterminatedStringError,
  UnknownTokenError,
  InvalidStartOfExpressionError,
  ExpectedEndOfExpressionError,
  UnmatchedClosingTagError,
  IncompleteExpressionError,
  InvalidParameterError,
  IncompleteParameterError,
  ExpectedTokenMissingError,
}
