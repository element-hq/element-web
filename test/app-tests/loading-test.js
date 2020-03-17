/*
Copyright 2016 OpenMarket Ltd
Copyright 2020 New Vector Ltd

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

import PlatformPeg from 'matrix-react-sdk/src/PlatformPeg';
import WebPlatform from '../../src/vector/platform/WebPlatform';
import '../skin-sdk';
import "../jest-mocks";
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import MatrixReactTestUtils from 'matrix-react-test-utils';
import * as jssdk from 'matrix-js-sdk';
import * as sdk from 'matrix-react-sdk';
import {MatrixClientPeg} from 'matrix-react-sdk/src/MatrixClientPeg';
import {VIEWS} from 'matrix-react-sdk/src/components/structures/MatrixChat';
import dis from 'matrix-react-sdk/src/dispatcher';
import * as test_utils from '../test-utils';
import MockHttpBackend from 'matrix-mock-request';
import {parseQs, parseQsFromFragment} from '../../src/vector/url_utils';
import {makeType} from "matrix-react-sdk/src/utils/TypeUtils";
import {ValidatedServerConfig} from "matrix-react-sdk/src/utils/AutoDiscoveryUtils";
import {sleep} from "../test-utils";
import "fake-indexeddb/auto";
import {cleanLocalstorage} from "../test-utils";
import {IndexedDBCryptoStore} from "matrix-js-sdk/src/crypto/store/indexeddb-crypto-store";

const DEFAULT_HS_URL='http://my_server';
const DEFAULT_IS_URL='http://my_is';

describe('loading:', function() {
    let parentDiv;
    let httpBackend;

    // an Object simulating the window.location
    let windowLocation;

    // the mounted MatrixChat
    let matrixChat;

    // a promise which resolves when the MatrixChat calls onTokenLoginCompleted
    let tokenLoginCompletePromise;

    beforeEach(function() {
        httpBackend = new MockHttpBackend();
        jssdk.request(httpBackend.requestFn);
        parentDiv = document.createElement('div');

        // uncomment this to actually add the div to the UI, to help with
        // debugging (but slow things down)
        // document.body.appendChild(parentDiv);

        windowLocation = null;
        matrixChat = null;
    });

    afterEach(async function() {
        console.log(`${Date.now()}: loading: afterEach`);
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }

        // unmounting should have cleared the MatrixClientPeg
        expect(MatrixClientPeg.get()).toBe(null);

        // clear the indexeddbs so we can start from a clean slate next time.
        await Promise.all([
            test_utils.deleteIndexedDB('matrix-js-sdk:crypto'),
            test_utils.deleteIndexedDB('matrix-js-sdk:riot-web-sync'),
        ]);
        cleanLocalstorage();
        console.log(`${Date.now()}: loading: afterEach complete`);
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

        function onNewScreen(screen) {
            console.log(Date.now() + " newscreen "+screen);
            const hash = '#/' + screen;
            windowLocation.hash = hash;
            console.log(Date.now() + " browser URI now "+ windowLocation);
        }

        // Parse the given window.location and return parameters that can be used when calling
        // MatrixChat.showScreen(screen, params)
        function getScreenFromLocation(location) {
            const fragparts = parseQsFromFragment(location);
            return {
                screen: fragparts.location.substring(1),
                params: fragparts.params,
            };
        }

        const MatrixChat = sdk.getComponent('structures.MatrixChat');
        const fragParts = parseQsFromFragment(windowLocation);

        const config = Object.assign({
            default_hs_url: DEFAULT_HS_URL,
            default_is_url: DEFAULT_IS_URL,
            validated_server_config: makeType(ValidatedServerConfig, {
                hsUrl: DEFAULT_HS_URL,
                hsName: "TEST_ENVIRONMENT",
                hsNameIsDifferent: false, // yes, we lie
                isUrl: DEFAULT_IS_URL,
            }),
            embeddedPages: {
                homeUrl: 'data:text/html;charset=utf-8;base64,PGh0bWw+PC9odG1sPg==',
            },
        }, opts.config || {});

        PlatformPeg.set(new WebPlatform());

        const params = parseQs(windowLocation);

        tokenLoginCompletePromise = new Promise(resolve => {
            matrixChat = ReactDOM.render(
                <MatrixChat
                    onNewScreen={onNewScreen}
                    config={config}
                    serverConfig={config.validated_server_config}
                    realQueryParams={params}
                    startingFragmentQueryParams={fragParts.params}
                    enableGuest={true}
                    onTokenLoginCompleted={resolve}
                    initialScreenAfterLogin={getScreenFromLocation(windowLocation)}
                    makeRegistrationUrl={() => {throw new Error('Not implemented');}}
                />, parentDiv,
            );
        });
    }

    // set an expectation that we will get a call to /sync, then flush
    // http requests until we do.
    //
    // returns a promise resolving to the received request
    async function expectAndAwaitSync(opts) {
        let syncRequest = null;
        const isGuest = opts && opts.isGuest;
        if (!isGuest) {
            httpBackend.when('GET', '/_matrix/client/versions')
                .respond(200, {
                    "versions": ["r0.3.0"],
                    "unstable_features": {
                        "m.lazy_load_members": true
                    }
                });
            // the call to create the LL filter
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'llfid' });
        }
        httpBackend.when('GET', '/sync')
            .check((r) => {syncRequest = r;})
            .respond(200, {});

        for (let attempts = 10; attempts > 0; attempts--) {
            console.log(Date.now() + " waiting for /sync");
            if (syncRequest) {
                return syncRequest;
            }
            await httpBackend.flush();
        }
        throw new Error("Gave up waiting for /sync");
    }

    describe("Clean load with no stored credentials:", function() {
        it('gives a welcome page by default', function() {
            loadApp();

            return sleep(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // Wait for another trip around the event loop for the UI to update
                return awaitWelcomeComponent(matrixChat);
            }).then(() => {
                expect(windowLocation.hash).toEqual("#/welcome");
            });
        });

        it('should follow the original link after successful login', function() {
            loadApp({
                uriFragment: "#/room/!room:id",
            });

            // Pass the liveliness checks
            httpBackend.when("GET", "/versions").respond(200, {versions: ["r0.4.0"]});
            httpBackend.when("GET", "/api/v1").respond(200, {});

            return sleep(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(403, "Guest access is disabled");

                return httpBackend.flush();
            }).then(() => {
                // Wait for another trip around the event loop for the UI to update
                return sleep(10);
            }).then(() => {
                return moveFromWelcomeToLogin(matrixChat);
            }).then(() => {
                return completeLogin(matrixChat);
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
            });
        });

        it('should not register as a guest when using a #/login link', function() {
            loadApp({
                uriFragment: "#/login",
            });

            // Pass the liveliness checks
            httpBackend.when("GET", "/versions").respond(200, {versions: ["r0.4.0"]});
            httpBackend.when("GET", "/api/v1").respond(200, {});

            return awaitLoginComponent(matrixChat).then(() => {
                // we expect a single <Login> component
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.auth.Login'));

                // the only outstanding request should be a GET /login
                // (in particular there should be no /register request for
                // guest registration).
                const allowedRequests = [
                    "/_matrix/client/r0/login",
                    "/versions",
                    "/api/v1",
                ];
                for (const req of httpBackend.requests) {
                    if (req.method === 'GET' && allowedRequests.find(p => req.path.endsWith(p))) {
                        continue;
                    }

                    throw new Error(`Unexpected HTTP request to ${req}`);
                }
                return completeLogin(matrixChat);
            }).then(() => {
                // once the sync completes, we should have a room view
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.EmbeddedPage'));
                expect(windowLocation.hash).toEqual("#/home");
            });
        });
    });

    describe("MatrixClient rehydrated from stored credentials:", function() {
        beforeEach(async function() {
            localStorage.setItem("mx_hs_url", "http://localhost" );
            localStorage.setItem("mx_is_url", "http://localhost" );
            localStorage.setItem("mx_access_token", "access_token");
            localStorage.setItem("mx_user_id", "@me:localhost");
            localStorage.setItem("mx_last_room_id", "!last_room:id");

            // Create a crypto store as well to satisfy storage consistency checks
            const cryptoStore = new IndexedDBCryptoStore(
                indexedDB,
                "matrix-js-sdk:crypto",
            );
            await cryptoStore.startup();
        });

        it('shows the last known room by default', function() {
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });

            loadApp();

            return awaitLoggedIn(matrixChat).then(() => {
                // we are logged in - let the sync complete
                return expectAndAwaitSync();
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!last_room:id");
            });
        });

        it('shows a home page by default if we have no joined rooms', function() {
            localStorage.removeItem("mx_last_room_id");

            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });

            loadApp();

            return awaitLoggedIn(matrixChat).then(() => {
                // we are logged in - let the sync complete
                return expectAndAwaitSync();
            }).then(() => {
                // once the sync completes, we should have a home page
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.EmbeddedPage'));
                expect(windowLocation.hash).toEqual("#/home");
            });
        });

        it('shows a room view if we followed a room link', function() {
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });

            loadApp({
                uriFragment: "#/room/!room:id",
            });

            return awaitLoggedIn(matrixChat).then(() => {
                // we are logged in - let the sync complete
                return expectAndAwaitSync();
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!room:id");
            });
        });

        describe('/#/login link:', function() {
            beforeEach(function() {
                loadApp({
                    uriFragment: "#/login",
                });

                // give the UI a chance to display
                return awaitLoginComponent(matrixChat);
            });

            it('shows a login view', function() {
                // Pass the liveliness checks
                httpBackend.when("GET", "/versions").respond(200, {versions: ["r0.4.0"]});
                httpBackend.when("GET", "/api/v1").respond(200, {});

                // we expect a single <Login> component
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.auth.Login'),
                );

                // the only outstanding request should be a GET /login
                // (in particular there should be no /register request for
                // guest registration, nor /sync, etc).
                const allowedRequests = [
                    "/_matrix/client/r0/login",
                    "/versions",
                    "/api/v1",
                ];
                for (const req of httpBackend.requests) {
                    if (req.method === 'GET' && allowedRequests.find(p => req.path.endsWith(p))) {
                        continue;
                    }

                    throw new Error(`Unexpected HTTP request to ${req}`);
                }
            });

            it('shows the homepage after login', function() {
                // Pass the liveliness checks
                httpBackend.when("GET", "/versions").respond(200, {versions: ["r0.4.0"]});
                httpBackend.when("GET", "/api/v1").respond(200, {});

                return completeLogin(matrixChat).then(() => {
                    // we should see a home page, even though we previously had
                    // a stored mx_last_room_id
                    ReactTestUtils.findRenderedComponentWithType(
                        matrixChat, sdk.getComponent('structures.EmbeddedPage'));
                    expect(windowLocation.hash).toEqual("#/home");
                });
            });
        });
    });

    describe('Guest auto-registration:', function() {
        it('shows a welcome page by default', function() {
            loadApp();

            return sleep(1).then(() => {
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
                return awaitLoggedIn(matrixChat);
            }).then(() => {
                // we are logged in - let the sync complete
                return expectAndAwaitSync({isGuest: true});
            }).then(() => {
                // once the sync completes, we should have a welcome page
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('auth.Welcome'));
                expect(windowLocation.hash).toEqual("#/welcome");
            });
        });

        it('uses the default homeserver to register with', function() {
            loadApp();

            return sleep(1).then(() => {
                // at this point, we're trying to do a guest registration;
                // we expect a spinner
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.path.startsWith(DEFAULT_HS_URL)).toBe(true);
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(200, {
                    user_id: "@guest:localhost",
                    access_token: "secret_token",
                });

                return httpBackend.flush();
            }).then(() => {
                return awaitLoggedIn(matrixChat);
            }).then(() => {
                return expectAndAwaitSync({isGuest: true});
            }).then((req) => {
                expect(req.path.startsWith(DEFAULT_HS_URL)).toBe(true);

                // once the sync completes, we should have a welcome page
                httpBackend.verifyNoOutstandingExpectation();
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('auth.Welcome'));
                expect(windowLocation.hash).toEqual("#/welcome");
                expect(MatrixClientPeg.get().baseUrl).toEqual(DEFAULT_HS_URL);
                expect(MatrixClientPeg.get().idBaseUrl).toEqual(DEFAULT_IS_URL);
            });
        });

        it('shows a room view if we followed a room link', function() {
            loadApp({
                uriFragment: "#/room/!room:id",
            });
            return sleep(1).then(() => {
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
                return awaitLoggedIn(matrixChat);
            }).then(() => {
                return expectAndAwaitSync({isGuest: true});
            }).then(() => {
                // once the sync completes, we should have a room view
                return awaitRoomView(matrixChat);
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();
                expect(windowLocation.hash).toEqual("#/room/!room:id");
            });
        });

        describe('Login as user', function() {
            beforeEach(function() {
                // first we have to load the homepage
                loadApp();

                httpBackend.when('POST', '/register').check(function(req) {
                    expect(req.queryParams.kind).toEqual('guest');
                }).respond(200, {
                    user_id: "@guest:localhost",
                    access_token: "secret_token",
                });

                return httpBackend.flush().then(() => {
                    return awaitLoggedIn(matrixChat);
                }).then(() => {
                    // we got a sync spinner - let the sync complete
                    return expectAndAwaitSync();
                }).then(() => {
                    // once the sync completes, we should have a home page
                    ReactTestUtils.findRenderedComponentWithType(
                        matrixChat, sdk.getComponent('structures.EmbeddedPage'));

                    // we simulate a click on the 'login' button by firing off
                    // the relevant dispatch.
                    //
                    // XXX: is it an anti-pattern to access the react-sdk's
                    // dispatcher in this way? Is it better to find the login
                    // button and simulate a click? (we might have to arrange
                    // for it to be shown - it's not always, due to the
                    // collapsing left panel

                    dis.dispatch({ action: 'start_login' });

                    return awaitLoginComponent(matrixChat);
                });
            });

            it('should give us a login page', function() {
                expect(windowLocation.hash).toEqual("#/login");

                // we expect a single <Login> component
                ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.auth.Login'),
                );
            });

            /*
            // ILAG renders this obsolete. I think.
            it('should allow us to return to the app', function() {
                const login = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, sdk.getComponent('structures.auth.Login')
                );

                const linkText = 'Return to app';

                const returnToApp = ReactTestUtils.scryRenderedDOMComponentsWithTag(
                    login, 'a').find((e) => e.innerText === linkText);

                if (!returnToApp) {
                    throw new Error(`Couldn't find '${linkText}' link`);
                }

                ReactTestUtils.Simulate.click(returnToApp);

                return sleep(1).then(() => {
                    // we should be straight back into the home page
                    ReactTestUtils.findRenderedComponentWithType(
                        matrixChat, sdk.getComponent('structures.EmbeddedPage'));
                });
            });
            */
        });
    });

    describe('Token login:', function() {
        it('logs in successfully', function() {
            loadApp({
                queryString: "?loginToken=secretToken&homeserver=https%3A%2F%2Fhomeserver&identityServer=https%3A%2F%2Fidserver",
            });

            return sleep(1).then(() => {
                // we expect a spinner while we're logging in
                assertAtLoadingSpinner(matrixChat);

                httpBackend.when('POST', '/login').check(function(req) {
                    expect(req.path).toMatch(new RegExp("^https://homeserver/"));
                    expect(req.data.type).toEqual("m.login.token");
                    expect(req.data.token).toEqual("secretToken");
                }).respond(200, {
                    user_id: "@user:localhost",
                    device_id: 'DEVICE_ID',
                    access_token: "access_token",
                });

                return httpBackend.flush();
            }).then(() => {
                // at this point, MatrixChat should fire onTokenLoginCompleted, which
                // makes index.js reload the app. We're not going to attempt to
                // simulate the reload - just check that things are left in the
                // right state for the reloaded app.

                return tokenLoginCompletePromise;
            }).then(() => {
                // check that the localstorage has been set up in such a way that
                // the reloaded app can pick up where we leave off.
                expect(localStorage.getItem('mx_user_id')).toEqual('@user:localhost');
                expect(localStorage.getItem('mx_access_token')).toEqual('access_token');
                expect(localStorage.getItem('mx_hs_url')).toEqual('https://homeserver');
                expect(localStorage.getItem('mx_is_url')).toEqual('https://idserver');
            });
        });
    });

    // check that we have a Login component, send a 'user:pass' login,
    // and await the HTTP requests.
    async function completeLogin(matrixChat) {
        // we expect a single <Login> component
        const login = ReactTestUtils.findRenderedComponentWithType(
            matrixChat, sdk.getComponent('structures.auth.Login'));

        // When we switch to the login component, it'll hit the login endpoint
        // for proof of life and to get flows. We'll only give it one option.
        httpBackend.when('GET', '/login')
            .respond(200, {"flows": [{"type": "m.login.password"}]});
        httpBackend.flush(); // We already would have tried the GET /login request

        // Give the component some time to finish processing the login flows before
        // continuing.
        await sleep(100);

        httpBackend.when('POST', '/login').check(function(req) {
            expect(req.data.type).toEqual('m.login.password');
            expect(req.data.identifier.type).toEqual('m.id.user');
            expect(req.data.identifier.user).toEqual('user');
            expect(req.data.password).toEqual('pass');
        }).respond(200, {
            user_id: '@user:id',
            device_id: 'DEVICE_ID',
            access_token: 'access_token',
        });
        login.onPasswordLogin("user", undefined, undefined, "pass");

        return httpBackend.flush().then(() => {
            // Wait for another trip around the event loop for the UI to update
            return sleep(1);
        }).then(() => {
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });
            return expectAndAwaitSync().catch((e) => {
                throw new Error("Never got /sync after login: did the client start?");
            });
        }).then(() => {
            httpBackend.verifyNoOutstandingExpectation();
        });
    }
});

