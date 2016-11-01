Matrix JavaScript/ECMAScript Style Guide
========================================

The intention of this guide is to make Matrix's JavaScript codebase clean,
consistent with other popular JavaScript styles and consistent with the rest of
the Matrix codebase. For reference, the Matrix Python style guide can be found
at https://github.com/matrix-org/synapse/blob/master/docs/code_style.rst

This document reflects how we would like Matrix JavaScript code to look, with
acknowledgement that a significant amount of code is written to older
standards.

Write applications in modern ECMAScript and use a transpiler where necessary to
target older platforms. When writing library code, consider carefully whether
to write in ES5 to allow all JavaScript application to use the code directly or
writing in modern ECMAScript and using a transpile step to generate the file
that applications can then include. There are significant benefits in being
able to use modern ECMAScript, although the tooling for doing so can be awkward
for library code, especially with regard to translating source maps and line
number throgh from the original code to the final application.

General Style
-------------
- 4 spaces to indent, for consistency with Matrix Python.
- 120 columns per line, but try to keep JavaScript code around the 80 column mark.
  Inline JSX in particular can be nicer with more columns per line.
- No trailing whitespace at end of lines.
- Don't indent empty lines.
- One newline at the end of the file.
- Unix newlines, never `\r`
- Indent similar to our python code: break up long lines at logical boundaries,
  more than one argument on a line is OK
- Use semicolons, for consistency with node.
- UpperCamelCase for class and type names
- lowerCamelCase for functions and variables.
- Single line ternary operators are fine.
- UPPER_CAMEL_CASE for constants
- Single quotes for strings by default, for consistency with most JavaScript styles:

  ```javascript
  "bad" // Bad
  'good' // Good
  ```
- Use parentheses or `` ` `` instead of `\` for line continuation where ever possible
- Open braces on the same line (consistent with Node):

  ```javascript
  if (x) {
      console.log("I am a fish"); // Good
  }

  if (x)
  {
      console.log("I am a fish"); // Bad
  }
  ```
- Spaces after `if`, `for`, `else` etc, no space around the condition:

  ```javascript
  if (x) {
      console.log("I am a fish"); // Good
  }

  if(x) {
      console.log("I am a fish"); // Bad
  }

  if ( x ) {
      console.log("I am a fish"); // Bad
  }
  ```
- Declare one variable per var statement (consistent with Node). Unless they
  are simple and closely related. If you put the next declaration on a new line,
  treat yourself to another `var`:

  ```javascript
  var key = "foo",
      comparator = function(x, y) {
          return x - y;
      }; // Bad

  var key = "foo";
  var comparator = function(x, y) {
      return x - y;
  }; // Good

  var x = 0, y = 0; // Fine

  var x = 0;
  var y = 0; // Also fine
  ```
- A single line `if` is fine, all others have braces. This prevents errors when adding to the code.:

  ```javascript
  if (x) return true; // Fine

  if (x) {
      return true; // Also fine
  }

  if (x)
      return true; // Not fine
  ```
- Terminate all multi-line lists, object literals, imports and ideally function calls with commas (if using a transpiler). Note that trailing function commas require explicit configuration in babel at time of writing:

  ```javascript
  var mascots = [
      "Patrick",
      "Shirley",
      "Colin",
      "Susan",
      "Sir Arthur David" // Bad
  ];

  var mascots = [
      "Patrick",
      "Shirley",
      "Colin",
      "Susan",
      "Sir Arthur David", // Good
  ];
  ```
- Use `null`, `undefined` etc consistently with node:
  Boolean variables and functions should always be either true or false. Don't set it to 0 unless it's supposed to be a number.
  When something is intentionally missing or removed, set it to null.
  If returning a boolean, type coerce:

  ```javascript
  function hasThings() {
      return !!length; // bad
      return new Boolean(length); // REALLY bad
      return Boolean(length); // good
  }
  ```
  Don't set things to undefined. Reserve that value to mean "not yet set to anything."
  Boolean objects are verboten.
- Use JSDoc

ECMAScript
----------
- Use `const` unless you need a re-assignable variable. This ensures things you don't want to be re-assigned can't be.
- Be careful migrating files to newer syntax.
  - Don't mix `require` and `import` in the same file. Either stick to the old style or change them all.
  - Likewise, don't mix things like class properties and `MyClass.prototype.MY_CONSTANT = 42;`
  - Be careful mixing arrow functions and regular functions, eg. if one function in a promise chain is an
    arrow function, they probably all should be.
- Apart from that, newer ES features should be used whenever the author deems them to be appropriate.
- Flow annotations are welcome and encouraged.

React
-----
- Use React.createClass rather than ES6 classes for components, as the boilerplate is way too heavy on ES6 currently.  ES7 might improve it.
- Pull out functions in props to the class, generally as specific event handlers:

  ```jsx
  <Foo onClick={function(ev) {doStuff();}}> // Bad
  <Foo onClick={(ev) => {doStuff();}}> // Equally bad
  <Foo onClick={this.doStuff}> // Better
  <Foo onClick={this.onFooClick}> // Best, if onFooClick would do anything other than directly calling doStuff
  ```
  
  Not doing so is acceptable in a single case; in function-refs:
  
  ```jsx
  <Foo ref={(self) => this.component = self}>
  ```
- Think about whether your component really needs state: are you duplicating
  information in component state that could be derived from the model?
