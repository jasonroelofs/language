import { stripIndent } from "common-tags"

class SyntaxError {

  // The section of code that triggered the error
  chunk: string

  // The raw position in the input
  position: number

  errorType(): string {
    return null
  }

  description(): string {
    return null
  }

  toString(sourceInput: string, file: string = null): string {
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

export {
  SyntaxError,
  UnterminatedStringError,
}
