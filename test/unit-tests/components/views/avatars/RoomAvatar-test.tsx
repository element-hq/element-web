/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import RoomAvatar from "../../../../../src/components/views/avatars/RoomAvatar";
import { filterConsole, stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { LocalRoom } from "../../../../../src/models/LocalRoom";
import * as AvatarModule from "../../../../../src/Avatar";
import { DirectoryMember } from "../../../../../src/utils/direct-messages";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";

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
        SettingsStore.setValue(
            "showAvatarsOnInvites",
            null,
            SettingLevel.ACCOUNT,
            SettingsStore.getDefaultValue("showAvatarsOnInvites"),
        );
    });

    it("should render as expected for a Room", () => {
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        room.name = "test room";
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
    });

    it("should render as expected for a DM room", () => {
        const userId = "@dm_user@example.com";
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        room.name = "DM room";
        mocked(DMRoomMap.shared().getUserIdForRoomId).mockReturnValue(userId);
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
    });

    it("should render as expected for a LocalRoom", () => {
        const userId = "@local_room_user@example.com";
        const localRoom = new LocalRoom("!room:example.com", client, client.getSafeUserId());
        localRoom.name = "local test room";
        localRoom.targets.push(new DirectoryMember({ user_id: userId }));
        expect(render(<RoomAvatar room={localRoom} />).container).toMatchSnapshot();
    });
    it("should render an avatar for a room the user is invited to", () => {
        SettingsStore.setValue("showAvatarsOnInvites", null, SettingLevel.ACCOUNT, true);
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        jest.spyOn(room, "getMxcAvatarUrl").mockImplementation(() => "mxc://example.com/foobar");
        room.name = "test room";
        room.updateMyMembership("invite");
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
    });
    it("should not render an invite avatar if the user has disabled it", () => {
        SettingsStore.setValue("showAvatarsOnInvites", null, SettingLevel.ACCOUNT, false);
        const room = new Room("!room:example.com", client, client.getSafeUserId());
        room.name = "test room";
        room.updateMyMembership("invite");
        expect(render(<RoomAvatar room={room} />).container).toMatchSnapshot();
    });
});
