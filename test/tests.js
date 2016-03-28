// tests.js
//
// Our master test file: uses the webpack require API to find our test files
// and run them

// this is a handly place to make sure the sdk has been skinned
var sdk = require("matrix-react-sdk");
sdk.loadSkin(require('./test-component-index'));

var context = require.context('.', true, /-test\.jsx?$/);
context.keys().forEach(context);
