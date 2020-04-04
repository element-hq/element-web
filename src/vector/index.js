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

// React depends on Map & Set which we check for using modernizr's es6collections
// if modernizr fails we may not have a functional react to show the error message.
// try in react but fallback to an `alert`
async function start() {
    // load init.ts async so that its code is not executed immediately and we can catch any exceptions
    const {loadSkin, loadApp} = await import(
        /* webpackChunkName: "init" */
        /* webpackPreload: true */
        "./init");

    await loadSkin();
    await loadApp();
}
start().catch(err => {
    // try show the error in React
    console.error(err);
}).catch(err => {
    // fall back to showing the error in an alert
    console.error(err);
});
