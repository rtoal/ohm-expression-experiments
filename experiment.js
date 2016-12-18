// An experiment in representing an expression language four different ways in Ohm.

const ohm = require('ohm-js');

// The expression language is the classic arithmetic operators over integer literals
// and identifiers, given in EBNF as:
//
//   E -> E ("+" | "-") T | T
//   T -> T ("*" | "/") F | F
//   F -> num | id | "(" E ")"

// Our experiment will consist of four different Ohn grammars and associated semantics
// to produce an AST. The AST prints like a Lisp S-Expression. These are the classes that
// define the AST:

class Program {
  constructor(expression) {
    this.body = expression;
  }
  toString() {
    return this.body.toString();
  }
}

class BinaryExpression {
  constructor(left, op, right) {
    this.left = left;
    this.op = op;
    this.right = right;
  }
  toString() {
    return `(${this.op} ${this.left} ${this.right})`;
  }
}

class IntegerLiteral {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return `${this.value}`;
  }
}

class Identifier {
  constructor(name) {
    this.name = name;
  }
  toString() {
    return this.name;
  }
}

// The first grammar is the classic left-recursive one. This is what shows up in the
// major examples in the Ohm repository. It yields a pretty simple semantics.

const grammar1 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Exp addop Term     --binary
          | Term
  Term    = Term mulop Factor  --binary
          | Factor
  Factor = "(" Exp ")"         --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = "*" | "/"
  id      = letter alnum*
  number  = digit+
}`);

const semantics1 = grammar1.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  Exp_binary(left, op, right) {return new BinaryExpression(left.tree(), op.sourceString, right.tree());},
  Term_binary(left, op, right) {return new BinaryExpression(left.tree(), op.sourceString, right.tree());},
  Factor_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
});

// The second grammar is in the style of a traditional PEG. It does not make use of any
// left recursion. Because of this, the semantics is a bit more complex, even though the
// grammar is a couple lines shorter. To make the semantics work, we need a helper function
// that walks the arrays of operators and right operands.

const grammar2 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Term (addop Term)*
  Term    = Factor (mulop Factor)*
  Factor = "(" Exp ")"  --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = "*" | "/"
  id      = letter alnum*
  number  = digit+
}`);

const semantics2 = grammar2.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  Exp(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Term(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Factor_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
  _terminal() {return this.sourceString}
});

function makeBinaryExpression(result, ops, rest) {
  for (let i = 0; i < ops.length; i++) {
    result = new BinaryExpression(result, ops[i], rest[i]);
  }
  return result;
}

// The third grammar makes use of Ohm's parameterized rules, specifically the
// NonemptyListOf rule. This works because all uses of NonemptyListOf do the
// "same thing." How will this work when there are multiple uses of NonemptyListOf
// in the same grammar that have different semantics? That would be for another
// experiment.

const grammar3 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = NonemptyListOf<Term, addop>
  Term    = NonemptyListOf<Factor, mulop>
  Factor = "(" Exp ")"                     --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = "*" | "/"
  id      = letter alnum*
  number  = digit+
}`);

const semantics3 = grammar3.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  NonemptyListOf(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Factor_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
  _terminal() {return this.sourceString}
});

function makeBinaryExpression(result, ops, rest) {
  for (let i = 0; i < ops.length; i++) {
    result = new BinaryExpression(result, ops[i], rest[i]);
  }
  return result;
}

// The fourth grammar leaves operator precedence and associativity to the semantics,
// where we do the classic precedence stuff with stacks. This gives us the lightest
// grammar but the most complex semantics.

const grammar4 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Factor binop Factor  --binary
          | Factor
  Factor = "(" Exp ")"           --parens
          | number
          | id
  binop   = "+" | "-" | "*" | "/"
  id      = letter alnum*
  number  = digit+
}`);




// Finally, here's a quick illustration for each of the semantics, just to show how
// they work. See the tests directory in the repo for a real illustration of how to
// test.

for (let [s,g] of [[semantics1, grammar1], [semantics2, grammar2], [semantics3, grammar3]]) {
  for (let source of ['3', 'x', '5 * (2 + dog) / q - 3 / q']) {
    console.log(s(g.match(source)).tree().toString());
  }
}
