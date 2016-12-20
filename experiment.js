// An experiment in representing an expression language four different ways in Ohm.

const ohm = require('ohm-js');

// The expression language is the classic arithmetic operators over integer literals
// and identifiers, which, in EBNF, is:
//
//   E -> E ("+" | "-") T | T             (left associative additive operators)
//   T -> T ("*" | "/") F | F             (left associative multiplicative operators)
//   F -> P "**" F | P                    (right associative exponentiation operator)
//   P -> num | id | "(" E ")"

// Our experiment will consist of four different Ohn grammars and associated semantics
// to produce an AST. The AST prints like a Lisp S-Expression. These are the classes that
// define the AST:

class Program {
  constructor(expression) {this.body = expression;}
  toString() {return this.body.toString();}
}

class BinaryExpression {
  constructor(left, op, right) {this.left = left; this.op = op; this.right = right;}
  toString() {return `(${this.op} ${this.left} ${this.right})`;}
}

class IntegerLiteral {
  constructor(value) {this.value = value;}
  toString() {return `${this.value}`;}
}

class Identifier {
  constructor(name) {this.name = name;}
  toString() {return this.name;}
}

// Next, we give four grammars and their associated semantics. We’re not using any
// inheritance of grammars or semantics (although that would have been cool) so that
// further experiments can be done by copy-pasting these full grammars. If it turns
// out that this experiment is more readble with super and sub grammars, then we’ll
// rewrite it.

// The first grammar is the classic left-recursive one. This is what shows up in the
// major examples in the Ohm repository, and is likely the most idiomatic. Operator
// precedence is defined by the grammar rules, where we introduce Exp, Term, Factor,
// and Primary to wire precedence directly into the syntax. Associativity is also
// defined structurally through the order of elements in the right hand sides of rules.

const grammar1 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Exp addop Term       --binary
          | Term
  Term    = Term mulop Factor    --binary
          | Factor
  Factor  = Primary expop Factor --binary
          | Primary
  Primary = "(" Exp ")"          --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = ~"**" "*" | "/"
  expop   = "**"
  id      = letter alnum*
  number  = digit+
}`);

const semantics1 = grammar1.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  Exp_binary(left, op, right) {return new BinaryExpression(left.tree(), op.sourceString, right.tree());},
  Term_binary(left, op, right) {return new BinaryExpression(left.tree(), op.sourceString, right.tree());},
  Factor_binary(left, op, right) {return new BinaryExpression(left.tree(), op.sourceString, right.tree());},
  Primary_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
});

// The second grammar is in the style of a traditional PEG. It does not make use of any
// left recursion. Because of this, the semantics is a bit more complex, even though the
// grammar is a couple lines shorter. By writing the grammar this way, we no longer have
// associativity implicit in the grammar. We therefore have to manage associativity in
// a semantic operation that walks the arrays of operators and right operands.

const grammar2 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Term (addop Term)*
  Term    = Factor (mulop Factor)*
  Factor  = Primary (expop Primary)*
  Primary = "(" Exp ")"  --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = ~"**" "*" | "/"
  expop   = "**"
  id      = letter alnum*
  number  = digit+
}`);

const semantics2 = grammar2.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  Exp(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Term(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Factor(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Primary_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
  _terminal() {return this.sourceString}
});

// This grammar cannot help us with associativity, so we must define it here.
const associativity = {'+': 'L', '-': 'L', '*': 'L', '/': 'L', '**': 'R'};

// We know that all lists will have ops at the same precedence levels
function makeBinaryExpression(first, ops, rest) {
  const applyLeft = (x, y) => new BinaryExpression(x, ops.shift(), y);
  const applyRight = (x, y) => new BinaryExpression(y, ops.pop(), x);
  if (associativity[ops[0]] === 'L') {
    return [first].concat(rest).reduce(applyLeft);
  }
  return [first].concat(rest).reduceRight(applyRight);
}

// The third grammar makes use of Ohm's parameterized rules, specifically the
// NonemptyListOf rule. This works because all uses of NonemptyListOf do the
// "same thing." How will this work when there are multiple uses of NonemptyListOf
// in the same grammar that have different semantics? The operation would need to
// do some internal inspection. But that would be for another experiment.

const grammar3 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = NonemptyListOf<Term, addop>
  Term    = NonemptyListOf<Factor, mulop>
  Factor  = NonemptyListOf<Primary, expop>
  Primary = "(" Exp ")"                     --parens
          | number
          | id
  addop   = "+" | "-"
  mulop   = ~"**" "*" | "/"
  expop   = "**"
  id      = letter alnum*
  number  = digit+
}`);

const semantics3 = grammar3.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  NonemptyListOf(left, op, right) {return makeBinaryExpression(left.tree(), op.tree(), right.tree());},
  Primary_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
  _terminal() {return this.sourceString}
});

// This grammar uses the associativity object and the makeBinaryExpression function defined
// in the previous grammar.

// The fourth grammar leaves operator precedence and associativity to the semantics,
// where we build up the AST as we would with operator precedence parsing techniques.
// This gives us the lightest grammar but the most complex semantics. Of course, the
// complexity in the semantics is rolled up into the helper, so this isn’t that much
// of a big deal. Our example is really simple, though: we don’t actually take
// associativity into account (all operators are left-associative here) and we only
// have binary operators.

const grammar4 = ohm.grammar(`ExpressionLanguage {
  Program = Exp end
  Exp     = Primary (binop Primary)*
  Primary = "(" Exp ")"               --parens
          | number
          | id
  binop   = "+" | "-" | "**" | "*" | "/"
  id      = letter alnum*
  number  = digit+
}`);

const semantics4 = grammar4.createSemantics().addOperation('tree', {
  Program(body, _) {return new Program(body.tree());},
  Exp(left, op, right) {return makeTree(left.tree(), op.tree(), right.tree());},
  Primary_parens(open, expression, close) {return expression.tree();},
  number(chars) {return new IntegerLiteral(+this.sourceString);},
  id(char, moreChars) {return new Identifier(this.sourceString);},
  _terminal() {return this.sourceString}
});

// We don’t get precedence *or* associativity in this grammar.
const precedence = {'+': 0, '-': 0, '*': 1, '/': 1, '**': 2};

// Modified Richards and Whitby-Stevens precedence climbing method
function makeTree(left, ops, rights, minPrecedence = 0) {
  while (ops.length > 0 && precedence[ops[0]] >= minPrecedence) {
    let op = ops.shift();
    let right = rights.shift();
    while (ops.length > 0 && (precedence[ops[0]] > precedence[op] ||
        associativity[ops[0]] === 'R' && precedence[ops[0]] === precedence[op])) {
      right = makeTree(right, ops, rights, precedence[ops[0]])
    }
    left = new BinaryExpression(left, op, right);
  }
  return left;
}

// Here we export each grammar/semantics pair for our unit tests.

module.exports = [
  {name: 'Left-recursive', grammar: grammar1, semantics: semantics1},
  {name: 'Traditional PEG', grammar: grammar2, semantics: semantics2},
  {name: 'Parameterized', grammar: grammar3, semantics: semantics3},
  {name: 'Precedence-in-semantics', grammar: grammar4, semantics: semantics4}
];
