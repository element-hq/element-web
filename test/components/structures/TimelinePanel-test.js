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

var React = require('react');
var ReactDOM = require('react-dom');
var ReactTestUtils = require('react-addons-test-utils');
var expect = require('expect');
var q = require('q');
var sinon = require('sinon');

var jssdk = require('matrix-js-sdk');
var EventTimeline = jssdk.EventTimeline;

var sdk = require('matrix-react-sdk');
var TimelinePanel = sdk.getComponent('structures.TimelinePanel');
var peg = require('../../../src/MatrixClientPeg');

var test_utils = require('test-utils');

var ROOM_ID = '!room:localhost';
var USER_ID = '@me:localhost';

describe('TimelinePanel', function() {
    var sandbox;
    var room;
    var client;
    var timeline;
    var parentDiv;

    beforeEach(function() {
        test_utils.beforeEach(this);
        sandbox = test_utils.stubClient(sandbox);

        timeline = new jssdk.EventTimeline(ROOM_ID);
        room = sinon.createStubInstance(jssdk.Room);
        room.getLiveTimeline.returns(timeline);
        room.getPendingEvents.returns([]);

        client = peg.get();
        client.credentials = {userId: USER_ID};

        // create a div of a useful size to put our panel in, and attach it to
        // the document so that we can interact with it properly.
        parentDiv = document.createElement('div');
        parentDiv.style.width = '800px';
        parentDiv.style.height = '600px';
        parentDiv.style.overflow = 'hidden';
        document.body.appendChild(parentDiv);
    });

    afterEach(function() {
        if (parentDiv) {
            document.body.removeChild(parentDiv);
            parentDiv = null;
        }
        sandbox.restore();
    });

    it('should not paginate forever if there are no events', function(done) {
        // start with a handful of events in the timeline, as would happen when
        // joining a room
        var d = Date.now();
        for (var i = 0; i < 3; i++) {
            timeline.addEvent(test_utils.mkMessage(
                {
                    event: true, room: ROOM_ID, user: USER_ID,
                    ts: d+i,
                }
            ));
        }
        timeline.setPaginationToken('tok', EventTimeline.BACKWARDS);

        // back-pagination returns a promise for true, but adds no events
        client.paginateEventTimeline = sinon.spy((tl, opts) => {
            console.log("paginate:", opts);
            expect(opts.backwards).toBe(true);
            return q(true);
        });

        var panel = ReactDOM.render(
            <TimelinePanel room={room}/>,
            parentDiv
        );

        var messagePanel = ReactTestUtils.findRenderedComponentWithType(
            panel, sdk.getComponent('structures.MessagePanel'));

        expect(messagePanel.props.backPaginating).toBe(true);

        // let the first round of pagination finish off
        setTimeout(() => {
            // at this point, the timeline window should have tried to paginate
            // 5 times, and we should have given up paginating
            expect(client.paginateEventTimeline.callCount).toEqual(5);
            expect(messagePanel.props.backPaginating).toBe(false);
            expect(messagePanel.props.suppressFirstDateSeparator).toBe(false);

            // now, if we update the events, there shouldn't be any
            // more requests.
            client.paginateEventTimeline.reset();
            panel.forceUpdate();
            expect(messagePanel.props.backPaginating).toBe(false);
            setTimeout(() => {
                expect(client.paginateEventTimeline.callCount).toEqual(0);
                done();
            }, 0);
        }, 0);
    });
});


