/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2021, 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { EventEmitter } from "events";
import { MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import FakeTimers from "@sinonjs/fake-timers";
import { render } from "@testing-library/react";
import { Thread } from "matrix-js-sdk/src/models/thread";

import MessagePanel, { shouldFormContinuation } from "../../../src/components/structures/MessagePanel";
import SettingsStore from "../../../src/settings/SettingsStore";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import * as TestUtilsMatrix from "../../test-utils";
import {
    getMockClientWithEventEmitter,
    makeBeaconInfoEvent,
    mockClientMethodsEvents,
    mockClientMethodsUser,
} from "../../test-utils";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { IRoomState } from "../../../src/components/structures/RoomView";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

jest.mock("../../../src/utils/beacon", () => ({
    useBeacon: jest.fn(),
}));

const roomId = "!roomId:server_name";

describe("MessagePanel", function () {
    let clock: FakeTimers.InstalledClock;
    const events = mkEvents();
    const userId = "@me:here";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        getAccountData: jest.fn(),
        isUserIgnored: jest.fn().mockReturnValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getRoom: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({}),
        supportsThreads: jest.fn().mockReturnValue(true),
    });
    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);

    const room = new Room(roomId, client, userId);

    const bobMember = new RoomMember(roomId, "@bob:id");
    bobMember.name = "Bob";
    jest.spyOn(bobMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    jest.spyOn(bobMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

    const alice = "@alice:example.org";
    const aliceMember = new RoomMember(roomId, alice);
    aliceMember.name = "Alice";
    jest.spyOn(aliceMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    jest.spyOn(aliceMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

    const defaultProps = {
        resizeNotifier: new EventEmitter() as unknown as ResizeNotifier,
        callEventGroupers: new Map(),
        room,
        className: "cls",
        events: [] as MatrixEvent[],
    };

    const defaultRoomContext = {
        ...RoomContext,
        timelineRenderingType: TimelineRenderingType.Room,
        room,
        roomId: room.roomId,
        canReact: true,
        canSendMessages: true,
        showReadReceipts: true,
        showRedactions: false,
        showJoinLeaves: false,
        showAvatarChanges: false,
        showDisplaynameChanges: true,
        showHiddenEvents: false,
    } as unknown as IRoomState;

    const getComponent = (props = {}, roomContext: Partial<IRoomState> = {}) => (
        <MatrixClientContext.Provider value={client}>
            <RoomContext.Provider value={{ ...defaultRoomContext, ...roomContext }}>
                <MessagePanel {...defaultProps} {...props} />
            </RoomContext.Provider>
            );
        </MatrixClientContext.Provider>
    );

    beforeEach(function () {
        jest.clearAllMocks();
        // HACK: We assume all settings want to be disabled
        jest.spyOn(SettingsStore, "getValue").mockImplementation((arg) => {
            return arg === "showDisplaynameChanges";
        });

        DMRoomMap.makeShared(client);
    });

    afterEach(function () {
        clock?.uninstall();
    });

    function mkEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();
        for (let i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMessage({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    ts: ts0 + i * 1000,
                }),
            );
        }
        return events;
    }

    // Just to avoid breaking Dateseparator tests that might run at 00hrs
    function mkOneDayEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.parse("09 May 2004 00:12:00 GMT");
        for (let i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMessage({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    ts: ts0 + i * 1000,
                }),
            );
        }
        return events;
    }

    // make a collection of events with some member events that should be collapsed with an EventListSummary
    function mkMelsEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();

        let i = 0;
        events.push(
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                ts: ts0 + ++i * 1000,
            }),
        );

        for (i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    target: bobMember,
                    ts: ts0 + i * 1000,
                    mship: "join",
                    prevMship: "join",
                    name: "A user",
                }),
            );
        }

        events.push(
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                ts: ts0 + ++i * 1000,
            }),
        );

        return events;
    }

    // A list of membership events only with nothing else
    function mkMelsEventsOnly() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();

        let i = 0;

        for (i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    target: bobMember,
                    ts: ts0 + i * 1000,
                    mship: "join",
                    prevMship: "join",
                    name: "A user",
                }),
            );
        }

        return events;
    }

    // A list of room creation, encryption, and invite events.
    function mkCreationEvents() {
        const mkEvent = TestUtilsMatrix.mkEvent;
        const mkMembership = TestUtilsMatrix.mkMembership;
        const roomId = "!someroom";

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
                target: aliceMember,
                ts: ts0 + 1,
                mship: "join",
                name: "Alice",
            }),
            mkEvent({
                event: true,
                type: "m.room.join_rules",
                room: roomId,
                user: alice,
                content: {
                    join_rule: "invite",
                },
                ts: ts0 + 2,
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                room: roomId,
                user: alice,
                content: {
                    history_visibility: "invited",
                },
                ts: ts0 + 3,
            }),
            mkEvent({
                event: true,
                type: "m.room.encryption",
                room: roomId,
                user: alice,
                content: {
                    algorithm: "m.megolm.v1.aes-sha2",
                },
                ts: ts0 + 4,
            }),
            mkMembership({
                event: true,
                room: roomId,
                user: alice,
                skey: "@bob:example.org",
                target: bobMember,
                ts: ts0 + 5,
                mship: "invite",
                name: "Bob",
            }),
        ];
    }

    function mkMixedHiddenAndShownEvents() {
        const roomId = "!room:id";
        const userId = "@alice:example.org";
        const ts0 = Date.now();

        return [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: roomId,
                user: userId,
                ts: ts0,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "org.example.a_hidden_event",
                room: roomId,
                user: userId,
                content: {},
                ts: ts0 + 1,
            }),
        ];
    }

    function isReadMarkerVisible(rmContainer?: Element) {
        return !!rmContainer?.children.length;
    }

    it("should show the events", function () {
        const { container } = render(getComponent({ events }));

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(10);
    });

    it("should collapse adjacent member events", function () {
        const { container } = render(getComponent({ events: mkMelsEvents() }));

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);

        const summaryTiles = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(summaryTiles.length).toEqual(1);
    });

    it("should insert the read-marker in the right place", function () {
        const { container } = render(
            getComponent({
                events,
                readMarkerEventId: events[4].getId(),
                readMarkerVisible: true,
            }),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        // it should follow the <li> which wraps the event tile for event 4
        const eventContainer = tiles[4];
        expect(rm.previousSibling).toEqual(eventContainer);
    });

    it("should show the read-marker that fall in summarised events after the summary", function () {
        const melsEvents = mkMelsEvents();
        const { container } = render(
            getComponent({
                events: melsEvents,
                readMarkerEventId: melsEvents[4].getId(),
                readMarkerVisible: true,
            }),
        );

        const [summary] = container.getElementsByClassName("mx_GenericEventListSummary");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(rm.previousSibling).toEqual(summary);

        // read marker should be visible given props and not at the last event
        expect(isReadMarkerVisible(rm)).toBeTruthy();
    });

    it("should hide the read-marker at the end of summarised events", function () {
        const melsEvents = mkMelsEventsOnly();

        const { container } = render(
            getComponent({
                events: melsEvents,
                readMarkerEventId: melsEvents[9].getId(),
                readMarkerVisible: true,
            }),
        );

        const [summary] = container.getElementsByClassName("mx_GenericEventListSummary");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(rm.previousSibling).toEqual(summary);

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
    });

    it("shows a ghost read-marker when the read-marker moves", function () {
        // fake the clock so that we can test the velocity animation.
        clock = FakeTimers.install();

        const { container, rerender } = render(
            <div>
                {getComponent({
                    events,
                    readMarkerEventId: events[4].getId(),
                    readMarkerVisible: true,
                })}
            </div>,
        );

        const tiles = container.getElementsByClassName("mx_EventTile");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");
        expect(rm.previousSibling).toEqual(tiles[4]);

        rerender(
            <div>
                {getComponent({
                    events,
                    readMarkerEventId: events[6].getId(),
                    readMarkerVisible: true,
                })}
            </div>,
        );

        // now there should be two RM containers
        const readMarkers = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(readMarkers.length).toEqual(2);

        // the first should be the ghost
        expect(readMarkers[0].previousSibling).toEqual(tiles[4]);
        const hr: HTMLElement = readMarkers[0].children[0] as HTMLElement;

        // the second should be the real thing
        expect(readMarkers[1].previousSibling).toEqual(tiles[6]);

        // advance the clock, and then let the browser run an animation frame to let the animation start
        clock.tick(1500);
        expect(hr.style.opacity).toEqual("0");
    });

    it("should collapse creation events", function () {
        const events = mkCreationEvents();
        const createEvent = events.find((event) => event.getType() === "m.room.create")!;
        const encryptionEvent = events.find((event) => event.getType() === "m.room.encryption")!;
        client.getRoom.mockImplementation((id) => (id === createEvent!.getRoomId() ? room : null));
        TestUtilsMatrix.upsertRoomStateEvents(room, events);

        const { container } = render(getComponent({ events }));

        // we expect that
        // - the room creation event, the room encryption event, and Alice inviting Bob,
        //   should be outside of the room creation summary
        // - all other events should be inside the room creation summary

        const tiles = container.getElementsByClassName("mx_EventTile");

        expect(tiles[0].getAttribute("data-event-id")).toEqual(createEvent.getId());
        expect(tiles[1].getAttribute("data-event-id")).toEqual(encryptionEvent.getId());

        const [summaryTile] = container.getElementsByClassName("mx_GenericEventListSummary");

        const summaryEventTiles = summaryTile.getElementsByClassName("mx_EventTile");
        // every event except for the room creation, room encryption, and Bob's
        // invite event should be in the event summary
        expect(summaryEventTiles.length).toEqual(tiles.length - 3);
    });

    it("should not collapse beacons as part of creation events", function () {
        const events = mkCreationEvents();
        const creationEvent = events.find((event) => event.getType() === "m.room.create")!;
        const beaconInfoEvent = makeBeaconInfoEvent(creationEvent.getSender()!, creationEvent.getRoomId()!, {
            isLive: true,
        });
        const combinedEvents = [...events, beaconInfoEvent];
        TestUtilsMatrix.upsertRoomStateEvents(room, combinedEvents);
        const { container } = render(getComponent({ events: combinedEvents }));

        const [summaryTile] = container.getElementsByClassName("mx_GenericEventListSummary");

        // beacon body is not in the summary
        expect(summaryTile.getElementsByClassName("mx_MBeaconBody").length).toBe(0);
        // beacon tile is rendered
        expect(container.getElementsByClassName("mx_MBeaconBody").length).toBe(1);
    });

    it("should hide read-marker at the end of creation event summary", function () {
        const events = mkCreationEvents();
        const createEvent = events.find((event) => event.getType() === "m.room.create");
        client.getRoom.mockImplementation((id) => (id === createEvent!.getRoomId() ? room : null));
        TestUtilsMatrix.upsertRoomStateEvents(room, events);

        const { container } = render(
            getComponent({
                events,
                readMarkerEventId: events[5].getId(),
                readMarkerVisible: true,
            }),
        );

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        const [messageList] = container.getElementsByClassName("mx_RoomView_MessageList");
        const rows = messageList.children;
        expect(rows.length).toEqual(7); // 6 events + the NewRoomIntro
        expect(rm.previousSibling).toEqual(rows[5]);

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
    });

    it("should render Date separators for the events", function () {
        const events = mkOneDayEvents();
        const { queryAllByRole } = render(getComponent({ events }));
        const dates = queryAllByRole("separator");

        expect(dates.length).toEqual(1);
    });

    it("appends events into summaries during forward pagination without changing key", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(getComponent({ events }));
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            ...events,
            TestUtilsMatrix.mkMembership({
                event: true,
                room: "!room:id",
                user: "@user:id",
                target: bobMember,
                ts: Date.now(),
                mship: "join",
                prevMship: "join",
                name: "A user",
            }),
        ];
        rerender(getComponent({ events: updatedEvents }));

        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(11);
    });

    it("prepends events into summaries during backward pagination without changing key", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(getComponent({ events }));
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            TestUtilsMatrix.mkMembership({
                event: true,
                room: "!room:id",
                user: "@user:id",
                target: bobMember,
                ts: Date.now(),
                mship: "join",
                prevMship: "join",
                name: "A user",
            }),
            ...events,
        ];
        rerender(getComponent({ events: updatedEvents }));

        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(11);
    });

    it("assigns different keys to summaries that get split up", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(getComponent({ events }));
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[0].getId()}`);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            ...events.slice(0, 5),
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                msg: "Hello!",
            }),
            ...events.slice(5, 10),
        ];
        rerender(getComponent({ events: updatedEvents }));

        // summaries split becuase room messages are not summarised
        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(2);
        expect(els[0].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[0].getId()}`);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(5);

        expect(els[1].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[5].getId()}`);
        expect(els[1].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(5);
    });

    // We test this because setting lookups can be *slow*, and we don't want
    // them to happen in this code path
    it("doesn't lookup showHiddenEventsInTimeline while rendering", () => {
        // We're only interested in the setting lookups that happen on every render,
        // rather than those happening on first mount, so let's get those out of the way
        const { rerender } = render(getComponent({ events: [] }));

        // Set up our spy and re-render with new events
        const settingsSpy = jest.spyOn(SettingsStore, "getValue").mockClear();

        rerender(getComponent({ events: mkMixedHiddenAndShownEvents() }));

        expect(settingsSpy).not.toHaveBeenCalledWith("showHiddenEventsInTimeline");
        settingsSpy.mockRestore();
    });

    it("should group hidden event reactions into an event list summary", () => {
        const events = [
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 1,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 2,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 3,
            }),
        ];
        const { container } = render(getComponent({ events }, { showHiddenEvents: true }));

        const els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(3);
    });

    it("should handle large numbers of hidden events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events: MatrixEvent[] = [];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkEvent({
                    event: true,
                    type: "unknown.event.type",
                    content: { key: "value" },
                    room: "!room:id",
                    user: "@user:id",
                    ts: 1000000 + i,
                }),
            );
        }
        const { asFragment } = render(getComponent({ events }, { showHiddenEvents: false }));
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of room creation events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events = [TestUtilsMatrix.mkRoomCreateEvent("@user:id", "!room:id")];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: "join",
                    prevMship: "join",
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(getComponent({ events }, { showHiddenEvents: false }));
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of membership events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events: MatrixEvent[] = [];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: "join",
                    prevMship: "join",
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(getComponent({ events }, { showHiddenEvents: true }));
        const cpt = asFragment();

        // Ignore properties that change every time
        cpt.querySelectorAll("li").forEach((li) => {
            li.setAttribute("data-scroll-tokens", "__scroll_tokens__");
            li.setAttribute("data-testid", "__testid__");
        });

        expect(cpt).toMatchSnapshot();
    });
});

describe("shouldFormContinuation", () => {
    it("does not form continuations from thread roots which have summaries", () => {
        const message1 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "Here is a message in the main timeline",
        });

        const message2 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "And here's another message in the main timeline",
        });

        const threadRoot = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "Here is a thread",
        });
        jest.spyOn(threadRoot, "isThreadRoot", "get").mockReturnValue(true);

        const message3 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "And here's another message in the main timeline after the thread root",
        });

        expect(shouldFormContinuation(message1, message2, false)).toEqual(true);
        expect(shouldFormContinuation(message2, threadRoot, false)).toEqual(true);
        expect(shouldFormContinuation(threadRoot, message3, false)).toEqual(true);

        const thread = {
            length: 1,
            replyToEvent: {},
        } as unknown as Thread;
        jest.spyOn(threadRoot, "getThread").mockReturnValue(thread);
        expect(shouldFormContinuation(message2, threadRoot, false)).toEqual(false);
        expect(shouldFormContinuation(threadRoot, message3, false)).toEqual(false);
    });
});
