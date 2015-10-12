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
var sdk = require("matrix-react-sdk");
sdk.loadSkin(require('../skins/vector/skindex'));
sdk.loadModule(require('../modules/VectorConferenceHandler'));

var qs = require("querystring");

var lastLocationHashSet = null;


// We want to support some name / value pairs in the fragment
// so we're re-using query string ike format
function parseQsFromFragment(location) {
    var hashparts = location.hash.split('?');
    if (hashparts.length > 1) {
        console.log(qs.parse(hashparts[1]));
        return qs.parse(hashparts[1]);
    }
    return {};
}

// Here, we do some crude URL analysis to allow
// deep-linking. We only support registration
// deep-links in this example.
function routeUrl(location) {
    if (location.hash.indexOf('#/register') == 0) {
        window.matrixChat.showScreen('register', parseQsFromFragment(location));
    } else if (location.hash.indexOf('#/login/cas') == 0) {
        window.matrixChat.showScreen('cas_login', parseQsFromFragment(location));
    } else {
        window.matrixChat.showScreen(location.hash.substring(2));
    }
}

function onHashChange(ev) {
    if (decodeURIComponent(window.location.hash) == lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

var loaded = false;
var lastLoadedScreen = null;

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
var onNewScreen = function(screen) {
    if (!loaded) {
        lastLoadedScreen = screen;
    } else {
        var hash = '#/' + screen;
        lastLocationHashSet = hash;
        window.location.hash = hash;
    }
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

var MatrixChat = sdk.getComponent('pages.MatrixChat');
window.matrixChat = React.render(
    <MatrixChat onNewScreen={onNewScreen} registrationUrl={makeRegistrationUrl()} />,
    document.getElementById('matrixchat')
);

window.addEventListener('hashchange', onHashChange);
window.onload = function() {
    routeUrl(window.location);
    loaded = true;
    if (lastLoadedScreen) {
        onNewScreen(lastLoadedScreen);
        lastLoadedScreen = null;
    }
}

