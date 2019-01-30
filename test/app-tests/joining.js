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

/* joining.js: tests for the various paths when joining a room */

import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';
import WebPlatform from '../../src/vector/platform/WebPlatform';

require('skin-sdk');

const jssdk = require('matrix-js-sdk');

const sdk = require('matrix-react-sdk');
const peg = require('matrix-react-sdk/lib/MatrixClientPeg');
const dis = require('matrix-react-sdk/lib/dispatcher');
const PageTypes = require('matrix-react-sdk/lib/PageTypes');
const MatrixChat = sdk.getComponent('structures.MatrixChat');
const RoomDirectory = sdk.getComponent('structures.RoomDirectory');
const RoomPreviewBar = sdk.getComponent('rooms.RoomPreviewBar');
const RoomView = sdk.getComponent('structures.RoomView');

const React = require('react');
const ReactDOM = require('react-dom');
const ReactTestUtils = require('react-addons-test-utils');
const expect = require('expect');
import Promise from 'bluebird';

const test_utils = require('../test-utils');
const MockHttpBackend = require('matrix-mock-request');

const HS_URL='http://localhost';
const IS_URL='http://localhost';
const USER_ID='@me:localhost';
const ACCESS_TOKEN='access_token';

describe('joining a room', function() {
    describe('over federation', function() {
        let parentDiv;
        let httpBackend;
        let matrixChat;

        beforeEach(function() {
            test_utils.beforeEach(this);
            httpBackend = new MockHttpBackend();
            jssdk.request(httpBackend.requestFn);
            parentDiv = document.createElement('div');

            // uncomment this to actually add the div to the UI, to help with
            // debugging (but slow things down)
            // document.body.appendChild(parentDiv);
        });

        afterEach(function() {
            if (parentDiv) {
                ReactDOM.unmountComponentAtNode(parentDiv);
                parentDiv.remove();
                parentDiv = null;
            }
        });

        // TODO: Re-enable test
        // The test is currently disabled because the room directory now resides in a dialog,
        // which is not accessible from the MatrixChat component anymore. Convincing react that
        // the dialog does exist and is under a different tree is incredibly difficult though,
        // so for now the test has been disabled. We should revisit this test when someone has
        // the time to kill to figure this out. Problem area is highlighted within the test.
        xit('should not get stuck at a spinner', function() {
            const ROOM_ALIAS = '#alias:localhost';
            const ROOM_ID = '!id:localhost';

            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });

            // note that we deliberately do *not* set an expectation for a
            // presence update - setting one makes the first httpBackend.flush
            // return before the first /sync arrives.

            // start with a logged-in client
            localStorage.setItem("mx_hs_url", HS_URL );
            localStorage.setItem("mx_is_url", IS_URL );
            localStorage.setItem("mx_access_token", ACCESS_TOKEN );
            localStorage.setItem("mx_user_id", USER_ID);

            PlatformPeg.set(new WebPlatform());

            const mc = (
                <MatrixChat config={{}}
                    makeRegistrationUrl={()=>{throw new Error("unimplemented");}}
                    initialScreenAfterLogin={{
                        screen: 'directory',
                    }}
                />
            );
            matrixChat = ReactDOM.render(mc, parentDiv);

            let roomView;

            // wait for /sync to happen. This may take some time, as the client
            // has to initialise indexeddb.
            console.log("waiting for /sync");
            httpBackend.when('GET', '/sync')
                .respond(200, {});

            return httpBackend.flushAllExpected({
                timeout: 1000,
            }).then(() => {
                // wait for the directory requests
                httpBackend.when('POST', '/publicRooms').respond(200, {chunk: []});
                httpBackend.when('GET', '/thirdparty/protocols').respond(200, {});
                return httpBackend.flushAllExpected();
            }).then(() => {
                console.log(`${Date.now()} App made requests for directory view; switching to a room.`);

                // TODO: Make this look in the right spot for the directory dialog.
                // See the comment block at the top of the test for a bit more information. The short
                // story here is that the RoomDirectory does not exist under matrixChat anymore, or even
                // the parentDiv we have access to. Asking React to find the RoomDirectory as a child of
                // the document results in it complaining that you didn't give it a component tree to
                // search in. When you do get a reference to the component tree based off the document
                // root and ask it to search, it races and can't find the component in time. To top it
                // all off, MatrixReactTestUtils can't find the element in time either even with a very
                // high number of attempts. Assuming we can get a reference to the RoomDirectory in a
                // dialog, the rest of the test should be fine.
                const roomDir = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, RoomDirectory,
                );

                // enter an alias in the input, and simulate enter
                const input = ReactTestUtils.findRenderedDOMComponentWithTag(
                    roomDir, 'input');
                input.value = ROOM_ALIAS;
                ReactTestUtils.Simulate.change(input);
                ReactTestUtils.Simulate.keyUp(input, {key: 'Enter'});

                // that should create a roomview which will start a peek; wait
                // for the peek.
                httpBackend.when('GET', '/directory/room/'+encodeURIComponent(ROOM_ALIAS)).respond(200, { room_id: ROOM_ID });
                httpBackend.when('GET', '/rooms/'+encodeURIComponent(ROOM_ID)+"/initialSync")
                    .respond(401, {errcode: 'M_GUEST_ACCESS_FORBIDDEN'});

                return httpBackend.flushAllExpected();
            }).then(() => {
                console.log(`${Date.now()} App made room preview request`);

                // we should now have a roomview
                roomView = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, RoomView);

                // the preview bar may take a tick to be displayed
                return Promise.delay(1);
            }).then(() => {
                const previewBar = ReactTestUtils.findRenderedComponentWithType(
                    roomView, RoomPreviewBar);

                const joinLink = ReactTestUtils.findRenderedDOMComponentWithTag(
                    previewBar, 'a');

                ReactTestUtils.Simulate.click(joinLink);

                httpBackend.when('POST', '/join/'+encodeURIComponent(ROOM_ALIAS))
                    .respond(200, {room_id: ROOM_ID});
            }).then(() => {
                // wait for the join request to be made
                return Promise.delay(1);
            }).then(() => {
                // and again, because the state update has to go to the store and
                // then one dispatch within the store, then to the view
                // XXX: This is *super flaky*: a better way would be to declare
                // that we expect a certain state transition to happen, then wait
                // for that transition to occur.
                return Promise.delay(1);
            }).then(() => {
                // the roomview should now be loading
                expect(roomView.state.room).toBe(null);
                expect(roomView.state.joining).toBe(true);

                // there should be a spinner
                ReactTestUtils.findRenderedDOMComponentWithClass(
                    roomView, "mx_Spinner");

                // flush it through
                return httpBackend.flush('/join/'+encodeURIComponent(ROOM_ALIAS));
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();

                return Promise.delay(1);
            }).then(() => {
                // NB. we don't expect the 'joining' flag to reset at any point:
                // it will stay set and we observe whether we have Room object for
                // the room and whether our member event shows we're joined.

                // now send the room down the /sync pipe
                httpBackend.when('GET', '/sync').
                    respond(200, {
                        rooms: {
                            join: {
                                [ROOM_ID]: {
                                    state: {},
                                    timeline: {
                                        events: [],
                                        limited: true,
                                    },
                                },
                            },
                        },
                    });
                return httpBackend.flush();
            }).then(() => {
                // now the room should have loaded
                expect(roomView.state.room).toExist();
            });
        });
    });
});
