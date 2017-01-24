/*
Copyright 2016 OpenMarket Ltd

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

/* loading.js: test the myriad paths we have for loading the application */

import 'skin-sdk';

import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-addons-test-utils';
import expect from 'expect';
import q from 'q';

import jssdk from 'matrix-js-sdk';

import sdk from 'matrix-react-sdk';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';

import test_utils from '../test-utils';
import MockHttpBackend from '../mock-request';
import {parseQs, parseQsFromFragment} from '../../src/vector/url_utils';

var DEFAULT_HS_URL='http://my_server';
var DEFAULT_IS_URL='http://my_is';

describe('loading:', function () {
    let parentDiv;
    let httpBackend;

    // an Object simulating the window.location
    let windowLocation;

    // the mounted MatrixChat
    let matrixChat;

    // a promise which resolves when the MatrixChat calls onLoadCompleted
    let loadCompletePromise;

    beforeEach(function() {
        test_utils.beforeEach(this);
        httpBackend = new MockHttpBackend();
        jssdk.request(httpBackend.requestFn);
        parentDiv = document.createElement('div');

        // uncomment this to actually add the div to the UI, to help with
        // debugging (but slow things down)
        // document.body.appendChild(parentDiv);

        windowLocation = null;
        matrixChat = null;
    });

    afterEach(function() {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }
    });

    /* simulate the load process done by index.js
     *
     * TODO: it would be nice to factor some of this stuff out of index.js so
     * that we can test it rather than our own implementation of it.
     */
    function loadApp(opts) {
        opts = opts || {};
        const queryString = opts.queryString || "";
        const uriFragment = opts.uriFragment || "";

        windowLocation = {
            search: queryString,
            hash: uriFragment,
            toString: function() { return this.search + this.hash; },
        };

        let lastLoadedScreen = null;
        let appLoaded = false;

        let loadCompleteDefer = q.defer();
        loadCompletePromise = loadCompleteDefer.promise;

        function onNewScreen(screen) {
            console.log(Date.now() + " newscreen "+screen);
            if (!appLoaded) {
                lastLoadedScreen = screen;
            } else {
                var hash = '#/' + screen;
                windowLocation.hash = hash;
                console.log(Date.now() + " browser URI now "+ windowLocation);
            }
        }

        const MatrixChat = sdk.getComponent('structures.MatrixChat');
        const fragParts = parseQsFromFragment(windowLocation);
        var params = parseQs(windowLocation);
        matrixChat = ReactDOM.render(
            <MatrixChat
                onNewScreen={onNewScreen}
                config={{
                    default_hs_url: DEFAULT_HS_URL,
                    default_is_url: DEFAULT_IS_URL,
                }}
                realQueryParams={params}
                startingFragmentQueryParams={fragParts.params}
                enableGuest={true}
                onLoadCompleted={loadCompleteDefer.resolve}
            />, parentDiv
        );

        function routeUrl(location, matrixChat) {
            console.log(Date.now() + " Routing URL "+location);
            var fragparts = parseQsFromFragment(location);
            matrixChat.showScreen(fragparts.location.substring(1),
                                  fragparts.params);
        }

        // pause for a cycle, then simulate the window.onload handler
        window.setTimeout(() => {
            console.log(Date.now() + " simulating window.onload");
            routeUrl(windowLocation, matrixChat);
            appLoaded = true;
            if (lastLoadedScreen) {
                onNewScreen(lastLoadedScreen);
                lastLoadedScreen = null;
            }
        }, 0);
    }

    describe("Clean load with no stored credentials:", function() {
        it('gives a login panel by default', function (done) {
            loadApp();

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // Wait for another trip around the event loop for the UI to update
                return q.delay(1);
            }).then(() => {
                // we expect a single <Login> component
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.login.Login'));
                expect(windowLocation.hash).toEqual("");
            }).done(done, done);
        });

        it('should follow the original link after successful login', function(done) {
            loadApp({
                uriFragment: "#/room/!room:id",
            });

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // Wait for another trip around the event loop for the UI to update
                return q.delay(1);
            }).then(() => {
                // we expect a single <Login> component
                let login = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.login.Login'));
                httpBackend.when('POST', '/login').check(function(req) {
                    expect(req.data.type).toEqual('m.login.password');
                    expect(req.data.user).toEqual('user');
                    expect(req.data.password).toEqual('pass');
                }).respond(200, {
                    user_id: '@user:id',
                    access_token: 'access_token',
                });
                login.onPasswordLogin("user", "pass")
                return httpBackend.flush();
            }).then(() => {
                // Wait for another trip around the event loop for the UI to update
                return q.delay(1);
            }).then(() => {
                // we expect a spinner
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('elements.Spinner'));

                httpBackend.when('GET', '/pushrules').respond(200, {});
                httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });
                httpBackend.when('GET', '/sync').respond(200, {});
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!room:id");

                // and the localstorage should have been updated
                expect(localStorage.getItem('mx_user_id')).toEqual('@user:id');
                expect(localStorage.getItem('mx_access_token')).toEqual('access_token');
                expect(localStorage.getItem('mx_hs_url')).toEqual(DEFAULT_HS_URL);
                expect(localStorage.getItem('mx_is_url')).toEqual(DEFAULT_IS_URL);
            }).done(done, done);
        });
    });

    describe("MatrixClient rehydrated from stored credentials:", function() {
        beforeEach(function() {
            localStorage.setItem("mx_hs_url", "http://localhost" );
            localStorage.setItem("mx_is_url", "http://localhost" );
            localStorage.setItem("mx_access_token", "access_token");
            localStorage.setItem("mx_user_id", "@me:localhost");
        });

        it('shows a directory by default if we have no joined rooms', function(done) {
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });
            httpBackend.when('GET', '/sync').respond(200, {});

            loadApp();

            return awaitSyncingSpinner(matrixChat).then(() => {
                // we got a sync spinner - let the sync complete
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a directory
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomDirectory'));
                expect(windowLocation.hash).toEqual("#/directory");
            }).done(done, done);
        });

        it('shows a room view if we followed a room link', function(done) {
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });
            httpBackend.when('GET', '/sync').respond(200, {});

            loadApp({
                uriFragment: "#/room/!room:id",
            });

            return awaitSyncingSpinner(matrixChat).then(() => {
                // we got a sync spinner - let the sync complete
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!room:id");
            }).done(done, done);

        });
    });

    describe('Guest auto-registration:', function() {
        it('shows a directory by default', function (done) {
            loadApp();

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(200, {
                    user_id: "@guest:localhost",
                    access_token: "secret_token",
                });

                return httpBackend.flush();
            }).then(() => {
                return awaitSyncingSpinner(matrixChat);
            }).then(() => {
                // we got a sync spinner - let the sync complete
                httpBackend.when('GET', '/sync').respond(200, {});
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a directory
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomDirectory'));
                expect(windowLocation.hash).toEqual("#/directory");
            }).done(done, done);
        });

        it('uses the last known homeserver to register with', function (done) {
            localStorage.setItem("mx_hs_url", "https://homeserver" );
            localStorage.setItem("mx_is_url", "https://idserver" );

            loadApp();

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.path).toMatch(new RegExp("^https://homeserver/"));
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(200, {
                    user_id: "@guest:localhost",
                    access_token: "secret_token",
                });

                return httpBackend.flush();
            }).then(() => {
                return awaitSyncingSpinner(matrixChat);
            }).then(() => {
                httpBackend.when('GET', '/sync').check(function(req) {
                    expect(req.path).toMatch(new RegExp("^https://homeserver/"));
                }).respond(200, {});
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a directory
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomDirectory'));
                expect(windowLocation.hash).toEqual("#/directory");
                expect(MatrixClientPeg.get().baseUrl).toEqual("https://homeserver");
                expect(MatrixClientPeg.get().idBaseUrl).toEqual("https://idserver");
            }).done(done, done);
        });

        it('shows a room view if we followed a room link', function(done) {
            loadApp({
                uriFragment: "#/room/!room:id"
            });
            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(200, {
                    user_id: "@guest:localhost",
                    access_token: "secret_token",
                });

                return httpBackend.flush();
            }).then(() => {
                return awaitSyncingSpinner(matrixChat);
            }).then(() => {
                httpBackend.when('GET', '/sync').respond(200, {});
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!room:id");
            }).done(done, done);
        });
    });

    describe('Token login:', function() {
        it('logs in successfully', function (done) {
            loadApp({
                queryString: "?loginToken=secretToken&homeserver=https%3A%2F%2Fhomeserver&identityServer=https%3A%2F%2Fidserver",
            });

            q.delay(1).then(() => {
                // we expect a spinner while we're logging in
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/login').check(function(req) {
                    expect(req.path).toMatch(new RegExp("^https://homeserver/"));
                    expect(req.data.type).toEqual("m.login.token");
                    expect(req.data.token).toEqual("secretToken");
                }).respond(200, {
                    user_id: "@user:localhost",
                    access_token: "access_token",
                });

                return httpBackend.flush();
            }).then(() => {
                // at this point, MatrixChat should fire onLoadCompleted, which
                // makes index.js reload the app. We're not going to attempt to
                // simulate the reload - just check that things are left in the
                // right state for the reloaded app.

                return loadCompletePromise;
            }).then(() => {
                // check that the localstorage has been set up in such a way that
                // the reloaded app can pick up where we leave off.
                expect(localStorage.getItem('mx_user_id')).toEqual('@user:localhost');
                expect(localStorage.getItem('mx_access_token')).toEqual('access_token');
                expect(localStorage.getItem('mx_hs_url')).toEqual('https://homeserver');
                expect(localStorage.getItem('mx_is_url')).toEqual('https://idserver');
            }).done(done, done);
        });
    });
});

