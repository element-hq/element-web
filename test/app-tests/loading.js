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


describe('loading:', function () {
    let parentDiv;
    let httpBackend;

    // an Object simulating the window.location
    let windowLocation;

    beforeEach(function() {
        test_utils.beforeEach(this);
        httpBackend = new MockHttpBackend();
        jssdk.request(httpBackend.requestFn);
        parentDiv = document.createElement('div');

        // uncomment this to actually add the div to the UI, to help with
        // debugging (but slow things down)
        // document.body.appendChild(parentDiv);

        windowLocation = null;

        window.localStorage.clear();
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
    function loadApp(uriFragment) {
        windowLocation = {
            search: "",
            hash: uriFragment,
            toString: function() { return this.search + this.hash; },
        };

        let lastLoadedScreen = null;
        let appLoaded = false;
        function onNewScreen(screen) {
            console.log("newscreen "+screen);
            if (!appLoaded) {
                lastLoadedScreen = screen;
            } else {
                var hash = '#/' + screen;
                windowLocation.hash = hash;
                console.log("browser URI now "+ windowLocation);
            }
        }

        const MatrixChat = sdk.getComponent('structures.MatrixChat');
        const fragParts = parseQsFromFragment(windowLocation);
        const matrixChat = ReactDOM.render(
            <MatrixChat
                onNewScreen={onNewScreen}
                config={{}}
                startingQueryParams={fragParts.params}
                enableGuest={true}
            />, parentDiv
        );

        function routeUrl(location, matrixChat) {
            console.log("Routing URL "+location);
            var params = parseQs(location);
            var loginToken = params.loginToken;
            if (loginToken) {
                matrixChat.showScreen('token_login', params);
                return;
            }

            var fragparts = parseQsFromFragment(location);
            matrixChat.showScreen(fragparts.location.substring(1),
                                  fragparts.params);
        }

        // pause for a cycle, then simulate the window.onload handler
        q.delay(0).then(() => {
            console.log("simulating window.onload");
            routeUrl(windowLocation, matrixChat);
            appLoaded = true;
            if (lastLoadedScreen) {
                onNewScreen(lastLoadedScreen);
                lastLoadedScreen = null;
            }
        }).done();

        return matrixChat;
    }

    describe("Clean load with no stored credentials:", function() {
        it('gives a login panel by default', function (done) {
            let matrixChat = loadApp("");

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // we expect a single <Login> component
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.login.Login'));
                expect(windowLocation.hash).toEqual("");
            }).done(done, done);
        });

        it('should follow the original link after successful login', function(done) {
            let matrixChat = loadApp("#/room/!room:id");

            q.delay(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // we expect a single <Login> component
                let login = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.login.Login'));
                httpBackend.when('POST', '/login').check(function(req) {
                    expect(req.data.type).toEqual('m.login.password');
                    expect(req.data.user).toEqual('user');
                    expect(req.data.password).toEqual('pass');
                }).respond(200, { user_id: 'user_id' });
                login.onPasswordLogin("user", "pass")
                return httpBackend.flush();
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
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomView'));
                expect(windowLocation.hash).toEqual("#/room/!room:id");
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

            let matrixChat = loadApp("");

            q.delay(1).then(() => {
                // we expect a spinner
                assertAtSyncingSpinner(matrixChat);

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

            let matrixChat = loadApp("#/room/!room:id");

            q.delay(1).then(() => {
                // we expect a spinner
                assertAtSyncingSpinner(matrixChat);

                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a room view
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomView'));
                expect(windowLocation.hash).toEqual("#/room/!room:id");
            }).done(done, done);

        });
    });

    describe('Guest auto-registration:', function() {
        it('shows a directory by default', function (done) {
            let matrixChat = loadApp("");

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
                // now we should have a spinner with a logout link
                assertAtSyncingSpinner(matrixChat);

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

        it('shows a room view if we followed a room link', function(done) {
            let matrixChat = loadApp("#/room/!room:id");
            q.delay(10).then(() => {
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
                // now we should have a spinner with a logout link
                assertAtSyncingSpinner(matrixChat);

                httpBackend.when('GET', '/sync').respond(200, {});
                return httpBackend.flush();
            }).then(() => {
                // once the sync completes, we should have a room view
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.RoomView'));
                expect(windowLocation.hash).toEqual("#/room/!room:id");
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
function assertAtSyncingSpinner(matrixChat) {
    var domComponent = ReactDOM.findDOMNode(matrixChat);
    expect(domComponent.className).toEqual("mx_MatrixChat_splash");

    ReactTestUtils.findRenderedComponentWithType(
        matrixChat, sdk.getComponent('elements.Spinner'));
    var logoutLink = ReactTestUtils.findRenderedDOMComponentWithTag(
        matrixChat, 'a');
    expect(logoutLink.text).toEqual("Logout");
}
