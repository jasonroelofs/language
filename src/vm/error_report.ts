import { codeBlock } from "common-tags"

// Errors can provide options for the reporter to
// further customize the output.
interface ReportOptions {

  // Put the error marker (^) at the end of the last line of the output.
  // This is useful when trying to show the user that there should be more
  // code after what's been given. Otherwise will put the marker underneath
  // the most relevant chunk of code.
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

  // The full file path of the source that triggered
  // this error.
  file: string

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

  // A mapping of filePath -> source that includes the list
  // of all files loaded into the system.
  // Used to pull apart the right source for the Token we're reporting on
  loadedFiles: Map<string, string>

  // The full input source that fired this error.
  // Used to figure out contextual information, as
  // the error itself will only contain the actual chunk of
  // code that triggered the error.
  source: string

  // The full file path of the source that triggered
  // this error.
  file: string

  reportOptions: ReportOptions

  constructor(error: SystemError, loadedFiles: Map<string, string>) {
    this.error = error
    this.loadedFiles = loadedFiles
    this.file = this.error.file
    this.source = this.loadedFiles.get(this.file)

    if(typeof error.reportOptions === "function") {
      this.reportOptions = error.reportOptions() as ReportOptions
    } else {
      // Re-raise this, let the system fully crash
      // TODO When the system is fully fleshed out this should never happen.
      throw error
    }
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
      let preLineSplit = preLine.split("\n")

      line.startLine = preLineSplit.length - 1
      line.endLine = line.startLine + (chunkLines.length - 1)

      if(line.chunk == "" || line.chunk == "\n") {
        // The only way a chunk is one of these two values is if its an EOS marker,
        // so we just put the marker at the end of the last line of output.
        line.markerStart = sourceLines[line.endLine].length
        line.markerLength = 1
      } else {
        let chunkLastLine = chunkLines[chunkLines.length - 1]
        let lineStartPos = 0

        // Find the raw source position of the beginning of the line this
        // chunk is on so we can then find out the real position of the
        // error string, ensuring the right location for our error marker.
        preLineSplit.slice(0, -1).forEach((line) => {
          // Add one for the new-line marker, as that counts in the raw position
          // as `split` does not include the character we split on
          lineStartPos += line.length + 1
        })

        line.markerStart = line.position - lineStartPos
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

export {
  SystemError,
  ErrorReport,
}
