Syntax
------

Syntax is meant to be as small as possible, in the vein of Smalltalk/Pharo, Self, and IO. Messages and objects are the core of the language.

But the syntax is also meant to be readable and straight forward. As a Ruby guy, developer happiness is a great goal. We should enjoy working in a language.

We also need to adhere to the Principle of Least Surprise. What do people expect to happen? Make sure it does that. One problem with Smalltalk and friends is that it does not adhere to mathematical operator presedence. 2 + 3 * 5 == 25 in these languages, and that is a non starter. Ruby and IO can do it right; we should too.

Smalltalk does have some semblance of operator precedence: unary operators, binary, keywords, assignment.

What about NULL? Should we support it? Should we enforce null safety? Go the Swift/Kotlin route of explicitly marking a variable as nullable?

### Comments

Comments are ignored and are used to document the code. Try to document the "why" and/or "how", as the code will tell you the "what".

```
# This is a comment

1 + 2 * 3  # They can also go on the end of a line
```

### Math

Mathematical operators follow the expected operator precedence. * / + -.

```
1 + 2       # 3
2 * 4       # 8
1 + 2 * 4   # 9

1/2 + 3/4   # 1.25
```

### Variables and Assignment

Local variables are creatable with the `=` operator.

Messages can be added to objects with `addSlot`, changed with `updateSlot`, and outright removed with `removeSlot`.

```
# Assigning a local variable
obj = Object.new

# Setting raw values
obj.addSlot(name: "a", value: 14)

# Setting new methods
obj.addSlot(name: "size", value: { 4 })

# This is invalid, `obj` doesn't know how to respond to the `size=` message.
obj.size = { 5 }
```

The `=` operator is syntax sugar for `@locals.addSlot`. Every scope will have its own `@locals` object which is used for scoping.

### Conditionals

Booleans respond to the `do` message which takes the parameters `ifTrue` and `ifFalse`. Both of these parameters
have an empty block as the default and thus aren't both required.

```
(1 > 2).do(  # then?
  ifTrue: { }
  ifFalse: { }
)
```

This syntax is weird though which is why we also provide a more normal form which will rewrite the code to using `do`.

```
if(1 > 2) {

} else if (2 > 3) {

} else {

}
```

### Comparisons

Comparisons are the usual binary operators `>`, `<`, `>=`, `<=`, `==`, and `!=`. We also support the negation operator `!` which can be used twice `!!` to force a value to be a boolean.

Do we want to support "truthiness"? `nil` and `false` are false while everything else is true?

All operators are redefinable for given objects.

```
obj = Object.new(
  ">": {|other| self.id > other.id },
  "<": {|other| ... },
  "==": {|other| ... },
  ...
)
```

Though do note that the default implementation of `!=` is nothing more than `!(self == b)`, so if you want to change equality then define `==` which will take care of equal and not-equal.

### Loops

Loops are done through normal comprehensions.

```
[1, 2, 3].each { |element|
}
```

### Methods and Blocks

Blocks are created with curly brackets `{...}` and can have any number of defined arguments inside of pipe characters `|...|`. Blocks support the `return` keyword but will also return the last value of the block implicitly.

```
# Block with no arguments
plain = { "Plain Block" }

# Block with one argument
oneArg = { |arg| "My argument is ${arg}" }

# Block with multiple arguments
add = { |x, y| x + y }

# Block with default arguments
split = { |str, on: ","| str.split(on) }
```

There are a couple of rules regarding how to execute blocks. All blocks respond to the `call` message which takes the arguments list and runs the block with those arguments. This is also wrapped around some syntax sugar that enables direct use of parantheses `()` to call a block. When there's more than one argument to a method, explicitly naming the arguments becomes required, unless that argument has a provided default.

```
plain.call
# or
plain()

oneArg.call "argument"

add.call x: 1, y: 2

split(str: "Left,Right")
# or
split(str: "Hello World", on: " ")
```

All blocks are assignable objects as well as closures. When a block is assigned to a slot, it becomes a method, letting the block access other slots on that method either with `self` or implicitly. When sending such a message, you can just use the name of the slot. Parenthese are optional where there is no ambiguity in arguments.

```
obj = Object.new(
  split: { |str, on: ","| str.split(on) }
)

obj.split str: "Left,Right"
```


