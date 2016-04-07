// all-tests.js
//
// Our master test file: uses the webpack require API to find our test files
// and run them

var context = require.context('.', true, /-test\.jsx?$/);
context.keys().forEach(context);
