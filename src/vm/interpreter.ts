import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import { Node, NodeType, Expression } from "@compiler/ast"
import { Object, ObjectType, Null, True, False } from "@vm/object"

export default class Interpreter {

  constructor() {
  }

  eval(program: string): Object {
    let l = new Lexer(program)
    let p = new Parser(l.tokenize())

    return this.evalAST(p.parse())
  }

  evalAST(expressions: Array<Expression>): Object {
    var ret = Null

    for(var expression of expressions) {
      ret = this.evalExpression(expression)
    }

    return ret
  }

  evalExpression(expression: Expression): Object {
    let node = expression.node

    switch(node.type) {
      case NodeType.NumberLiteral:
        return { type: ObjectType.Number, value: node.value }

      case NodeType.BooleanLiteral:
        return node.value ? True : False

      case NodeType.StringLiteral:
        return { type: ObjectType.String, value: node.value }

      case NodeType.NullLiteral:
        return Null

      default:
        console.log("[Eval] Don't know how to evaluate node of type %o", node.type)
        return Null
    }
  }
}
