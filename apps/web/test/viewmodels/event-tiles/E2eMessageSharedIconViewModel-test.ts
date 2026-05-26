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
const OTHER_USER_ID = "@alice:example.com";
const ROOM_ID = "!roomId";
const OTHER_ROOM_ID = "!otherRoomId";

function createGetMember(
    displayNames: Record<string, string | undefined>,
): jest.Mock<RoomMember | null, [userId: string]> {
    const getMember = jest.fn((userId: string): RoomMember | null => {
        const displayName = displayNames[userId];
        if (displayName === undefined) return null;

        return { rawDisplayName: displayName } as RoomMember;
    });

    return getMember;
}

function createRoomState(displayNames: Record<string, string | undefined> = {}): TestRoomState {
    const getMember = createGetMember(displayNames);

    return Object.assign(new EventEmitter(), { getMember }) as TestRoomState;
}

function createRoom(roomState: RoomState): Room {
    const room = {
        getLiveTimeline: jest.fn(() => ({
            getState: jest.fn((timeline: EventTimeline) => {
                expect(timeline).toBe(EventTimeline.FORWARDS);
                return roomState;
            }),
        })),
    } as unknown as Room;

    return room;
}

function createClient(roomStates: Record<string, RoomState | undefined>): MatrixClient {
    return {
        getRoom: jest.fn((roomId: string) => {
            const roomState = roomStates[roomId];

            return roomState ? createRoom(roomState) : null;
        }),
    } as unknown as MatrixClient;
}

function createViewModel(displayName?: string): {
    roomState: TestRoomState;
    vm: E2eMessageSharedIconViewModel;
} {
    const roomState = createRoomState({ [USER_ID]: displayName });
    const client = createClient({ [ROOM_ID]: roomState as unknown as RoomState });
    const vm = new E2eMessageSharedIconViewModel({
        client,
        roomId: ROOM_ID,
        keyForwardingUserId: USER_ID,
    });

    return { roomState, vm };
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

    it("falls back to the user ID when the room is unavailable", () => {
        const client = createClient({});
        const vm = new E2eMessageSharedIconViewModel({
            client,
            roomId: ROOM_ID,
            keyForwardingUserId: USER_ID,
        });

        expect(vm.getSnapshot()).toMatchObject({
            displayName: USER_ID,
            userId: USER_ID,
        });
        expect(() => vm.dispose()).not.toThrow();
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

    it("updates when the key forwarding user changes", () => {
        const roomState = createRoomState({
            [USER_ID]: "Bob",
            [OTHER_USER_ID]: "Alice",
        });
        const client = createClient({ [ROOM_ID]: roomState as unknown as RoomState });
        const vm = new E2eMessageSharedIconViewModel({
            client,
            roomId: ROOM_ID,
            keyForwardingUserId: USER_ID,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setKeyForwardingUserId(OTHER_USER_ID);

        expect(vm.getSnapshot()).toMatchObject({
            displayName: "Alice",
            userId: OTHER_USER_ID,
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates and rebinds its room state listener when the room changes", () => {
        const originalRoomState = createRoomState({ [USER_ID]: "Bob" });
        const newRoomState = createRoomState({ [USER_ID]: "Alice" });
        const client = createClient({
            [ROOM_ID]: originalRoomState as unknown as RoomState,
            [OTHER_ROOM_ID]: newRoomState as unknown as RoomState,
        });
        const vm = new E2eMessageSharedIconViewModel({
            client,
            roomId: ROOM_ID,
            keyForwardingUserId: USER_ID,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setRoomId(OTHER_ROOM_ID);

        expect(originalRoomState.listenerCount(RoomStateEvent.Events)).toBe(0);
        expect(newRoomState.listenerCount(RoomStateEvent.Events)).toBe(1);
        expect(vm.getSnapshot().displayName).toBe("Alice");
        expect(listener).toHaveBeenCalledTimes(1);

        originalRoomState.getMember.mockReturnValue({ rawDisplayName: "Ignored" } as RoomMember);
        originalRoomState.emit(RoomStateEvent.Events);

        expect(vm.getSnapshot().displayName).toBe("Alice");
        expect(listener).toHaveBeenCalledTimes(1);

        newRoomState.getMember.mockReturnValue({ rawDisplayName: "Carol" } as RoomMember);
        newRoomState.emit(RoomStateEvent.Events);

        expect(vm.getSnapshot().displayName).toBe("Carol");
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("does not emit updates when setters receive unchanged values", () => {
        const { vm } = createViewModel("Bob");
        const listener = jest.fn();
        vm.subscribe(listener);

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