// assert that we are on the loading page
function assertAtLoadingSpinner(matrixChat) {
    var domComponent = ReactDOM.findDOMNode(matrixChat);
    expect(domComponent.className).toEqual("mx_MatrixChat_splash");

    // just the spinner
    expect(domComponent.children.length).toEqual(1);
}

// we've got login creds, and are waiting for the sync to finish.
// the page includes a logout link.
function awaitSyncingSpinner(matrixChat, retryLimit, retryCount) {
    if (retryLimit === undefined) {
        retryLimit = 5;
    }
    if (retryCount === undefined) {
        retryCount = 0;
    }

    if (matrixChat.state.loading) {
        console.log(Date.now() + " Awaiting sync spinner: still loading.");
        if (retryCount >= retryLimit) {
            throw new Error("MatrixChat still not loaded after " +
                            retryCount + " tries");
        }
        return q.delay(0).then(() => {
            return awaitSyncingSpinner(matrixChat, retryLimit, retryCount + 1);
        });
    }

    console.log(Date.now() + " Awaiting sync spinner: load complete.");

    // state looks good, check the rendered output
    assertAtSyncingSpinner(matrixChat);
    return q();
}

function assertAtSyncingSpinner(matrixChat) {
    var domComponent = ReactDOM.findDOMNode(matrixChat);
    expect(domComponent.className).toEqual("mx_MatrixChat_splash");

    ReactTestUtils.findRenderedComponentWithType(
        matrixChat, sdk.getComponent('elements.Spinner'));
    var logoutLink = ReactTestUtils.findRenderedDOMComponentWithTag(
        matrixChat, 'a');
    expect(logoutLink.text).toEqual("Logout");
}

function awaitRoomView(matrixChat, retryLimit, retryCount) {
    if (retryLimit === undefined) {
        retryLimit = 5;
    }
    if (retryCount === undefined) {
        retryCount = 0;
    }

    if (!matrixChat.state.ready) {
        console.log(Date.now() + " Awaiting room view: not ready yet.");
        if (retryCount >= retryLimit) {
            throw new Error("MatrixChat still not ready after " +
                            retryCount + " tries");
        }
        return q.delay(0).then(() => {
            return awaitRoomView(matrixChat, retryLimit, retryCount + 1);
        });
    }

    console.log(Date.now() + " Awaiting room view: now ready.");

    // state looks good, check the rendered output
    ReactTestUtils.findRenderedComponentWithType(
        matrixChat, sdk.getComponent('structures.RoomView'));
    return q();
}
