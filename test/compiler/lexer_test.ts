import "mocha"
import * as assert from "assert"
import Lexer from "../../src/compiler/lexer"

describe("Lexer", () => {
  it("works", () => {
    let input = "1 2.0 3.3";
    let lexer = new Lexer();
    let nodes = lexer.tokenize(input);

    assert.equal(nodes.length, 3)
  });
});
