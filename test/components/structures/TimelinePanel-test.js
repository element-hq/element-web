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

    function mkMessage() {
        return test_utils.mkMessage(
            {
                event: true, room: ROOM_ID, user: USER_ID,
                ts: Date.now(),
            });
    }

    function scryEventTiles(panel) {
        return ReactTestUtils.scryRenderedComponentsWithType(
            panel, sdk.getComponent('rooms.EventTile'));
    };

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
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }
        sandbox.restore();
    });

    it('should load new events even if you are scrolled up', function(done) {
        // this is https://github.com/vector-im/vector-web/issues/1367

        // enough events to allow us to scroll back
        var N_EVENTS = 20;
        for (var i = 0; i < N_EVENTS; i++) {
            timeline.addEvent(mkMessage());
        }

        var scrollDefer;
        var panel = ReactDOM.render(
                <TimelinePanel room={room} onScroll={() => {scrollDefer.resolve()}}
                />,
                parentDiv,
        );
        var scrollingDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
            panel, "gm-scroll-view");

        // helper function which will return a promise which resolves when the
        // panel isn't paginating
        var awaitPaginationCompletion = function() {
            if(!panel.state.forwardPaginating)
                return q();
            else
                return q.delay(0).then(awaitPaginationCompletion);
        };

        // helper function which will return a promise which resolves when
        // the TimelinePanel fires a scroll event
        var awaitScroll = function() {
            scrollDefer = q.defer();
            return scrollDefer.promise;
        };

        // wait for the panel to load - we'll get a scroll event once it
        // happens
        awaitScroll().then(() => {
            expect(panel.state.canBackPaginate).toBe(false);
            expect(scryEventTiles(panel).length).toEqual(N_EVENTS);

            // scroll up
            console.log("setting scrollTop = 0");
            scrollingDiv.scrollTop = 0;

            // wait for the scroll event to land
        }).then(awaitScroll).then(() => {
            // there should be no pagination going on now
            expect(panel.state.backPaginating).toBe(false);
            expect(panel.state.forwardPaginating).toBe(false);
            expect(panel.state.canBackPaginate).toBe(false);
            expect(panel.state.canForwardPaginate).toBe(false);
            expect(panel.isAtEndOfLiveTimeline()).toBe(false);
            expect(scrollingDiv.scrollTop).toEqual(0);

            console.log("adding event");

            // a new event!
            var ev = mkMessage();
            timeline.addEvent(ev);
            panel.onRoomTimeline(ev, room, false, false, {liveEvent: true});

            // that won't make much difference, because we don't paginate
            // unless we're at the bottom of the timeline, but a scroll event
            // should be enough to set off a pagination.
            expect(scryEventTiles(panel).length).toEqual(N_EVENTS);

            scrollingDiv.scrollTop = 10;
        }).delay(0).then(awaitPaginationCompletion).then(() => {
            expect(scryEventTiles(panel).length).toEqual(N_EVENTS+1);
        }).done(done, done);
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

    it("should let you scroll down again after you've scrolled up", function(done) {
        var N_EVENTS = 600;

        // sadly, loading all those events takes a while
        this.timeout(N_EVENTS * 30);

        // client.getRoom is called a /lot/ in this test, so replace
        // sinon's spy with a fast noop.
        client.getRoom = function(id) { return null; };

        // fill the timeline with lots of events
        for (var i = 0; i < N_EVENTS; i++) {
            timeline.addEvent(mkMessage());
        }
        console.log("added events to timeline");

        var scrollDefer;
        var panel = ReactDOM.render(
            <TimelinePanel room={room} onScroll={() => {scrollDefer.resolve()}} />,
            parentDiv
        );
        console.log("TimelinePanel rendered");

        var messagePanel = ReactTestUtils.findRenderedComponentWithType(
            panel, sdk.getComponent('structures.MessagePanel'));
        var scrollingDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
            panel, "gm-scroll-view");

        // helper function which will return a promise which resolves when
        // the TimelinePanel fires a scroll event
        var awaitScroll = function() {
            scrollDefer = q.defer();
            return scrollDefer.promise.then(() => {
                console.log("got scroll event; scrollTop now " +
                            scrollingDiv.scrollTop);
            });
        };

        function setScrollTop(scrollTop) {
            const before = scrollingDiv.scrollTop;
            scrollingDiv.scrollTop = scrollTop;
            console.log("setScrollTop: before update: " + before +
                        "; assigned: " + scrollTop +
                        "; after update: " + scrollingDiv.scrollTop);
        }

        function backPaginate() {
            console.log("back paginating...");
            setScrollTop(0);
            return awaitScroll().then(() => {
                if(scrollingDiv.scrollTop > 0) {
                    // need to go further
                    return backPaginate();
                }
                console.log("paginated to start.");

                // hopefully, we got to the start of the timeline
                expect(messagePanel.props.backPaginating).toBe(false);
            });
        }

        // let the first round of pagination finish off
        awaitScroll().then(() => {
            // we should now have loaded the first few events
            expect(messagePanel.props.backPaginating).toBe(false);
            expect(messagePanel.props.suppressFirstDateSeparator).toBe(true);

            // back-paginate until we hit the start
            return backPaginate();
        }).then(() => {
            expect(messagePanel.props.suppressFirstDateSeparator).toBe(false);
            var events = scryEventTiles(panel);
            expect(events[0].props.mxEvent).toBe(timeline.getEvents()[0])

            // we should now be able to scroll down, and paginate in the other
            // direction.
            setScrollTop(scrollingDiv.scrollHeight);
            scrollingDiv.scrollTop = scrollingDiv.scrollHeight;
            return awaitScroll();
        }).then(() => {
            console.log("done");
        }).done(done, done);
    });
});
