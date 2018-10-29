import { codeBlock } from "common-tags"

interface SystemError {

  // The section of code that triggered the error
  chunk: string

  // The raw position in the input
  position: number

  baseType(): string
  errorType(): string
  description(): string
}

class ErrorReport {

  // The error itself
  error: SystemError

  // The full input source that fired this error.
  // Used to figure out contextual information, as
  // the error itself will only contain the actual chunk of
  // code that triggered the error.
  source: string

  // Optional file path to help users find where the error
  file: string

  constructor(error: SystemError, source: string, file: string = null) {
    this.error = error
    this.source = source
    this.file = file
  }

  buildReport(): string {
    let message = codeBlock`
      [${this.baseType()}]${this.subType()}${this.filePath()}:

      ${this.renderOffendingLines()}
      ${this.description()}
    `

    return message
  }

  baseType() {
    return this.error.baseType() || "System Error"
  }

  subType() {
    let t = this.error.errorType()
    return t ? ` ${t}` : ""
  }

  filePath() {
    return this.file ? ` in ${this.file}` : ""
  }

  description() {
    let d = this.error.description()
    return d ? `\n${d}` : ""
  }

  renderOffendingLines() {
    let preChunk = this.source.substring(0, this.error.position)
    let chunkLines = this.error.chunk.trimRight().split("\n")
    let startLine = preChunk.split("\n").length - 1
    let endLine = startLine + chunkLines.length

    let offending = ""
    var lineNum = ""
    var lineIndent = 0
    let sourceLines = this.source.split("\n")

    for(var i = startLine; i < endLine; i++) {
      lineNum = `${i + 1}| `
      offending += `${lineNum}${sourceLines[i]}\n`

      if(lineNum.length > lineIndent) {
        lineIndent = lineNum.length
      }
    }

    let chunkLastLine = chunkLines[chunkLines.length - 1]
    let chunkStart = sourceLines[endLine - 1].indexOf(chunkLastLine)
    let pointerIndent = " ".repeat(lineIndent + chunkStart)
    let pointer = "^".repeat(chunkLastLine.length)

    return `${offending.trimRight()}\n${pointerIndent}${pointer}`
  }
}

export default ErrorReport
