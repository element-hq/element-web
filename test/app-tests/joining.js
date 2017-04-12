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

require('skin-sdk');

var jssdk = require('matrix-js-sdk');

var sdk = require('matrix-react-sdk');
var peg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');
var PageTypes = require('matrix-react-sdk/lib/PageTypes');
var MatrixChat = sdk.getComponent('structures.MatrixChat');
var RoomDirectory = sdk.getComponent('structures.RoomDirectory');
var RoomPreviewBar = sdk.getComponent('rooms.RoomPreviewBar');
var RoomView = sdk.getComponent('structures.RoomView');

var React = require('react');
var ReactDOM = require('react-dom');
var ReactTestUtils = require('react-addons-test-utils');
var expect = require('expect');
var q = require('q');

var test_utils = require('../test-utils');
var MockHttpBackend = require('../mock-request');

var HS_URL='http://localhost';
var IS_URL='http://localhost';
var USER_ID='@me:localhost';
var ACCESS_TOKEN='access_token';

describe('joining a room', function () {
    describe('over federation', function () {
        var parentDiv;
        var httpBackend;
        var matrixChat;

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

        it('should not get stuck at a spinner', function(done) {
            var ROOM_ALIAS = '#alias:localhost';
            var ROOM_ID = '!id:localhost';

            httpBackend.when('PUT', '/presence/'+encodeURIComponent(USER_ID)+'/status')
                .respond(200, {});
            httpBackend.when('GET', '/pushrules').respond(200, {});
            httpBackend.when('POST', '/filter').respond(200, { filter_id: 'fid' });
            httpBackend.when('GET', '/sync').respond(200, {});
            httpBackend.when('POST', '/publicRooms').respond(200, {chunk: []});
            httpBackend.when('GET', '/thirdparty/protocols').respond(200, {});
            httpBackend.when('GET', '/directory/room/'+encodeURIComponent(ROOM_ALIAS)).respond(200, { room_id: ROOM_ID });

            // start with a logged-in client
            localStorage.setItem("mx_hs_url", HS_URL );
            localStorage.setItem("mx_is_url", IS_URL );
            localStorage.setItem("mx_access_token", ACCESS_TOKEN );
            localStorage.setItem("mx_user_id", USER_ID);

            var mc = <MatrixChat config={{}}/>;
            matrixChat = ReactDOM.render(mc, parentDiv);

            // switch to the Directory
            matrixChat._setPage(PageTypes.RoomDirectory);

            var roomView;
            // wait for /sync to happen
            return q.delay(1).then(() => {
                return httpBackend.flush();
            }).then(() => {
                var roomDir = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, RoomDirectory);

                // enter an alias in the input, and simulate enter
                var input = ReactTestUtils.findRenderedDOMComponentWithTag(
                    roomDir, 'input');
                input.value = ROOM_ALIAS;
                ReactTestUtils.Simulate.change(input);
                ReactTestUtils.Simulate.keyUp(input, {key: 'Enter'});

                // that should create a roomview which will start a peek; wait
                // for the peek.
                httpBackend.when('GET', '/rooms/'+encodeURIComponent(ROOM_ID)+"/initialSync")
                    .respond(401, {errcode: 'M_GUEST_ACCESS_FORBIDDEN'});
                return httpBackend.flush();
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();

                // we should now have a roomview, with a preview bar
                roomView = ReactTestUtils.findRenderedComponentWithType(
                    matrixChat, RoomView);

                var previewBar = ReactTestUtils.findRenderedComponentWithType(
                    roomView, RoomPreviewBar);

                var joinLink = ReactTestUtils.findRenderedDOMComponentWithTag(
                    previewBar, 'a');

                ReactTestUtils.Simulate.click(joinLink);

                // that will fire off a request to check our displayname, followed by a
                // join request
                httpBackend.when('GET', '/profile/'+encodeURIComponent(USER_ID))
                    .respond(200, {displayname: 'boris'});
                httpBackend.when('POST', '/join/'+encodeURIComponent(ROOM_ALIAS))
                    .respond(200, {room_id: ROOM_ID});
                return httpBackend.flush();
            }).then(() => {
                // wait for the join request to be made
                return q.delay(1);
            }).then(() => {
                // flush it through
                return httpBackend.flush();
            }).then(() => {
                httpBackend.verifyNoOutstandingExpectation();

                // the roomview should now be loading
                expect(roomView.state.room).toBe(null);
                expect(roomView.state.joining).toBe(true);

                // there should be a spinner
                ReactTestUtils.findRenderedDOMComponentWithClass(
                    roomView, "mx_Spinner");

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
                expect(roomView.state.joining).toBe(false);
            }).done(done, done);
        });
    });
});
