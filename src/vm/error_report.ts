import { stripIndent } from "common-tags"

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

  error: SystemError

  constructor(error: SystemError) {
    this.error = error
  }

  reportOn(sourceInput: string, file: string = null): string {
    let position = this.error.position
    let chunk = this.error.chunk
    let baseType = this.error.baseType()
    let errorType = this.error.errorType()
    let description = this.error.description()

    let sourcePrefix = sourceInput.substring(0, position)
    let lines = sourcePrefix.split("\n")
    let chunkPrefix = lines[lines.length - 1]
    let chunkSuffix = sourceInput.substring(position + chunk.length).split("\n")[0]

    let lineNumberSegment = `${lines.length}| `
    let pointerIndent = " ".repeat(lineNumberSegment.length + chunkPrefix.length)
    let pointer = "^".repeat(chunk.length)

    let subType = errorType ? ` ${errorType}` : ""
    let fileSegment = file ? ` in ${file}` : ""

    let message = stripIndent`
      [${baseType}]${subType}${fileSegment}:

      ${lineNumberSegment}${chunkPrefix}${chunk.trim()}${chunkSuffix}
      ${pointerIndent}${pointer}
    `

    if(description) {
      message += `\n\n${description}\n`
    }

    return message
  }

}

export default ErrorReport
