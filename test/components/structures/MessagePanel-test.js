/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
const TestUtils = require('react-dom/test-utils');
const expect = require('expect');
import { EventEmitter } from "events";

import sdk from '../../skinned-sdk';

const MessagePanel = sdk.getComponent('structures.MessagePanel');
import {MatrixClientPeg} from '../../../src/MatrixClientPeg';
import Matrix from 'matrix-js-sdk';

const test_utils = require('../../test-utils');
const mockclock = require('../../mock-clock');

import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";

import Velocity from 'velocity-animate';
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../src/contexts/RoomContext";

configure({ adapter: new Adapter() });

let client;
const room = new Matrix.Room();

// wrap MessagePanel with a component which provides the MatrixClient in the context.
const WrappedMessagePanel = createReactClass({
    getInitialState: function() {
        return {
            resizeNotifier: new EventEmitter(),
        };
    },

    render: function() {
        return <MatrixClientContext.Provider value={client}>
            <RoomContext.Provider value={{ canReact: true, canReply: true }}>
                <MessagePanel room={room} {...this.props} resizeNotifier={this.state.resizeNotifier} />
            </RoomContext.Provider>
        </MatrixClientContext.Provider>;
    },
});

describe('MessagePanel', function() {
    const clock = mockclock.clock();
    const realSetTimeout = window.setTimeout;
    const events = mkEvents();

    beforeEach(function() {
        test_utils.stubClient();
        client = MatrixClientPeg.get();
        client.credentials = {userId: '@me:here'};

        // HACK: We assume all settings want to be disabled
        SettingsStore.getValue = jest.fn((arg) => {
            return arg === "showDisplaynameChanges";
        });

        // This option clobbers the duration of all animations to be 1ms
        // which makes unit testing a lot simpler (the animation doesn't
        // complete without this even if we mock the clock and tick it
        // what should be the correct amount of time).
        Velocity.mock = true;
    });

    afterEach(function() {
        delete Velocity.mock;

        clock.uninstall();
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


    // make a collection of events with some member events that should be collapsed
    // with a MemberEventListSummary
    function mkMelsEvents() {
        const events = [];
        const ts0 = Date.now();

        let i = 0;
        events.push(test_utils.mkMessage({
            event: true, room: "!room:id", user: "@user:id",
            ts: ts0 + ++i*1000,
        }));

        for (i = 0; i < 10; i++) {
            events.push(test_utils.mkMembership({
                event: true, room: "!room:id", user: "@user:id",
                target: {
                    userId: "@user:id",
                    name: "Bob",
                    getAvatarUrl: () => {
                        return "avatar.jpeg";
                    },
                },
                ts: ts0 + i*1000,
                mship: 'join',
                prevMship: 'join',
                name: 'A user',
            }));
        }

        events.push(test_utils.mkMessage({
            event: true, room: "!room:id", user: "@user:id",
            ts: ts0 + ++i*1000,
        }));

        return events;
    }

    // A list of membership events only with nothing else
    function mkMelsEventsOnly() {
        const events = [];
        const ts0 = Date.now();

        let i = 0;

        for (i = 0; i < 10; i++) {
            events.push(test_utils.mkMembership({
                event: true, room: "!room:id", user: "@user:id",
                target: {
                    userId: "@user:id",
                    name: "Bob",
                    getAvatarUrl: () => {
                        return "avatar.jpeg";
                    },
                },
                ts: ts0 + i*1000,
                mship: 'join',
                prevMship: 'join',
                name: 'A user',
            }));
        }

        return events;
    }

    // A list of room creation, encryption, and invite events.
    function mkCreationEvents() {
        const mkEvent = test_utils.mkEvent;
        const mkMembership = test_utils.mkMembership;
        const roomId = "!someroom";
        const alice = "@alice:example.org";
        const ts0 = Date.now();

        return [
            mkEvent({
                event: true,
                type: "m.room.create",
                room: roomId,
                user: alice,
                content: {
                    creator: alice,
                    room_version: "5",
                    predecessor: {
                        room_id: "!prevroom",
                        event_id: "$someevent",
                    },
                },
                ts: ts0,
            }),
            mkMembership({
                event: true,
                room: roomId,
                user: alice,
                target: {
                    userId: alice,
                    name: "Alice",
                    getAvatarUrl: () => {
                        return "avatar.jpeg";
                    },
                },
                ts: ts0 + 1,
                mship: 'join',
                name: 'Alice',
            }),
            mkEvent({
                event: true,
                type: "m.room.join_rules",
                room: roomId,
                user: alice,
                content: {
                    "join_rule": "invite"
                },
                ts: ts0 + 2,
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                room: roomId,
                user: alice,
                content: {
                    "history_visibility": "invited",
                },
                ts: ts0 + 3,
            }),
            mkEvent({
                event: true,
                type: "m.room.encryption",
                room: roomId,
                user: alice,
                content: {
                    "algorithm": "m.megolm.v1.aes-sha2",
                },
                ts: ts0 + 4,
            }),
            mkMembership({
                event: true,
                room: roomId,
                user: alice,
                skey: "@bob:example.org",
                target: {
                    userId: "@bob:example.org",
                    name: "Bob",
                    getAvatarUrl: () => {
                        return "avatar.jpeg";
                    },
                },
                ts: ts0 + 5,
                mship: 'invite',
                name: 'Bob',
            }),
        ];
    }

    function isReadMarkerVisible(rmContainer) {
        return rmContainer && rmContainer.children.length > 0;
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

    it('should collapse adjacent member events', function() {
        const res = TestUtils.renderIntoDocument(
            <WrappedMessagePanel className="cls" events={mkMelsEvents()} />,
        );

        // just check we have the right number of tiles for now
        const tiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('rooms.EventTile'),
        );
        expect(tiles.length).toEqual(2);

        const summaryTiles = TestUtils.scryRenderedComponentsWithType(
            res, sdk.getComponent('elements.MemberEventListSummary'),
        );
        expect(summaryTiles.length).toEqual(1);
    });

    it('should insert the read-marker in the right place', function() {
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

    it('should show the read-marker that fall in summarised events after the summary', function() {
        const melsEvents = mkMelsEvents();
        const res = TestUtils.renderIntoDocument(
                <WrappedMessagePanel className="cls" events={melsEvents} readMarkerEventId={melsEvents[4].getId()}
                    readMarkerVisible={true} />,
        );

        const summary = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_EventListSummary');

        // find the <li> which wraps the read marker
        const rm = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_RoomView_myReadMarker_container');

        expect(rm.previousSibling).toEqual(summary);

        // read marker should be visible given props and not at the last event
        expect(isReadMarkerVisible(rm)).toBeTruthy();
    });

    it('should hide the read-marker at the end of summarised events', function() {
        const melsEvents = mkMelsEventsOnly();
        const res = TestUtils.renderIntoDocument(
                <WrappedMessagePanel className="cls" events={melsEvents} readMarkerEventId={melsEvents[9].getId()}
                    readMarkerVisible={true} />,
        );

        const summary = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_EventListSummary');

        // find the <li> which wraps the read marker
        const rm = TestUtils.findRenderedDOMComponentWithClass(res, 'mx_RoomView_myReadMarker_container');

        expect(rm.previousSibling).toEqual(summary);

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
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

    it('should collapse creation events', function() {
        const events = mkCreationEvents();
        const res = mount(
            <WrappedMessagePanel className="cls" events={events} />,
        );

        // we expect that
        // - the room creation event, the room encryption event, and Alice inviting Bob,
        //   should be outside of the room creation summary
        // - all other events should be inside the room creation summary

        const tiles = res.find(sdk.getComponent('views.rooms.EventTile'));

        expect(tiles.at(0).props().mxEvent.getType()).toEqual("m.room.create");
        expect(tiles.at(1).props().mxEvent.getType()).toEqual("m.room.encryption");

        const summaryTiles = res.find(sdk.getComponent('views.elements.EventListSummary'));
        const summaryTile = summaryTiles.at(0);

        const summaryEventTiles = summaryTile.find(sdk.getComponent('views.rooms.EventTile'));
        // every event except for the room creation, room encryption, and Bob's
        // invite event should be in the event summary
        expect(summaryEventTiles.length).toEqual(tiles.length - 3);
    });

    it('should hide read-marker at the end of creation event summary', function() {
        const events = mkCreationEvents();
        const res = mount(
            <WrappedMessagePanel
                className="cls"
                events={events}
                readMarkerEventId={events[5].getId()}
                readMarkerVisible={true}
            />,
        );

        // find the <li> which wraps the read marker
        const rm = res.find('.mx_RoomView_myReadMarker_container').getDOMNode();

        const rows = res.find('.mx_RoomView_MessageList').children();
        expect(rows.length).toEqual(6);
        expect(rm.previousSibling).toEqual(rows.at(4).getDOMNode());

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
    });
});
