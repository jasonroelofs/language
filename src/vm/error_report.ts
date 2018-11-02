import { codeBlock } from "common-tags"

// Errors can provide options for the reporter to
// further customize the output.
interface ReportOptions {

  // Put the error marker (^) at the end of the last line of the output.
  markEndOfLine: boolean

  // Some errors are easier to track down if we take note of the
  // start of an expression or group as well as the end of the parsing
  // where the error happened. In such situations, provide the following
  // options to output a "error started here" segment.
  // Please make sure all three are set.
  startChunk: string
  startChunkPosition: number
  startDescription: string

}

interface SystemError {

  // The section of code that triggered the error
  chunk: string

  // The raw position in the input
  position: number

  baseType(): string
  errorType(): string
  description(): string

  // See the `ReportOptions` interface for what this plain
  // object should contain. All options are optional.
  reportOptions(): Object
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

  reportOptions: ReportOptions

  constructor(error: SystemError, source: string, file: string = null) {
    this.error = error
    this.source = source
    this.file = file

    this.reportOptions = error.reportOptions() as ReportOptions
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
    let importantLines = []

    if(this.reportOptions.startChunk) {
      importantLines.push({
        chunk: this.reportOptions.startChunk,
        position: this.reportOptions.startChunkPosition,
        tagOn: this.reportOptions.startDescription
      })
    }

    importantLines.push({
      chunk: this.error.chunk,
      position: this.error.position,
    })

    // We have raw input positions, need to figure out the matching
    // line numbers these positions map to. This will set
    // startLine and endLine on each record in importantLines.
    // startLine and endLine are 0-based indexes for ease of later
    // calculations. They will be converted to 1-based for the
    // final output.
    this.calculateLineNumbers(importantLines)

    let startLine = importantLines[0].startLine
    let endLine = importantLines[importantLines.length - 1].endLine

    let sourceLines = this.source.split("\n")
    let lineNum = ""
    let lineIndent = 0
    let importantIndex = 0
    let offending = ""
    let numberWidth = endLine.toString().length + 2

    let pointerIndent = ""
    let pointer = ""
    let padding = ""
    let leftBar = ""

    // Render out all of the important source code lines, including any
    // interstitial information we want to include.
    for(var line of this.calcLinesToShow(startLine, endLine)) {
      if(line == "SKIP") {
        // Make sure the three dots line up with the right bar |
        offending += this.safeRepeat(" ", numberWidth - 2) + "...\n"
        continue
      }

      lineNum = (line + 1).toString()
      padding = this.safeRepeat(" ", numberWidth - lineNum.length)
      leftBar = `${padding}${lineNum}| `
      offending += `${leftBar}${sourceLines[line]}\n`

      if(leftBar.length > lineIndent) {
        lineIndent = leftBar.length
      }

      let lineData = importantLines[importantIndex]
      if(lineData && lineData != importantLines[importantLines.length - 1] && line == lineData.endLine) {
        let pointerIndent = " ".repeat(lineIndent + lineData.markerStart)
        let pointer = "^".repeat(lineData.markerLength)

        let tagOn = importantLines[importantIndex].tagOn
        if(tagOn) { tagOn = " " + tagOn }

        offending += `${pointerIndent}${pointer}${tagOn || ""}\n`

        importantIndex += 1
      }
    }

    // Now we add the final end-report pointer
    let finalLine = importantLines[importantLines.length - 1]

    if(this.reportOptions.markEndOfLine) {
      pointerIndent = " ".repeat(lineIndent + finalLine.markerStart + finalLine.markerLength)
      pointer = "^"
    } else {
      pointerIndent = " ".repeat(lineIndent + finalLine.markerStart)
      pointer = "^".repeat(finalLine.markerLength)
    }

    return `${offending.trimRight()}\n${pointerIndent}${pointer}`
  }

  calculateLineNumbers(importantLines) {
    let sourceLines = this.source.split("\n")

    for(var line of importantLines) {
      let preLine = this.source.substring(0, line.position)
      let chunkLines = line.chunk.trimRight().split("\n")

      line.startLine = preLine.split("\n").length - 1
      line.endLine = line.startLine + (chunkLines.length - 1)

      if(line.chunk == "" || line.chunk == "\n") {
        // The only way a chunk is one of these two values is if its an EOS marker,
        // so we just put the marker at the end of the last line of output.
        line.markerStart = sourceLines[line.endLine].length
        line.markerLength = 1
      } else {
        let chunkLastLine = chunkLines[chunkLines.length - 1]
        line.markerStart = sourceLines[line.endLine].indexOf(chunkLastLine)
        line.markerLength = chunkLastLine.length
      }
    }
  }

  // String.repeat throws an error if count is negative.
  // In our case if that happens we don't want the string at all
  safeRepeat(str, count) {
    if(count < 0) {
      return ""
    } else {
      return str.repeat(count)
    }
  }

  calcLinesToShow(startLine, endLine) {
    // If the output is going to be too big, then set up
    // the list of lines to include a skip so as to emphasize
    // the important lines.
    if(endLine - startLine >= 7) {
      return [
        startLine,
        startLine + 1,
        startLine + 2,
        "SKIP",
        endLine - 2,
        endLine - 1,
        endLine
      ]
    } else {
      let list = []
      for(var i = startLine; i <= endLine; i++) {
        list.push(i)
      }

      return list
    }
  }
}

export default ErrorReport
