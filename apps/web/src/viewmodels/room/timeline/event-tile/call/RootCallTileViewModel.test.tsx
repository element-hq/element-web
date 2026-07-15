/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { type EventTimeline, EventType, type MatrixEvent, type RoomState } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "node:stream";

import {
    mkEvent,
    mkMessage,
    mkRoomMember,
    mkStubRoom,
    stubClient,
    TestSDKContext,
} from "../../../../../../test/test-utils";
import { getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "./call-mocks";
import { RootCallTileViewModel } from "./RootCallTileViewModel";
import {
    LatestRtcNotificationEventUpdate,
    type LatestRtcNotificationEventStore,
} from "../../../../../stores/LatestRtcNotificationEventStore";

function getEvents(): MatrixEvent[] {
    const message1 = mkMessage({
        room: "!my-room:m.org",
        user: "@alice:m.org",
        event: true,
        msg: "hello",
    });

    const message2 = mkMessage({
        room: "!my-room:m.org",
        user: "@bob:m.org",
        event: true,
        msg: "hello",
    });

    const oldRtcNotificationEvent = mkEvent({
        type: EventType.RTCNotification,
        id: "old-event",
        content: {
            "m.call.intent": "video",
        },
        user: "@alice:m.org",
        event: true,
    });

    const latestRtcNotificationEvent = mkEvent({
        type: EventType.RTCNotification,
        id: "new-event",
        content: {
            "m.call.intent": "video",
        },
        user: "@bob:m.org",
        event: true,
    });
    return [message1, message2, oldRtcNotificationEvent, latestRtcNotificationEvent];
}

function getMocked(userIds: string[]) {
    const cli = stubClient();
    const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
    mxEvent.getId = () => "new-event";

    const call = MockedCall.create();
    const callStore = MockedCallStore.create(call);

    const members = userIds.map((id) => mkRoomMember("!my-room:m.org", id));

    const room = mkStubRoom("!my-room:m.org", "My Room");
    cli.getRoom = () => room;

    vi.spyOn(room, "getMembers").mockReturnValue(members);

    const events = getEvents();
    vi.spyOn(room, "getLiveTimeline").mockImplementation(() => {
        return {
            getEvents: () => {
                return events;
            },
            getState: (): RoomState => {
                return {
                    mayClientSendStateEvent: () => true,
                } as unknown as RoomState;
            },
        } as unknown as EventTimeline;
    });

    const latestRtcNotificationEventStore = new EventEmitter() as unknown as LatestRtcNotificationEventStore;
    latestRtcNotificationEventStore.getLatestEventId = () => undefined;

    return { callStore, latestRtcNotificationEventStore, cli, mxEvent, call };
}

describe("RootCallTileViewModel", () => {
    const sdkContext = new TestSDKContext();
    const legacyCallHandler = sdkContext.legacyCallHandler;

    it("computes correct tileType for ongoing call in DM", () => {
        const { callStore, cli, mxEvent, latestRtcNotificationEventStore } = getMocked(["@alice:m.org", "@bob:m.org"]);
        latestRtcNotificationEventStore.getLatestEventId = () => "new-event";
        const vm = new RootCallTileViewModel({
            latestRtcNotificationEventStore,
            callStore,
            cli,
            mxEvent,
            legacyCallHandler,
        });

        expect(vm.getSnapshot().tileType).toStrictEqual("ongoing-call-dm");
    });

    it("computes correct tileType for ongoing call in Room", () => {
        const { callStore, cli, mxEvent, latestRtcNotificationEventStore } = getMocked([
            "@alice:m.org",
            "@bob:m.org",
            "@jack:m.org",
        ]);
        latestRtcNotificationEventStore.getLatestEventId = () => "new-event";
        const vm = new RootCallTileViewModel({
            latestRtcNotificationEventStore,
            callStore,
            cli,
            mxEvent,
            legacyCallHandler,
        });

        expect(vm.getSnapshot().tileType).toStrictEqual("ongoing-call-room");
    });

    it("computes correct tileType for tombstone call in DM", () => {
        // When there's an ongoing call
        const { callStore, cli, mxEvent, latestRtcNotificationEventStore } = getMocked(["@alice:m.org", "@bob:m.org"]);
        const vm = new RootCallTileViewModel({
            latestRtcNotificationEventStore,
            callStore,
            cli,
            mxEvent,
            legacyCallHandler,
        });

        expect(vm.getSnapshot().tileType).toStrictEqual("tombstone-call-dm");
    });

    it("computes correct tileType for tombstone call in Room", () => {
        // When there's an ongoing call
        const { callStore, cli, mxEvent, latestRtcNotificationEventStore } = getMocked([
            "@alice:m.org",
            "@bob:m.org",
            "@jack:m.org",
        ]);
        const vm = new RootCallTileViewModel({
            latestRtcNotificationEventStore,
            callStore,
            cli,
            mxEvent,
            legacyCallHandler,
        });
        expect(vm.getSnapshot().tileType).toStrictEqual("tombstone-call-room");
    });

    it("recomputes snapshot on event from LatestRtcNotificationEventUpdate", () => {
        // When there's an ongoing call
        const { callStore, cli, mxEvent, latestRtcNotificationEventStore } = getMocked([
            "@alice:m.org",
            "@bob:m.org",
            "@jack:m.org",
        ]);
        const vm = new RootCallTileViewModel({
            latestRtcNotificationEventStore,
            callStore,
            cli,
            mxEvent,
            legacyCallHandler,
        });
        expect(vm.getSnapshot().tileType).toStrictEqual("tombstone-call-room");

        // Tile type should update on event
        latestRtcNotificationEventStore.getLatestEventId = () => "new-event";
        latestRtcNotificationEventStore.emit(LatestRtcNotificationEventUpdate, "!my-room:m.org", "new-event");
        expect(vm.getSnapshot().tileType).toStrictEqual("ongoing-call-room");
    });
});
