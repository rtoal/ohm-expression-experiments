# An Ohm Expression Experiment

There are at least four different ways to define the syntax of expressions with an operator precedence hierarchy.

**A left recursive grammar**

```
Exp     = Exp addop Term --binary
        | Term
Term    = Term mulop Factor --binary
        | Factor
Factor  = Primary expop Factor --binary
Primary = "(" Exp ")" --parens
        | number
        | id
```

**The traditional PEG Style**

```
Exp     = Term (addop Term)*
Term    = Factor (mulop Factor)*
Factor  = Primary (expop Primary)*
```

**Using Ohm’s parameterized rules**

```
Exp     = NonemptyListOf<Term, addop>
Term    = NonemptyListOf<Factor, mulop>
Factor  = NonemptyListOf<Primary, expop>
```

**Leaving precedence resolution to the semantics**

```
Exp     = Primary (binop Primary)*
```

This experiment writes the same grammar all four ways, with associated semantics.

The idea is to give grammar designers a look into the various alternatives to pick a style right for them.
