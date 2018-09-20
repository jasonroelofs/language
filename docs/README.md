Unnamed
-------

Complexity through Simplicity

Design for Humans

http://worrydream.com/LearnableProgramming/

I'm designing and building this language and ecosystem to try to solve a couple of problems I've come to see as endemic to software as a whole:

* Complexity
* Accessibility
* Maleability

### Complexity

Much of the software we use is more complex and complicated than it needs to be. Either through the use of the wrong abstractions, no abstractions, or just becoming complex for complexity's sake, it's way too easy to end up with a mess that's impossible to understand. Now, I understand that at some point complexity is fundamental to what we do. Choosing the right abstraction is hard, keeping code manageable is hard, and real-life requirements just get messy.

A couple of things I plan on playing with to help manage complexity:

* DSL support, while not being a LISP. DSLs are great for providing better abstractions. They also let users write in more declarative formats, defining what they want, and letting the system figure out how to provide it.
* Really good error handling and messages. Documentation is an endemic issue across the board.
* Batteries included design. One constant source of complexity is reimplementing the wheel. Languages that provide the minimal mean that it's up to other developers to provide their opinions on how something is supposed to be done. Providing more built-in tools removes the need for people to make that decision.

### Accessibility

Programming is both trivially easy to get into and mind bogglingly difficult to do well. Part of this problem is the sheer volume of knowledge required to do things well. Anyone can grab Ruby or Python and follow tutorials (like the fantasic [Learn Code the Hard Way](https://learncodethehardway.org/) but to graduate up to building a web application you need to know: HTML, CSS, and Javascript, possibly a front-end framework like React, Angular, Ember, or View, browser idosyncracies between Safari, Firefox, and Chrome, communication protocols and the like as in JSON, JSON-API, REST, or GraphQL, and that's not even taking into account a back-end server!

But I digress, this isn't going to be solved by tech, it's a people problem, but we can provide a clean syntax, hints, directions, and tutorials that help people take steps towards understanding what they can do. What we can also do is open up software to let people make changes and see what happens.

### Maleability

So this is an interesting one. For the vast majority of people, even those of us who work on it on a daily basis, software is a giant magical black box. When using applications, we are at the whims of those who developed it, bugs, dumb (or evil) decisions, bad UX, the works. Even when we're building such applications, most systems make it very difficult to dive into how it all works, whether that's for learning, debugging, or (most often) both.

What if you could pick any method, any variable, or even any GUI element and dive into the application's code to see how it's implemented? What if you could then alter that code yourself, fixing bugs or otherwise altering the application to better serve *your* needs?

## Goals

* Don't Reinvent the Wheel. Software has some amazing shoulders to stand on and we need to learn from our forefathers.
* Pure OO, prototype inheritance. People thing in terms of things, and mutability is the norm.
* Message passing.
* Smalltalk-like message signatures. Explicit arguments and better documentation.
* Batteries-included environment. Like Smalltalk but less restricted to running everything in the image. More like LISP?
* Strict, defined source formatting. One of my favorite things about `go` is `go fmt`. There's no bike shedding, you're either right or wrong.
* Live coding. Update the code, see the changes right away. Via a build-in editor or your own choice of external (I'm a vim guy myself). Errors throw you immediately into REPL debug mode, make a change, recompile, keep moving.
* Refinements: Changes are stored seperate from the code they're modifying, providing fallback to known working state and a history of what's changed. This makes them also shareable.
* Eventually: bootstrapped. The whole system should be divable
* Portability. I don't care about speed that much, computers are super fast, and following point 1 I definitely am not writing this in C. In fact, it's probably going to be in Typescript to start. Javascript is ubiquitous, the ultimate portable language, and WebASM is filling in the performance gaps.
* Byte-code virtual machine. Look into Lua 5.0's form of a stack-machine but register-like parameters that reach into the stack.

## Influences

* Rebol / Red :: Declarative programming. Batteries included
* Smalltalk / Pharo / Self / IO :: Pure OO, prototype based, message passing and clean, simple syntax
* Smalltalk / Pharo :: Image-based systems, providing an environment, not just a runtime + source code.
* Ruby :: Design for user happiness. Principle of Least Surprise
* IO :: Let users change anything!
