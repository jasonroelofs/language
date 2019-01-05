Unnamed Language [![Build Status](https://travis-ci.org/jasonroelofs/language.svg?branch=master)](https://travis-ci.org/jasonroelofs/language)
----------------

Influenced by Smalltalk, Self, IO, Javascript, and Ruby.

Implemented in Typescript.

Still looking for a name! See the `docs/` directory for notes on what the language is going to look like.

## Structure

* src/
    Source for the parser/compiler and VM infrastructure
* docs/
    Documentation on the what/why/etc.
* test/
    Unit tests for the parser/compiler and VM infrastructure
* spec/
    Official language spec, implemented in the language as a test suite

## Getting Started

```
make setup
make
```

## Building for the web

```
make setup
make web
open web/index.html
```
