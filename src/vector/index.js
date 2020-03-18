/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// Require common CSS here; this will make webpack process it into bundle.css.
// Our own CSS (which is themed) is imported via separate webpack entry points
// in webpack.config.js
require('gfm.css/gfm.css');
require('highlight.js/styles/github.css');

// These are things that can run before the skin loads - be careful not to reference the react-sdk though.
import './rageshakesetup';
import './modernizr';

// load service worker if available on this platform
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

// Ensure the skin is the very first thing to load for the react-sdk. We don't even want to reference
// the SDK until we have to in imports.
console.log("Loading skin...");
import * as sdk from 'matrix-react-sdk';
import * as skin from "../component-index";
sdk.loadSkin(skin);
console.log("Skin loaded!");

// Finally, load the app. All of the other react-sdk imports are in this file which causes the skinner to
// run on the components. We use `require` here to make sure webpack doesn't optimize this into an async
// import and thus running before the skin can load.
require("./app").loadApp();
