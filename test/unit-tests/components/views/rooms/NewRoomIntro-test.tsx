/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom } from "../../../../../src/models/LocalRoom";
import { filterConsole, mkRoomMemberJoinEvent, mkThirdPartyInviteEvent, stubClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import NewRoomIntro from "../../../../../src/components/views/rooms/NewRoomIntro";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { DirectoryMember } from "../../../../../src/utils/direct-messages";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

const renderNewRoomIntro = (client: MatrixClient, room: Room | LocalRoom) => {
    render(
        <MatrixClientContext.Provider value={client}>
            <ScopedRoomContextProvider {...({ room, roomId: room.roomId } as unknown as IRoomState)}>
                <NewRoomIntro />
            </ScopedRoomContextProvider>
        </MatrixClientContext.Provider>,
    );
};

describe("NewRoomIntro", () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    const userId = "@user:example.com";

    filterConsole("Room !room:example.com does not have an m.room.create event");

    beforeAll(() => {
        client = stubClient();
        DMRoomMap.makeShared(client);
    });

    describe("for a DM Room", () => {
        beforeEach(() => {
            jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            const room = new Room(roomId, client, client.getUserId()!);
            room.name = "test_room";
            renderNewRoomIntro(client, room);
        });

        it("should render the expected intro", () => {
            const expected = `This is the beginning of your direct message history with test_room.`;
            screen.getByText((id, element) => element?.tagName === "SPAN" && element?.textContent === expected);
        });
    });

    it("should render as expected for a DM room with a single third-party invite", () => {
        const room = new Room(roomId, client, client.getSafeUserId());
        room.currentState.setStateEvents([
            mkRoomMemberJoinEvent(client.getSafeUserId(), room.roomId),
            mkThirdPartyInviteEvent(client.getSafeUserId(), "user@example.com", room.roomId),
        ]);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
        jest.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([room.roomId]));
        renderNewRoomIntro(client, room);

        expect(screen.getByText("Once everyone has joined, you’ll be able to chat")).toBeInTheDocument();
        expect(
            screen.queryByText(
                "Only the two of you are in this conversation, unless either of you invites anyone to join.",
            ),
        ).not.toBeInTheDocument();
    });

    describe("for a DM LocalRoom", () => {
        beforeEach(() => {
            jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            const localRoom = new LocalRoom(roomId, client, client.getUserId()!);
            localRoom.name = "test_room";
            localRoom.targets.push(new DirectoryMember({ user_id: userId }));
            renderNewRoomIntro(client, localRoom);
        });

        it("should render the expected intro", () => {
            const expected = `Send your first message to invite test_room to chat`;
            screen.getByText((id, element) => element?.tagName === "SPAN" && element?.textContent === expected);
        });
    });
});
