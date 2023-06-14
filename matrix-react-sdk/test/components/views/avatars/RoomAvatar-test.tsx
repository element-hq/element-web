/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { render } from "@testing-library/react";
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import RoomAvatar from "../../../../src/components/views/avatars/RoomAvatar";
import { filterConsole, stubClient } from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { LocalRoom } from "../../../../src/models/LocalRoom";
import * as AvatarModule from "../../../../src/Avatar";
import { DirectoryMember } from "../../../../src/utils/direct-messages";

describe("RoomAvatar", () => {
    let client: MatrixClient;

    filterConsole(
        // unrelated for this test
        "Room !room:example.com does not have an m.room.create event",
    );

    beforeAll(() => {
        client = stubClient();
        const dmRoomMap = new DMRoomMap(client);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        jest.spyOn(AvatarModule, "defaultAvatarUrlForString");
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    afterEach(() => {
        mocked(DMRoomMap.shared().getUserIdForRoomId).mockReset();
        mocked(AvatarModule.defaultAvatarUrlForString).mockClear();
    });

    it("should render as expected for a Room", () => {
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        room.name = "test room";
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
        expect(AvatarModule.defaultAvatarUrlForString).toHaveBeenCalledWith(room.roomId);
    });

    it("should render as expected for a DM room", () => {
        const userId = "@dm_user@example.com";
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        room.name = "DM room";
        mocked(DMRoomMap.shared().getUserIdForRoomId).mockReturnValue(userId);
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
        expect(AvatarModule.defaultAvatarUrlForString).toHaveBeenCalledWith(userId);
    });

    it("should render as expected for a LocalRoom", () => {
        const userId = "@local_room_user@example.com";
        const localRoom = new LocalRoom("!room:example.com", client, client.getSafeUserId());
        localRoom.name = "local test room";
        localRoom.targets.push(new DirectoryMember({ user_id: userId }));
        expect(render(<RoomAvatar room={localRoom} />).container).toMatchSnapshot();
        expect(AvatarModule.defaultAvatarUrlForString).toHaveBeenCalledWith(userId);
    });
});
