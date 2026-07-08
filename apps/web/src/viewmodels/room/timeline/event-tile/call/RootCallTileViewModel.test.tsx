/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { type EventTimeline, EventType, type MatrixEvent, type RoomState } from "matrix-js-sdk/src/matrix";

import { mkEvent, mkMessage, mkRoomMember, mkStubRoom, stubClient } from "../../../../../../test/test-utils";
import { getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "./call-mocks";
import { RootCallTileViewModel } from "./RootCallTileViewModel";

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

    return { callStore, cli, mxEvent, call };
}

describe("RootCallTileViewModel", () => {
    it("computes correct tileType for tombstone call in DM", () => {
        const { cli, mxEvent } = getMocked(["@alice:m.org", "@bob:m.org"]);
        const vm = new RootCallTileViewModel({ cli, mxEvent });

        expect(vm.getSnapshot().tileType).toStrictEqual("tombstone-call-dm");
    });

    it("computes correct tileType for tombstone call in Room", () => {
        const { cli, mxEvent } = getMocked(["@alice:m.org", "@bob:m.org", "@jack:m.org"]);
        const vm = new RootCallTileViewModel({ cli, mxEvent });

        expect(vm.getSnapshot().tileType).toStrictEqual("tombstone-call-room");
    });
});
