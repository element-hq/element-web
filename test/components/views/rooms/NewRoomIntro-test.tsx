/*
Copyright 2015 - 2022 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { render, screen } from "@testing-library/react";
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom } from "../../../../src/models/LocalRoom";
import { createTestClient } from "../../../test-utils";
import RoomContext from "../../../../src/contexts/RoomContext";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import NewRoomIntro from "../../../../src/components/views/rooms/NewRoomIntro";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { DirectoryMember } from "../../../../src/utils/direct-messages";

const renderNewRoomIntro = (client: MatrixClient, room: Room|LocalRoom) => {
    render(
        <MatrixClientContext.Provider value={client}>
            <RoomContext.Provider value={{ room, roomId: room.roomId } as unknown as IRoomState}>
                <NewRoomIntro />
            </RoomContext.Provider>
        </MatrixClientContext.Provider>,
    );
};

describe("NewRoomIntro", () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    const userId = "@user:example.com";

    beforeEach(() => {
        client = createTestClient();
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
        DMRoomMap.makeShared();
    });

    describe("for a DM Room", () => {
        beforeEach(() => {
            jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            renderNewRoomIntro(client, new Room(roomId, client, client.getUserId()));
        });

        it("should render the expected intro", () => {
            const expected = `This is the beginning of your direct message history with ${userId}.`;
            screen.getByText((id, element) => element.tagName === "SPAN" && element.textContent === expected);
        });
    });

    describe("for a DM LocalRoom", () => {
        beforeEach(() => {
            jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            const localRoom = new LocalRoom(roomId, client, client.getUserId());
            localRoom.targets.push(new DirectoryMember({ user_id: userId }));
            renderNewRoomIntro(client, localRoom);
        });

        it("should render the expected intro", () => {
            const expected = `Send your first message to invite ${userId} to chat`;
            screen.getByText((id, element) => element.tagName === "SPAN" && element.textContent === expected);
        });
    });
});
