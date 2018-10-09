import Lexer from "@compiler/lexer"
import Parser from "@compiler/parser"
import { Node, BlockNode, NodeType, Expression } from "@compiler/ast"
import {
  IObject,
  NewObject,
  Objekt,
  Null,
  True,
  False,
  Number,
  String
} from "@vm/object"
import Environment from "@vm/environment"

export default class Interpreter {

  currentScope: Environment

  constructor() {
    this.currentScope = new Environment()
  }

  eval(program: string): IObject {
    let l = new Lexer(program)
    let p = new Parser(l.tokenize())

    return this.evalAST(p.parse())
  }

  evalAST(expressions: Array<Expression>): IObject {
    var ret = Null

    for(var expression of expressions) {
      ret = this.evalNode(expression.node)
    }

    return ret
  }

  evalNode(node: Node): IObject {
    switch(node.type) {
      case NodeType.Assignment:
        let varName = node.name
        let varValue = this.evalNode(node.right)
        this.currentScope.set(varName, varValue)
        return varValue

      case NodeType.Identifier:
        return this.currentScope.get(node.value)

      case NodeType.NumberLiteral:
        return NewObject(Number, {}, node.value)

      case NodeType.BooleanLiteral:
        return node.value ? True : False

      case NodeType.StringLiteral:
        return NewObject(String, {}, node.value)

      case NodeType.NullLiteral:
        return Null

      case NodeType.Block:
        return this.evalBlock(node as BlockNode)

      default:
        console.log("[Eval] Don't know how to evaluate node %o", node)
        return Null
    }
  }

  evalBlock(node: BlockNode): IObject {
    return NewObject(Objekt, {
      body: node.body,
      parameters: node.parameters
    })
  }
}