// assert that we are on the loading page
function assertAtLoadingSpinner(matrixChat) {
    const domComponent = ReactDOM.findDOMNode(matrixChat);
    expect(domComponent.className).toEqual("mx_MatrixChat_splash");

    // just the spinner
    expect(domComponent.children.length).toEqual(1);
}

function awaitLoggedIn(matrixChat) {
    if (matrixChat.state.view === VIEWS.LOGGED_IN) {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        const onAction = ({ action }) => {
            if (action !== "on_logged_in") {
                return;
            }
            console.log(Date.now() + ": Received on_logged_in action");
            dis.unregister(dispatcherRef);
            resolve();
        };
        const dispatcherRef = dis.register(onAction);
        console.log(Date.now() + ": Waiting for on_logged_in action");
    });
}

function awaitRoomView(matrixChat, retryLimit, retryCount) {
    if (retryLimit === undefined) {
        retryLimit = 5;
    }
    if (retryCount === undefined) {
        retryCount = 0;
    }

    if (matrixChat.state.view !== VIEWS.LOGGED_IN || !matrixChat.state.ready) {
        console.log(Date.now() + " Awaiting room view: not ready yet.");
        if (retryCount >= retryLimit) {
            throw new Error("MatrixChat still not ready after " +
                            retryCount + " tries");
        }
        return sleep(0).then(() => {
            return awaitRoomView(matrixChat, retryLimit, retryCount + 1);
        });
    }

    console.log(Date.now() + " Awaiting room view: now ready.");

    // state looks good, check the rendered output
    ReactTestUtils.findRenderedComponentWithType(
        matrixChat, sdk.getComponent('structures.RoomView'));
    return Promise.resolve();
}

function awaitLoginComponent(matrixChat, attempts) {
    return MatrixReactTestUtils.waitForRenderedComponentWithType(
        matrixChat, sdk.getComponent('structures.auth.Login'), attempts,
    );
}

function awaitWelcomeComponent(matrixChat, attempts) {
    return MatrixReactTestUtils.waitForRenderedComponentWithType(
        matrixChat, sdk.getComponent('auth.Welcome'), attempts,
    );
}

function moveFromWelcomeToLogin(matrixChat) {
    ReactTestUtils.findRenderedComponentWithType(
        matrixChat, sdk.getComponent('auth.Welcome'));
    dis.dispatch({ action: 'start_login' });
    return awaitLoginComponent(matrixChat);
}
