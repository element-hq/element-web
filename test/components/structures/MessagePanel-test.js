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
var ReactDOM = require("react-dom");
var TestUtils = require('react-addons-test-utils');
var expect = require('expect');

var sdk = require('matrix-react-sdk');

var MessagePanel = sdk.getComponent('structures.MessagePanel');

var test_utils = require('test-utils');
var mockclock = require('mock-clock');

describe('MessagePanel', function () {
    var sandbox;
    var clock = mockclock.clock();
    var realSetTimeout = window.setTimeout;
    var events = mkEvents();

    beforeEach(function() {
        test_utils.beforeEach(this);
        sandbox = test_utils.stubClient(sandbox);
    });

    afterEach(function () {
        clock.uninstall();
        sandbox.restore();
    });

    function mkEvents() {
        var events = [];
        var ts0 = Date.now();
        for (var i = 0; i < 10; i++) {
            events.push(test_utils.mkMessage(
                {
                    event: true, room: "!room:id", user: "@user:id",
                    ts: ts0 + i*1000,
                }));
        }
        return events;
    }

    it('should show the events', function() {
        var res = TestUtils.renderIntoDocument(
                <MessagePanel events={events} />
        );

        // just check we have the right number of tiles for now
        var tiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('rooms.EventTile'));
        expect(tiles.length).toEqual(10);
    });

    it('should show the read-marker in the right place', function() {
        var res = TestUtils.renderIntoDocument(
                <MessagePanel events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true} />
        );

        var tiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('rooms.EventTile'));

        // find the <li> which wraps the read marker
        var rm = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_RoomView_myReadMarker_container');

        // it should follow the <li> which wraps the event tile for event 4
        var eventContainer = ReactDOM.findDOMNode(tiles[4]).parentNode;
        expect(rm.previousSibling).toEqual(eventContainer);
    });

    it('shows a ghost read-marker when the read-marker moves', function(done) {
        // fake the clock so that we can test the velocity animation.
        clock.install();
        clock.mockDate();

        var parentDiv = document.createElement('div');

        // first render with the RM in one place
        var mp = ReactDOM.render(
                <MessagePanel events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true} 
                />, parentDiv);

        var tiles = TestUtils.scryRenderedComponentsWithType(
            mp, sdk.getComponent('rooms.EventTile'));
        var tileContainers = tiles.map(function (t) {
            return ReactDOM.findDOMNode(t).parentNode;
        });

        // find the <li> which wraps the read marker
        var rm = TestUtils.findRenderedDOMComponentWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(rm.previousSibling).toEqual(tileContainers[4]);

        // now move the RM
        mp = ReactDOM.render(
                <MessagePanel events={events} readMarkerEventId={events[6].getId()}
                    readMarkerVisible={true} 
                />, parentDiv);

        // now there should be two RM containers
        var found = TestUtils.scryRenderedDOMComponentsWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(found.length).toEqual(2);
        
        // the first should be the ghost
        expect(found[0].previousSibling).toEqual(tileContainers[4]);
        var hr = found[0].children[0];

        // the second should be the real thing
        expect(found[1].previousSibling).toEqual(tileContainers[6]);

        // advance the clock, and then let the browser run an animation frame,
        // to let the animation start
        clock.tick(1500);
        
        realSetTimeout(() => {
            // then advance it again to let it complete
            clock.tick(1000);
            realSetTimeout(() => {
                // the ghost should now have finished
                expect(hr.style.opacity).toEqual('0');
                done();
            }, 100);
        }, 100);
    });

    it('shows only one ghost when the RM moves twice', function() {
        var parentDiv = document.createElement('div');

        // first render with the RM in one place
        var mp = ReactDOM.render(
                <MessagePanel events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        var tiles = TestUtils.scryRenderedComponentsWithType(
            mp, sdk.getComponent('rooms.EventTile'));
        var tileContainers = tiles.map(function (t) {
            return ReactDOM.findDOMNode(t).parentNode;
        });

        // now move the RM
        mp = ReactDOM.render(
                <MessagePanel events={events} readMarkerEventId={events[6].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        // now there should be two RM containers
        var found = TestUtils.scryRenderedDOMComponentsWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(found.length).toEqual(2);

        // the first should be the ghost
        expect(tileContainers.indexOf(found[0].previousSibling)).toEqual(4);

        // the second should be the real RM
        expect(tileContainers.indexOf(found[1].previousSibling)).toEqual(6);

        // and move the RM again
        mp = ReactDOM.render(
                <MessagePanel events={events} readMarkerEventId={events[8].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        // still two RM containers
        found = TestUtils.scryRenderedDOMComponentsWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(found.length).toEqual(2);

        // they should have moved
        expect(tileContainers.indexOf(found[0].previousSibling)).toEqual(6);
        expect(tileContainers.indexOf(found[1].previousSibling)).toEqual(8);
    });
});
