/*
Copyright 2015 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

// Remember to make your project depend on react directly as soon as
// you add a require('react') to any file in your project. Do not rely
// on react being pulled in via matrix-react-sdk: browserify breaks
// horribly in this situation and can end up pulling in multiple copies
// of react.
var React = require("react");

// We pull in the component broker first, separately, as we need to replace
// components before the SDK loads.
var ComponentBroker = require("matrix-react-sdk/src/ComponentBroker");

var CustomMTextTile = require('./CustomMTextTile');

ComponentBroker.set('molecules/MTextTile', CustomMTextTile);

var MatrixReactSdk = require("matrix-react-sdk");
//var MatrixReactSdk = require("../../src/index");

React.render(
    <MatrixReactSdk.MatrixChat />,
    document.getElementById('matrixchat')
);
