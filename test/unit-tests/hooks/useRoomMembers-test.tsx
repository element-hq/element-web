/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor, renderHook, act } from "jest-matrix-react";
import { type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils";
import { useMyRoomMembership, useRoomMemberCount, useRoomMembers } from "../../../src/hooks/useRoomMembers";

describe("useRoomMembers", () => {
    function render(room: Room) {
        return renderHook(() => useRoomMembers(room));
    }

    let cli: MatrixClient;
    let room: Room;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = new Room("!room:server", cli, cli.getSafeUserId());
    });

    it("should update on RoomState.Members events", async () => {
        const { result } = render(room);

        expect(result.current).toHaveLength(0);

        act(() => {
            room.currentState.markOutOfBandMembersStarted();
            room.currentState.setOutOfBandMembers([
                new MatrixEvent({
                    type: "m.room.member",
                    state_key: "!user:server",
                    room_id: room.roomId,
                    content: {
                        membership: KnownMembership.Join,
                    },
                }),
            ]);
        });
        await waitFor(() => expect(result.current).toHaveLength(1));
    });
});

describe("useRoomMemberCount", () => {
    function render(room: Room) {
        return renderHook(() => useRoomMemberCount(room));
    }

    let cli: MatrixClient;
    let room: Room;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = new Room("!room:server", cli, cli.getSafeUserId());
    });

    it("should update on RoomState.Members events", async () => {
        const { result } = render(room);

        expect(result.current).toBe(0);

        act(() => {
            room.currentState.markOutOfBandMembersStarted();
            room.currentState.setOutOfBandMembers([
                new MatrixEvent({
                    type: "m.room.member",
                    state_key: "!user:server",
                    room_id: room.roomId,
                    content: {
                        membership: KnownMembership.Join,
                    },
                }),
            ]);
        });
        await waitFor(() => expect(result.current).toBe(1));
    });
});

describe("useMyRoomMembership", () => {
    function render(room: Room) {
        return renderHook(() => useMyRoomMembership(room));
    }

    let cli: MatrixClient;
    let room: Room;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = new Room("!room:server", cli, cli.getSafeUserId());
    });

    it("should update on RoomState.Members events", async () => {
        room.updateMyMembership(KnownMembership.Join);
        const { result } = render(room);

        expect(result.current).toBe(KnownMembership.Join);

        act(() => {
            room.updateMyMembership(KnownMembership.Leave);
        });
        await waitFor(() => expect(result.current).toBe(KnownMembership.Leave));
    });
});
