/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 , 2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { EventEmitter } from "node:events";
import { type MatrixEvent, Room, RoomMember, type Thread, ReceiptType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import type { MatrixEvent as ModuleMatrixEvent } from "@element-hq/element-web-module-api";
import { render, within } from "test-utils-rtl";
import * as TestUtilsMatrix from "test-utils";
import {
    clientAndSDKContextRenderOptions,
    createTestClient,
    getMockClientWithEventEmitter,
    makeBeaconInfoEvent,
    mockClientMethodsCrypto,
    mockClientMethodsEvents,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientPushProcessor,
    TestSDKContext,
} from "test-utils";

import MessagePanel, { shouldFormContinuation } from "./MessagePanel";
import SettingsStore from "../../settings/SettingsStore";
import RoomContext, { type RoomContextType, TimelineRenderingType } from "../../contexts/RoomContext";
import DMRoomMap from "../../utils/DMRoomMap";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext.tsx";
import { ModuleApi } from "../../modules/Api.ts";
import { CustomComponentsApi } from "../../modules/customComponentApi.ts";

vi.mock("../../utils/beacon", () => ({
    useBeacon: vi.fn(),
}));

const roomId = "!roomId:server_name";

describe("MessagePanel", function () {
    const events = mkEvents();
    const userId = "@me:here";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        ...mockClientMethodsCrypto(),
        ...mockClientPushProcessor(),
        ...mockClientMethodsServer(),
        getAccountData: vi.fn(),
        isUserIgnored: vi.fn().mockReturnValue(false),
        isRoomEncrypted: vi.fn().mockReturnValue(false),
        getRoom: vi.fn(),
        supportsThreads: vi.fn().mockReturnValue(true),
        getVisibleRooms: vi.fn().mockReturnValue([]),
    });
    let sdkContext: TestSDKContext;
    vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client);

    const room = new Room(roomId, client, userId);

    const bobMember = new RoomMember(roomId, "@bob:id");
    bobMember.name = "Bob";
    vi.spyOn(bobMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    vi.spyOn(bobMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

    const alice = "@alice:example.org";
    const aliceMember = new RoomMember(roomId, alice);
    aliceMember.name = "Alice";
    vi.spyOn(aliceMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    vi.spyOn(aliceMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

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
    } as unknown as RoomContextType;

    const getComponent = (props = {}, roomContext: Partial<RoomContextType> = {}) => (
        <ScopedRoomContextProvider {...defaultRoomContext} {...roomContext}>
            <MessagePanel {...defaultProps} {...props} />
        </ScopedRoomContextProvider>
    );

    beforeEach(function () {
        vi.clearAllMocks();
        // HACK: We assume all settings want to be disabled
        vi.spyOn(SettingsStore, "getValue").mockImplementation((arg) => {
            return arg === "showDisplaynameChanges";
        });

        sdkContext = new TestSDKContext();
        sdkContext._client = client;

        DMRoomMap.makeShared(client);
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
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
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
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
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
                mship: KnownMembership.Join,
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
                mship: KnownMembership.Invite,
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
        const { container } = render(getComponent({ events }), clientAndSDKContextRenderOptions(client, sdkContext));

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(10);
    });

    it("should collapse adjacent member events", function () {
        const { container } = render(
            getComponent({ events: mkMelsEvents() }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);

        const summaryTiles = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(summaryTiles.length).toEqual(1);
    });

    it("groups custom messages without an informational hint by renderer and grouping key", function () {
        const api = new CustomComponentsApi();
        const summarize = vi.fn((events: readonly ModuleMatrixEvent[]) => {
            return `${String(events[0].content.kind)}/${String(events[0].content.group)}: ${events.length} events`;
        });
        for (const kind of ["first", "second"]) {
            api.registerMessageRenderer(
                (event) => event.content.kind === kind,
                () => <span>Custom message</span>,
                {
                    renderAsInformationalMessage: kind === "second",
                    renderGroupSummary: {
                        getKey: (event) => String(event.content.group),
                        getSummary: summarize,
                    },
                },
            );
        }
        const hintsSpy = vi
            .spyOn(ModuleApi.instance.customComponents, "getHintsForMessage")
            .mockImplementation(api.getHintsForMessage.bind(api));
        const groupingSpy = vi
            .spyOn(ModuleApi.instance.customComponents, "getGroupingForMessage")
            .mockImplementation(api.getGroupingForMessage.bind(api));
        const customEvents = [
            ...Array.from({ length: 3 }, () => ({ kind: "first", group: "one" })),
            ...Array.from({ length: 3 }, () => ({ kind: "first", group: "two" })),
            ...Array.from({ length: 3 }, () => ({ kind: "second", group: "two" })),
        ].map(({ kind, group }) => {
            const event = TestUtilsMatrix.mkMessage({ event: true, room: roomId, user: userId, ts: Date.now() });
            event.event.content.kind = kind;
            event.event.content.group = group;
            return event;
        });
        const ordinaryMessage = TestUtilsMatrix.mkMessage({ event: true, room: roomId, user: userId, ts: Date.now() });

        const { container } = render(
            getComponent({
                events: [
                    ...customEvents.slice(0, 3),
                    ...mkMelsEventsOnly().slice(0, 3),
                    ...customEvents.slice(3),
                    ordinaryMessage,
                ],
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const [summary] = container.querySelectorAll(".mx_GenericEventListSummary_summary");
        expect(container.querySelectorAll(".mx_GenericEventListSummary")).toHaveLength(1);
        expect(container.getElementsByClassName("mx_EventTile")).toHaveLength(1);
        expect(summary).toHaveTextContent("first/one: 3 events");
        expect(summary).toHaveTextContent("first/two: 3 events");
        expect(summary).toHaveTextContent("second/two: 3 events");
        const text = summary.textContent!;
        expect(text.indexOf("first/one")).toBeLessThan(text.indexOf("first/two"));
        expect(text.indexOf("first/two")).toBeLessThan(text.indexOf("second/two"));
        expect(summarize.mock.calls.every(([events]) => events.length === 3)).toBe(true);
        expect(summarize).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ eventId: customEvents[0].getId(), sender: userId })]),
        );
        hintsSpy.mockRestore();
        groupingSpy.mockRestore();
    });

    it("falls back to the built-in summary when a custom summary fails", function () {
        const api = new CustomComponentsApi();
        const getSummary = vi.fn((): string => {
            throw new Error("summary failed");
        });
        api.registerMessageRenderer("m.room.message", () => <span>Custom message</span>, {
            renderAsInformationalMessage: true,
            renderGroupSummary: { getSummary },
        });
        const hintsSpy = vi
            .spyOn(ModuleApi.instance.customComponents, "getHintsForMessage")
            .mockImplementation(api.getHintsForMessage.bind(api));
        const groupingSpy = vi
            .spyOn(ModuleApi.instance.customComponents, "getGroupingForMessage")
            .mockImplementation(api.getGroupingForMessage.bind(api));
        const messages = Array.from({ length: 3 }, () =>
            TestUtilsMatrix.mkMessage({ event: true, room: roomId, user: userId, ts: Date.now() }),
        );

        const { container } = render(
            getComponent({ events: messages }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(getSummary).toHaveBeenCalled();
        expect(container.querySelector(".mx_GenericEventListSummary_summary")).toHaveTextContent(
            "sent 3 hidden messages",
        );
        hintsSpy.mockRestore();
        groupingSpy.mockRestore();
    });

    it("should insert the read-marker in the right place", function () {
        const { container } = render(
            getComponent({
                events,
                readMarkerEventId: events[4].getId(),
                readMarkerVisible: true,
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
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
            clientAndSDKContextRenderOptions(client, sdkContext),
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
            clientAndSDKContextRenderOptions(client, sdkContext),
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
        vi.useFakeTimers();

        const { container, rerender } = render(
            <div>
                {getComponent({
                    events,
                    readMarkerEventId: events[4].getId(),
                    readMarkerVisible: true,
                })}
            </div>,
            clientAndSDKContextRenderOptions(client, sdkContext),
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
        vi.advanceTimersByTime(1500);
        expect(hr.style.opacity).toEqual("0");
    });

    it("should collapse creation events", function () {
        const events = mkCreationEvents();
        const createEvent = events.find((event) => event.getType() === "m.room.create")!;
        const encryptionEvent = events.find((event) => event.getType() === "m.room.encryption")!;
        client.getRoom.mockImplementation((id) => (id === createEvent!.getRoomId() ? room : null));
        TestUtilsMatrix.upsertRoomStateEvents(room, events);

        const { container } = render(getComponent({ events }), clientAndSDKContextRenderOptions(client, sdkContext));

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
        const { container } = render(
            getComponent({ events: combinedEvents }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

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
            clientAndSDKContextRenderOptions(client, sdkContext),
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
        const { queryAllByRole } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const dates = queryAllByRole("separator");

        expect(dates.length).toEqual(1);
    });

    it("appends events into summaries during forward pagination without changing key", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
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
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
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

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
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
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
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

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
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
        const { rerender } = render(getComponent({ events: [] }), clientAndSDKContextRenderOptions(client, sdkContext));

        // Set up our spy and re-render with new events
        const settingsSpy = vi.spyOn(SettingsStore, "getValue").mockClear();

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
        const { container } = render(
            getComponent({ events }, { showHiddenEvents: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

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
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: false }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of room creation events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events = [TestUtilsMatrix.mkRoomCreateEvent("@user:id", "!room:id")];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: false }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of membership events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events: MatrixEvent[] = [];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const cpt = asFragment();

        // Ignore properties that change every time
        cpt.querySelectorAll("li").forEach((li) => {
            li.setAttribute("data-scroll-tokens", "__scroll_tokens__");
            li.setAttribute("data-testid", "__testid__");
        });

        expect(cpt).toMatchSnapshot();
    });

    it("should set lastSuccessful=true on non-last event if last event is not eligible for special receipt", () => {
        client.getRoom.mockImplementation((id) => (id === room.roomId ? room : null));
        const events = [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
                type: "m.room.topic",
                skey: "",
                content: { topic: "TOPIC" },
            }),
        ];
        const { container } = render(
            getComponent({ events, showReadReceipts: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);
        expect(within(tiles[0] as HTMLElement).queryByRole("status")).toHaveAccessibleName("Your message was sent");
        expect(within(tiles[1] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
    });

    it("should set lastSuccessful=false on non-last event if last event has a receipt from someone else", () => {
        client.getRoom.mockImplementation((id) => (id === room.roomId ? room : null));
        const events = [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
            }),
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: "@other:user",
                ts: 1001,
            }),
        ];
        room.addReceiptToStructure(
            events[1].getId()!,
            ReceiptType.Read,
            "@other:user",
            {
                ts: 1001,
            },
            true,
        );
        const { container } = render(
            getComponent({ events, showReadReceipts: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);
        expect(within(tiles[0] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
        expect(within(tiles[1] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
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
        vi.spyOn(threadRoot, "isThreadRoot", "get").mockReturnValue(true);

        const message3 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "And here's another message in the main timeline after the thread root",
        });

        const client = createTestClient();
        expect(shouldFormContinuation(message1, message2, client, false)).toEqual(true);
        expect(shouldFormContinuation(message2, threadRoot, client, false)).toEqual(true);
        expect(shouldFormContinuation(threadRoot, message3, client, false)).toEqual(true);

        const thread = {
            length: 1,
            replyToEvent: {},
        } as unknown as Thread;
        vi.spyOn(threadRoot, "getThread").mockReturnValue(thread);
        expect(shouldFormContinuation(message2, threadRoot, client, false)).toEqual(false);
        expect(shouldFormContinuation(threadRoot, message3, client, false)).toEqual(false);
    });
});
