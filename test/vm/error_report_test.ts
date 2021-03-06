import "mocha"
import * as assert from "assert"
import { stripIndent } from "common-tags"
import { SyntaxError } from "@compiler/errors"
import { Token, TokenType } from "@compiler/tokens"
import { ErrorReport } from "@vm/error_report"

describe("ErrorReport", () => {
  it("builds a nice, readable error message", () => {
    let text = "Error starts here"
    let error = new SyntaxError(stringToken(text))

    let report = new ErrorReport(error, fileMap(null, text))
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
    let chunk = "e f +"
    let pos = text.indexOf(chunk)
    let error = new SyntaxError(stringToken(chunk, {line: 3, ch: 0}))

    let report = new ErrorReport(error, fileMap(null, text))
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
    let chunk = "e f +"
    let pos = text.indexOf(chunk)
    let error = new SyntaxError(stringToken(chunk, {line: 1, ch: 7}))

    let report = new ErrorReport(error, fileMap(null, text))
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
    let error = new SyntaxError(stringToken(text, {line: 0, ch: 0, file: "my/test/file.lang"}))

    let report = new ErrorReport(error, fileMap("my/test/file.lang", text))
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] in my/test/file.lang:

        1| Error starts here
           ^^^^^^^^^^^^^^^^^
    `

    assert.equal(output, expected)
  })

  it("tries to find the right location if similar text exists on the same line", () => {
    let text = "a = 1; a.error"
    let error = new SyntaxError(stringToken("a", {line: 0, ch: 7, file: "my/test/file.lang"}))

    let report = new ErrorReport(error, fileMap("my/test/file.lang", text))
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] in my/test/file.lang:

        1| a = 1; a.error
                  ^
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
    let error = new TestError(stringToken(text))

    let report = new ErrorReport(error, fileMap(null, text))
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
    let error = new TestError(stringToken(text))

    let report = new ErrorReport(error, fileMap(null, text))
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
    let error = new TestError(stringToken(text))

    let report = new ErrorReport(error, fileMap(null, text))
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

    let error = new SyntaxError(stringToken(input))

    let report = new ErrorReport(error, fileMap(null, input))
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

  it("lets the error specify to mark end-of-line", () => {
    class TestError extends SyntaxError {
      reportOptions(): Object {
        return {
          markEndOfLine: true
        }
      }
    }

    let text = "Error at the end"
    let error = new TestError(stringToken(text))

    let report = new ErrorReport(error, fileMap(null, text))
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error]:

        1| Error at the end
                           ^
    `

    assert.equal(output, expected)
  })

  class MultiTokenError extends SyntaxError {
    startToken: Token
    endToken: Token

    constructor(startToken, endToken) {
      super(endToken)

      this.startToken = startToken
      this.endToken = endToken
    }
    reportOptions(): Object {
      return {
        startToken: this.startToken,
        startDescription: "Block opened here",
      }
    }
  }

  it("supports errors that keep track of a start and end token", () => {
    let input = stripIndent`
      block = { |a, b|
        a + b
        a + b
        a + b
        a + b
    `

    let error = new MultiTokenError(
      { type: TokenType.OpenBlock, value: "{", line: 0, ch: 8, file: "[test]" },
      { type: TokenType.EOS, value: "", line: 4, ch: 7, file: "[test]" },
    )

    let report = new ErrorReport(error, fileMap("[test]", input))
    let output = report.buildReport()
    let expected = stripIndent`
      [Syntax Error] in [test]:

        1| block = { |a, b|
                   ^ Block opened here
        2|   a + b
        3|   a + b
        4|   a + b
        5|   a + b
                  ^
    `

    assert.equal(output, expected)
  })

  it("truncates code blocks whose end is far past the starting point of the error", () => {
    let input = "block = { |a, b|\n"
    input += "  a + b\n".repeat(99)
    input = input.trimRight()

    let error = new MultiTokenError(
      { type: TokenType.OpenBlock, value: "{", line: 0, ch: 8, file: "[test]" },
      { type: TokenType.EOS, value: "", line: 99, ch: 7, file: "[test]" },
    )

    let report = new ErrorReport(error, fileMap("[test]", input))
    let output = report.buildReport()

    // We also test here that numbers are right-aligned with each other
    // when they grow in size to keep the output clean and readable.
    // Do note that these numbers actually start one space left from what
    // the rest of the tests do. I'm ok with this as errors will almost never
    // span this kind of distance and one space doesn't make them look bad.
    // When all numbers are within 1 lenght of each other it all works great.
    let expected = stripIndent`
      [Syntax Error] in [test]:

         1| block = { |a, b|
                    ^ Block opened here
         2|   a + b
         3|   a + b
        ...
        98|   a + b
        99|   a + b
       100|   a + b
                   ^
    `

    assert.equal(output, expected)
  })

  function stringToken(chunk: string, {line = 0, ch = 0, file = null} = {}): Token {
    return { type: TokenType.String, value: chunk, file: file, line: line, ch: ch }
  }

  function fileMap(filePath, content) {
    return new Map<string, string>([[filePath, content]])
  }
})
