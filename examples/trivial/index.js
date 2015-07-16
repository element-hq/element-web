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

var React = require("react");
// In normal usage of the module:
//var MatrixReactSdk = require("matrix-react-sdk");
// Or to import the source directly from the file system:
// (This is useful for debugging the SDK as it seems source
// maps cannot pass through two stages).
var MatrixReactSdk = require("../../src/index");

// Here, we do some crude URL analysis to allow
// deep-linking. We only support registration
// deep-links in this example.
function routeUrl(location) {
    if (location.hash.indexOf('#/register') == 0) {
        var hashparts = location.hash.split('?');
        var params = {};
        if (hashparts.length == 2) {
            var pairs = hashparts[1].split('&');
            for (var i = 0; i < pairs.length; ++i) {
                var parts = pairs[i].split('=');
                if (parts.length != 2) continue;
                params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
            }
        }
        window.matrixChat.showScreen('register', params);
    }
}

var loaded = false;

window.onload = function() {
    routeUrl(window.location);
    loaded = true;
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
var onNewScreen = function(screen) {
    if (!loaded) return;
    window.location.hash = '#/'+screen;
}

// We use this to work out what URL the SDK should
// pass through when registering to allow the user to
// click back to the client having registered.
// It's up to us to recognise if we're loaded with
// this URL and tell MatrixClient to resume registration.
var makeRegistrationUrl = function() {
    return window.location.protocol + '//' +
           window.location.host +
           window.location.pathname +
           '#/register';
}

window.matrixChat = React.render(
    <MatrixReactSdk.MatrixChat onNewScreen={onNewScreen} registrationUrl={makeRegistrationUrl()} />,
    document.getElementById('matrixchat')
);
