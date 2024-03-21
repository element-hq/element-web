/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react-hooks/dom";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils";
import { useMyRoomMembership, useRoomMemberCount, useRoomMembers } from "../../src/hooks/useRoomMembers";

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
                        membership: "join",
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
                        membership: "join",
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
        room.updateMyMembership("join");
        const { result } = render(room);

        expect(result.current).toBe("join");

        act(() => {
            room.updateMyMembership("leave");
        });
        await waitFor(() => expect(result.current).toBe("leave"));
    });
});
