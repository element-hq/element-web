// all-tests.js
//
// Our master test file: uses the webpack require API to find our test files
// and run them

// ideally these unit tests could be run under nodejs rather than in a browser
// via karma, but having two separate test frameworks in the same project
// seems confusing
const unit_tests = require.context('./unit-tests', true, /\.js$/);
unit_tests.keys().forEach(unit_tests);

const app_tests = require.context('./app-tests', true, /\.jsx?$/);
app_tests.keys().forEach(app_tests);
