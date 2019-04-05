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

import SettingsStore from "../../../src/settings/SettingsStore";

const React = require('react');
const ReactDOM = require("react-dom");
const TestUtils = require('react-addons-test-utils');
const expect = require('expect');
import sinon from 'sinon';
import { EventEmitter } from "events";

const sdk = require('matrix-react-sdk');

const MessagePanel = sdk.getComponent('structures.MessagePanel');
import MatrixClientPeg from '../../../src/MatrixClientPeg';
import Matrix from 'matrix-js-sdk';

const test_utils = require('test-utils');
const mockclock = require('mock-clock');

import Velocity from 'velocity-animate';

let client;
const room = new Matrix.Room();

// wrap MessagePanel with a component which provides the MatrixClient in the context.
const WrappedMessagePanel = React.createClass({
    childContextTypes: {
        matrixClient: React.PropTypes.object,
    },

    getChildContext: function() {
        return {
            matrixClient: client,
        };
    },

    getInitialState: function() {
        return {
            resizeNotifier: new EventEmitter(),
        };
    },

    render: function() {
        return <MessagePanel room={room} {...this.props} resizeNotifier={this.state.resizeNotifier} />;
    },
});

describe('MessagePanel', function() {
    const clock = mockclock.clock();
    const realSetTimeout = window.setTimeout;
    const events = mkEvents();
    let sandbox = null;

    beforeEach(function() {
        test_utils.beforeEach(this);
        sandbox = test_utils.stubClient();
        client = MatrixClientPeg.get();
        client.credentials = {userId: '@me:here'};

        // HACK: We assume all settings want to be disabled
        SettingsStore.getValue = sinon.stub().returns(false);

        // This option clobbers the duration of all animations to be 1ms
        // which makes unit testing a lot simpler (the animation doesn't
        // complete without this even if we mock the clock and tick it
        // what should be the correct amount of time).
        Velocity.mock = true;
    });

    afterEach(function() {
        delete Velocity.mock;

        clock.uninstall();
        sandbox.restore();
    });

    function mkEvents() {
        const events = [];
        const ts0 = Date.now();
        for (let i = 0; i < 10; i++) {
            events.push(test_utils.mkMessage(
                {
                    event: true, room: "!room:id", user: "@user:id",
                    ts: ts0 + i*1000,
                }));
        }
        return events;
    }

    it('should show the events', function() {
        const res = TestUtils.renderIntoDocument(
                <WrappedMessagePanel className="cls" events={events} />,
        );

        // just check we have the right number of tiles for now
        const tiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('rooms.EventTile'));
        expect(tiles.length).toEqual(10);
    });

    it('should show the read-marker in the right place', function() {
        const res = TestUtils.renderIntoDocument(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true} />,
        );

        const tiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('rooms.EventTile'));

        // find the <li> which wraps the read marker
        const rm = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_RoomView_myReadMarker_container');

        // it should follow the <li> which wraps the event tile for event 4
        const eventContainer = ReactDOM.findDOMNode(tiles[4]).parentNode;
        expect(rm.previousSibling).toEqual(eventContainer);
    });

    it('shows a ghost read-marker when the read-marker moves', function(done) {
        // fake the clock so that we can test the velocity animation.
        clock.install();
        clock.mockDate();

        const parentDiv = document.createElement('div');

        // first render with the RM in one place
        let mp = ReactDOM.render(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        const tiles = TestUtils.scryRenderedComponentsWithType(
            mp, sdk.getComponent('rooms.EventTile'));
        const tileContainers = tiles.map(function(t) {
            return ReactDOM.findDOMNode(t).parentNode;
        });

        // find the <li> which wraps the read marker
        const rm = TestUtils.findRenderedDOMComponentWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(rm.previousSibling).toEqual(tileContainers[4]);

        // now move the RM
        mp = ReactDOM.render(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[6].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        // now there should be two RM containers
        const found = TestUtils.scryRenderedDOMComponentsWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(found.length).toEqual(2);

        // the first should be the ghost
        expect(found[0].previousSibling).toEqual(tileContainers[4]);
        const hr = found[0].children[0];

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
        const parentDiv = document.createElement('div');

        // first render with the RM in one place
        let mp = ReactDOM.render(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[4].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        const tiles = TestUtils.scryRenderedComponentsWithType(
            mp, sdk.getComponent('rooms.EventTile'));
        const tileContainers = tiles.map(function(t) {
            return ReactDOM.findDOMNode(t).parentNode;
        });

        // now move the RM
        mp = ReactDOM.render(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[6].getId()}
                    readMarkerVisible={true}
                />, parentDiv);

        // now there should be two RM containers
        let found = TestUtils.scryRenderedDOMComponentsWithClass(mp, 'mx_RoomView_myReadMarker_container');
        expect(found.length).toEqual(2);

        // the first should be the ghost
        expect(tileContainers.indexOf(found[0].previousSibling)).toEqual(4);

        // the second should be the real RM
        expect(tileContainers.indexOf(found[1].previousSibling)).toEqual(6);

        // and move the RM again
        mp = ReactDOM.render(
                <WrappedMessagePanel className="cls" events={events} readMarkerEventId={events[8].getId()}
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
