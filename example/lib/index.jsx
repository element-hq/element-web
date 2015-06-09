var React = require("react");
// In normal usage of the module:
//var MatrixReactSdk = require("matrix-react-sdk");
// Or to import the source directly from the file system:
// (This is useful for debugging the SDK as ut seems source
// maps cannot pass through two stages).
var MatrixReactSdk = require("../../src/index");

React.render(
    <MatrixReactSdk.MatrixChat />,
    document.getElementById('matrixchat')
);