Question: If a method ends up with just one argument due to the defaults of other arguments, should that require the one argument to be keyworded?

```
obj.split "Left,Right"
```

Blocks can also take other blocks as arguments!

```
around = { |other|
  # do something
  other.call
  # do something
}

around {
  # Wrap this
}
```

### Objects and Inheritance

You've already seen how to create new objects! Every object needs to be cloned from the base `Object` or any object that has thus been cloned from `Object`.

```
base = Object.new(slot1: { "This is slot 1" })
next = base.new(slot2: { "This is slot 2" })
third = next.new(slot3: { "This is slot 3" })

third.slot1  # => "This is slot 1"
third.slot2  # => "This is slot 2"
third.slot3  # => "This is slot 3"
```

Capitalization of object variables has one important distinction. It is common for developers to want to define "types" that objects will adhere to. In many languages this is accomplished with a class-based syntax, but that leads to very restrictive object models that fight against modification and malleability. Instead, we let everything be objects, but if the variable holding an object starts with a Capital letter, then it will be considered a "type" ("trait"?) and will show up in the Workbench as an available tool to use. Making use of the "tool" will create a new object from that tool to actually use in the application.

### Multiple parents

Our way of implementing mixins is through multiple parents. Any object starts with one parent but can be given any number of parents afterward. Use the `addParent` message to do so:

```
Helpers = Object.new(help: { "This is help!" })
obj = Object.new

obj.addParent(Helpers)

obj.help  # => "This is help!"
```

Message lookup when working with multiple parents is done via a Depth-first search algorithm. This ensures a deterministic way of finding where methods live, paritcularly in the case that there's a deep tree of objects each with multiple parents.

You can see the order of parents a current object has by calling `parents`

```
obj1 = Object.new
obj2 = obj1.new
obj3 = obj2.new
obj4 = Object.new

obj3.addParent obj4

obj1.parents # => [Object]
obj2.parents # => [obj1]
obj3.parents # => [obj2, obj4]
```

`isA(object)` checks against `self` first, then looks up the `parents` list in a Depth-First pattern.

Message can really be any name you want, but there's one rule that if the message name fits the pattern of an identifier (e.g. the same rules that define if a word is a valid variable name), it can be invoked directly with the `.` operator.

If the message is otherwise a string of some random characters, invoking that message requires using the `send` message that's available on all objects.

```
obj = Object.new(
  regularMethod: { "Regular!" }
  "Irregular Method": { "Irregular!" }
)

obj.regularMethod             # => "Regular!"
obj.send("Irregular Method")  # => "Irregular!"
```

Getting access to a method object directly can be done with `getSlot`. A Method object includes introspective messages and information on the details.

Calling `getSlot` on a slot that returns a plain value will do ... something?

```
obj = Object.new(
  size: 0,
  hello: { "World" },
)

hello = obj.getSlot("hello")

hello.arity # => 0
hello.call  # => "World"

size = obj.getSlot("size")

# Other possible options?
size.call   # => 0
```

## Available data types

### Array

Arrays are contiguous collections of objects. Create one manually or you can use the syntax `[]`. Arrays can be used as stacks.

```
a1 = Array.new
a1.push(1)
a1.push(2)

a2 = [1, 2, 3]
a2.size        # => 3
a2.push(4)
a2.size        # => 4
```

### Hash

Is a "Hash" just another name for an object? Syntax sugar `[]` and `[]=`? Maybe I should have syntax sugar for creating a base object. I don't like the ambiguous form of `{}` in Ruby for block and Hash, so if `{}` is block of code, `[]` is a list, what should a Hash be? `%{}` (`#` is comment, that's out)? What about `()`? That's got weird connotations related to method calls.

### String

Strings are as any other language. Anything between single (') or double (") quote marks. The quote marks must match and can be embedded in each other (`"'"`, `'"'`). Explicit escaping is done with the backslash (`" \" \" "`).

Strings are themselves immutable.

It's important to note that Strings are expected to be used in many locations in this language, and as such any raw string that exists in the source code is internalized/frozen/symbolized such that the multiple equivalents string will actually be the same object during runtime and won't be garbage collected. It doesn't matter if the string is built with single or double quotes, that's just syntax sugar.
