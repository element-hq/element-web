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

var RunModernizrTests = require("./modernizr"); // this side-effects a global
var React = require("react");
var ReactDOM = require("react-dom");
var sdk = require("matrix-react-sdk");
sdk.loadSkin(require('../skins/vector/skindex'));
var VectorConferenceHandler = require('../VectorConferenceHandler');
var configJson = require("../../config.json");

var qs = require("querystring");

var lastLocationHashSet = null;

var CallHandler = require("matrix-react-sdk/lib/CallHandler");
CallHandler.setConferenceHandler(VectorConferenceHandler);

function checkBrowserFeatures(featureList) {
    if (!window.Modernizr) {
        console.error("Cannot check features - Modernizr global is missing.");
        return false;
    }
    var featureComplete = true;
    for (var i = 0; i < featureList.length; i++) {
        if (window.Modernizr[featureList[i]] === undefined) {
            console.error(
                "Looked for feature '%s' but Modernizr has no results for this. " +
                "Has it been configured correctly?", featureList[i]
            );
            return false;
        }
        if (window.Modernizr[featureList[i]] === false) {
            console.error("Browser missing feature: '%s'", featureList[i]);
            // toggle flag rather than return early so we log all missing features
            // rather than just the first.
            featureComplete = false;
        }
    }
    return featureComplete;
}

var validBrowser = checkBrowserFeatures([
    "displaytable", "flexbox", "es5object", "es5function", "localstorage",
    "objectfit"
]);

// We want to support some name / value pairs in the fragment
// so we're re-using query string like format
function parseQsFromFragment(location) {
    var hashparts = location.hash.split('?');
    if (hashparts.length > 1) {
        return qs.parse(hashparts[1]);
    }
    return {};
}

function parseQs(location) {
    return qs.parse(location.search.substring(1));
}

// Here, we do some crude URL analysis to allow
// deep-linking. We only support registration
// deep-links in this example.
function routeUrl(location) {
    var params = parseQs(location);
    var loginToken = params.loginToken;
    if (loginToken) {
        window.matrixChat.showScreen('token_login', parseQs(location));
    }
    else if (location.hash.indexOf('#/register') == 0) {
        window.matrixChat.showScreen('register', parseQsFromFragment(location));
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

window.addEventListener('hashchange', onHashChange);
window.onload = function() {
    if (!validBrowser) {
        return;
    }
    routeUrl(window.location);
    loaded = true;
    if (lastLoadedScreen) {
        onNewScreen(lastLoadedScreen);
        lastLoadedScreen = null;
    }
}

function loadApp() {
    if (validBrowser) {
        var MatrixChat = sdk.getComponent('structures.MatrixChat');
        window.matrixChat = ReactDOM.render(
            <MatrixChat
                onNewScreen={onNewScreen}
                registrationUrl={makeRegistrationUrl()}
                ConferenceHandler={VectorConferenceHandler}
                config={configJson} />,
            document.getElementById('matrixchat')
        );
    }
    else {
        console.error("Browser is missing required features.");
        // take to a different landing page to AWOOOOOGA at the user
        var CompatibilityPage = sdk.getComponent("structures.CompatibilityPage");
        window.matrixChat = ReactDOM.render(
            <CompatibilityPage onAccept={function() {
                validBrowser = true;
                console.log("User accepts the compatibility risks.");
                loadApp();
                window.onload(); // still do the same code paths for compatible clients
            }} />,
            document.getElementById('matrixchat')
        );
    }  
}

loadApp();
