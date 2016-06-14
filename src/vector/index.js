/*
Copyright 2015, 2016 OpenMarket Ltd

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

// for ES6 stuff like startsWith() that Safari doesn't handle
// and babel doesn't do by default
require('babel-polyfill');

// CSS requires: just putting them here for now as CSS is going to be
// refactored soon anyway
require('../../vector/components.css');
require('gemini-scrollbar/gemini-scrollbar.css');
require('gfm.css/gfm.css');
require('highlight.js/styles/github.css');
require('draft-js/dist/Draft.css');


 // add React and ReactPerf to the global namespace, to make them easier to
 // access via the console
global.React = require("react");
if (process.env.NODE_ENV !== 'production') {
    global.ReactPerf = require("react-addons-perf");
}

var RunModernizrTests = require("./modernizr"); // this side-effects a global
var ReactDOM = require("react-dom");
var sdk = require("matrix-react-sdk");
sdk.loadSkin(require('../component-index'));
var VectorConferenceHandler = require('../VectorConferenceHandler');
var UpdateChecker = require("./updater");
var q = require('q');
var request = require('browser-request');

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
//
// returns {location, params}
function parseQsFromFragment(location) {
    // if we have a fragment, it will start with '#', which we need to drop.
    // (if we don't, this will return '').
    var fragment = location.hash.substring(1);

    // our fragment may contain a query-param-like section. we need to fish
    // this out *before* URI-decoding because the params may contain ? and &
    // characters which are only URI-encoded once.
    var hashparts = fragment.split('?');

    var result = {
        location: decodeURIComponent(hashparts[0]),
        params: {}
    };

    if (hashparts.length > 1) {
        result.params = qs.parse(hashparts[1]);
    }
    return result;
}

function parseQs(location) {
    return qs.parse(location.search.substring(1));
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location) {
    if (!window.matrixChat) return;

    console.log("Routing URL "+window.location);
    var params = parseQs(location);
    var loginToken = params.loginToken;
    if (loginToken) {
        window.matrixChat.showScreen('token_login', params);
        return;
    }

    var fragparts = parseQsFromFragment(location);
    window.matrixChat.showScreen(fragparts.location.substring(1),
                                 fragparts.params);
}

function onHashChange(ev) {
    if (decodeURIComponent(window.location.hash) == lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

function onVersion(current, latest) {
    window.matrixChat.onVersion(current, latest);
}

var loaded = false;
var lastLoadedScreen = null;

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
var onNewScreen = function(screen) {
    console.log("newscreen "+screen);
    if (!loaded) {
        lastLoadedScreen = screen;
    } else {
        var hash = '#/' + screen;
        lastLocationHashSet = hash;
        window.location.hash = hash;
        if (ga) ga('send', 'pageview', window.location.pathname + window.location.search + window.location.hash);
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
    console.log("window.onload");
    if (!validBrowser) {
        return;
    }
    UpdateChecker.setVersionListener(onVersion);
    UpdateChecker.run();
    routeUrl(window.location);
    loaded = true;
    if (lastLoadedScreen) {
        onNewScreen(lastLoadedScreen);
        lastLoadedScreen = null;
    }
}

function getConfig() {
    let deferred = q.defer();

    request(
        { method: "GET", url: "config.json", json: true },
        (err, response, body) => {
            if (err || response.status < 200 || response.status >= 300) {
                deferred.reject({err: err, response: response});
                return;
            }

            deferred.resolve(body);
        }
    );

    return deferred.promise;
}

async function loadApp() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        if (confirm("Vector runs much better as an app on iOS. Get the app?")) {
            window.location = "https://itunes.apple.com/us/app/vector.im/id1083446067";
            return;
        }
    }
    else if (/Android/.test(navigator.userAgent)) {
        if (confirm("Vector runs much better as an app on Android. Get the app?")) {
            window.location = "https://play.google.com/store/apps/details?id=im.vector.alpha";
            return;
        }
    }

    let configJson;
    let configError;
    try {
        configJson = await getConfig();
    } catch (e) {
        // On 404 errors, carry on without a config,
        // but on other errors, fail, otherwise it will
        // lead to subtle errors where the app runs with
        // the default config if it fails to fetch config.json.
        if (e.response.status != 404) {
            configError = e;
        }
    }

    console.log("Vector starting at "+window.location);
    if (configError) {
        window.matrixChat = ReactDOM.render(<div className="error">
            Unable to load config file: please refresh the page to try again.
        </div>, document.getElementById('matrixchat'));
    } else if (validBrowser) {
        var MatrixChat = sdk.getComponent('structures.MatrixChat');
        var fragParts = parseQsFromFragment(window.location);
        window.matrixChat = ReactDOM.render(
            <MatrixChat
                onNewScreen={onNewScreen}
                registrationUrl={makeRegistrationUrl()}
                ConferenceHandler={VectorConferenceHandler}
                config={configJson}
                startingQueryParams={fragParts.params}
                enableGuest={true} />,
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
