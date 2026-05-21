/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "events";
import {
    EventTimeline,
    RoomStateEvent,
    type MatrixClient,
    type Room,
    type RoomMember,
    type RoomState,
} from "matrix-js-sdk/src/matrix";

import { E2eMessageSharedIconViewModel } from "../../../src/viewmodels/room/timeline/event-tile/E2eMessageSharedIconViewModel";

type TestRoomState = EventEmitter & {
    getMember: jest.Mock<RoomMember | null, [userId: string]>;
};

const USER_ID = "@bob:example.com";
const ROOM_ID = "!roomId";

function createRoomState(displayName?: string): TestRoomState {
    const getMember = jest.fn((userId: string): RoomMember | null => {
        expect(userId).toBe(USER_ID);
        if (displayName === undefined) return null;

        return { rawDisplayName: displayName } as RoomMember;
    });

    return Object.assign(new EventEmitter(), { getMember }) as TestRoomState;
}

function createClient(roomState: TestRoomState): MatrixClient {
    const room = {
        getLiveTimeline: jest.fn(() => ({
            getState: jest.fn((timeline: EventTimeline) => {
                expect(timeline).toBe(EventTimeline.FORWARDS);
                return roomState as unknown as RoomState;
            }),
        })),
    } as unknown as Room;

    return {
        getRoom: jest.fn((roomId: string) => {
            expect(roomId).toBe(ROOM_ID);
            return room;
        }),
    } as unknown as MatrixClient;
}

function createViewModel(displayName?: string): {
    client: MatrixClient;
    roomState: TestRoomState;
    vm: E2eMessageSharedIconViewModel;
} {
    const roomState = createRoomState(displayName);
    const client = createClient(roomState);
    const vm = new E2eMessageSharedIconViewModel({
        client,
        roomId: ROOM_ID,
        keyForwardingUserId: USER_ID,
    });

    return { client, roomState, vm };
}

describe("E2eMessageSharedIconViewModel", () => {
    it("builds a snapshot with the forwarding member display name", () => {
        const { vm } = createViewModel("Bob");

        expect(vm.getSnapshot()).toMatchObject({
            displayName: "Bob",
            userId: USER_ID,
        });
    });

    it("falls back to the user ID when the forwarding member is unknown", () => {
        const { vm } = createViewModel();

        expect(vm.getSnapshot()).toMatchObject({
            displayName: USER_ID,
            userId: USER_ID,
        });
    });

    it("updates when room state events change the forwarding member display name", () => {
        const { roomState, vm } = createViewModel("Bob");
        const listener = jest.fn();
        vm.subscribe(listener);

        roomState.getMember.mockReturnValue({ rawDisplayName: "Alice" } as RoomMember);
        roomState.emit(RoomStateEvent.Events);

        expect(vm.getSnapshot().displayName).toBe("Alice");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit updates when setters receive unchanged values", () => {
        const { client, vm } = createViewModel("Bob");
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setClient(client);
        vm.setRoomId(ROOM_ID);
        vm.setKeyForwardingUserId(USER_ID);

        expect(listener).not.toHaveBeenCalled();
    });

    it("removes its room state listener when disposed", () => {
        const { roomState, vm } = createViewModel("Bob");
        expect(roomState.listenerCount(RoomStateEvent.Events)).toBe(1);

        vm.dispose();

        expect(roomState.listenerCount(RoomStateEvent.Events)).toBe(0);
    });
});
