import "mocha"
import * as assert from "assert"
import { stripIndent } from "common-tags"
import { SyntaxError } from "@compiler/errors"
import ErrorReport from "@vm/error_report"

describe("ErrorReport", () => {
  it("builds a nice, readable error message", () => {
    let text = "Error starts here"
    let error = new SyntaxError(text)
    error.position = 0

    let report = new ErrorReport(error, text)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error]:

      1| Error starts here
         ^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("calculates the proper line number for the problem line", () => {
    let text = stripIndent`
      a + b
      b + c
      c + d
      e f +
    `
    let error = new SyntaxError("e f +")
    error.position = text.indexOf(error.chunk)

    let report = new ErrorReport(error, text)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error]:

      4| e f +
         ^^^^^
    `

    assert.equal(output, expected)
  })

  it("can follow the chunk if it starts further into the line of code", () => {
    let text = stripIndent`
      a + b; b + c
      c + d; e f +
    `
    let error = new SyntaxError("e f +")
    error.position = text.indexOf(error.chunk)

    let report = new ErrorReport(error, text)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error]:

      2| c + d; e f +
                ^^^^^
    `

    assert.equal(output, expected)
  })

  it("can include current file name information", () => {
    let text = "Error starts here"
    let error = new SyntaxError(text)
    error.position = 0

    let report = new ErrorReport(error, text, "my/test/file.lang")
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] in my/test/file.lang:

      1| Error starts here
         ^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("lets subclasses provide different error message names", () => {
    class TestError extends SyntaxError {
      errorType(): string {
        return "My Test Error"
      }
    }

    let text = "Error starts here"
    let error = new TestError(text)
    error.position = 0

    let report = new ErrorReport(error, text)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] My Test Error:

      1| Error starts here
         ^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("includes any extra description of the error message defined by a subtype", () => {
    class TestError extends SyntaxError {
      errorType(): string {
        return "Can't Understand This"
      }

      description(): string {
        return stripIndent`
          This message helps explain why things are broken.
          We also support providing recommendations.

            Example fix it code
        `
      }
    }

    let text = "Error starts here"
    let error = new TestError(text)
    error.position = 0

    let report = new ErrorReport(error, text)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] Can't Understand This:

      1| Error starts here
         ^^^^^^^^^^^^^^^^^

      This message helps explain why things are broken.
      We also support providing recommendations.

        Example fix it code
    `

    assert.equal(output, expected)
  })

  it("supports providing a different base error type", () => {
    class TestError extends SyntaxError {
      baseType(): string {
        return "Runtime Error"
      }
    }

    let text = "Error starts here"
    let error = new TestError(text)
    error.position = 0

    let report = new ErrorReport(error, text)
    let output = report.buildReport()

    let expected = stripIndent`
      [Runtime Error]:

      1| Error starts here
         ^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("can show errors on chunks that are multiple lines", () => {
    let input = stripIndent`
      "This string

        is unterminated

          and multi-line
    ` + "\n" // Emulate trailing newlines, we want to throw these away

    let error = new SyntaxError(input)
    error.position = 0

    let report = new ErrorReport(error, input)
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error]:

      1| "This string
      2| 
      3|   is unterminated
      4| 
      5|     and multi-line
         ^^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("truncates code blocks whose end is far past the starting point of the error")

  it("ensures numbers stay lined up as they get big (10s and 100s)")
})
