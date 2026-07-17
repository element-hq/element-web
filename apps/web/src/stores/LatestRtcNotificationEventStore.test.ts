/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { type EventTimeline, EventType, RoomEvent } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "stream";

import { mkEvent, mkRoom, mkRoomMember, stubClient } from "../../test/test-utils";
import { CallStoreEvent, type CallStore } from "./CallStore";
import { LatestRtcNotificationEventStore } from "./LatestRtcNotificationEventStore";
import { type ElementCall, type Call } from "../models/Call";

describe("LatestRtcNotificationEventStore", () => {
    it("should populate map from timeline on start", () => {
        const cli = stubClient();

        const event1 = mkEvent({
            type: EventType.RTCNotification,
            user: "@alice:m.org",
            content: {},
            event: true,
            id: "event-1",
        });
        const room1 = mkRoom(cli, "!my-room1:m.org");
        vi.spyOn(room1, "getLiveTimeline").mockImplementation(() => {
            return {
                getEvents: () => {
                    return [event1];
                },
            } as unknown as EventTimeline;
        });

        const event2 = mkEvent({
            type: EventType.RTCNotification,
            user: "@bob:m.org",
            content: {},
            event: true,
            id: "event-2",
        });
        const room2 = mkRoom(cli, "!my-room2:m.org");
        vi.spyOn(room2, "getLiveTimeline").mockImplementation(() => {
            return {
                getEvents: () => {
                    return [event2];
                },
            } as unknown as EventTimeline;
        });

        vi.spyOn(cli, "getRoom").mockImplementation((roomId) => (roomId === "!my-room1:m.org" ? room1 : room2));

        const callStore = new EventEmitter() as unknown as CallStore;
        callStore.getAllCalls = () => {
            return new Map([
                ["!my-room1:m.org", undefined],
                ["!my-room2:m.org", undefined],
            ]) as unknown as Map<string, Call>;
        };

        const store = new LatestRtcNotificationEventStore(callStore);
        vi.spyOn(store, "matrixClient", "get").mockReturnValue(cli);
        store.start();
        vi.waitFor(() => {
            expect(store.getLatestEventId("!my-room1:m.org")).toStrictEqual("event-1");
            expect(store.getLatestEventId("!my-room2:m.org")).toStrictEqual("event-2");
        });
    });

    it("should wait for rtc notification event when a call begins", () => {
        const cli = stubClient();

        // This is the last notification event in the timeline
        const oldNotificationEvent = mkEvent({
            type: EventType.RTCNotification,
            user: "@alice:m.org",
            content: {
                "m.relates_to": {
                    event_id: "$GOr0aimJwcQcPV4F20IEhBCpandNPMEfhWYfpcK3VeE",
                    rel_type: "m.reference",
                },
            },
            event: true,
            id: "event-1",
        });

        // This is the notification event corresponding to the ongoing call which hasn't come in yet
        const newNotificationEvent = mkEvent({
            type: EventType.RTCNotification,
            user: "@alice:m.org",
            content: {
                "m.relates_to": {
                    event_id: "call-membership-1",
                    rel_type: "m.reference",
                },
            },
            event: true,
            id: "event-2",
        });

        // The call membership event associated with newNotificationEvent
        const callMembershipEvent = mkEvent({
            type: EventType.GroupCallMemberPrefix,
            user: "@alice:m.org",
            content: {},
            event: true,
            id: "call-membership-1",
        });

        // The room where this call takes place
        const room = mkRoom(cli, "!my-room1:m.org");
        vi.spyOn(cli, "getRoom").mockImplementation(() => room);

        // The current timeline in that room
        const timeline = [oldNotificationEvent];
        vi.spyOn(room, "getLiveTimeline").mockImplementation(() => {
            return {
                getEvents: () => {
                    return timeline;
                },
            } as unknown as EventTimeline;
        });

        const call = new EventEmitter();
        // @ts-ignore
        call.participants = new Map([[mkRoomMember("!my-room1:m.org", "@alice:m.org"), new Set()]]);
        // @ts-ignore
        call.session = {
            getOldestMembership: () => {
                return {
                    eventId: callMembershipEvent.getId(),
                };
            },
        };

        const callStore = new EventEmitter() as unknown as CallStore;
        callStore.getAllCalls = () => {
            return new Map([]) as unknown as Map<string, Call>;
        };
        callStore.getCall = () => call as unknown as ElementCall;

        const store = new LatestRtcNotificationEventStore(callStore);
        vi.spyOn(store, "matrixClient", "get").mockReturnValue(cli);
        store.start();

        // No calls in the room yet
        expect(store.getLatestEventId("!my-room1:m.org")).toBeUndefined();

        // Let's say a new call starts
        callStore.emit(CallStoreEvent.Call, call, room);

        // The correct notification event hasn't come in yet, so still undefined.
        expect(store.getLatestEventId("!my-room1:m.org")).toBeUndefined();

        // Notification event comes in
        room.emit(RoomEvent.Timeline, newNotificationEvent);

        // Should update the event id in store
        vi.waitFor(() => {
            expect(store.getLatestEventId("!my-room1:m.org")).toStrictEqual("event-2");
        });
    });
});
