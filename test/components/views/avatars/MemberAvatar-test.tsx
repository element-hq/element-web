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

import { getByTestId, render, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import React, { ComponentProps } from "react";

import MemberAvatar from "../../../../src/components/views/avatars/MemberAvatar";
import RoomContext from "../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { getRoomContext } from "../../../test-utils/room";
import { stubClient } from "../../../test-utils/test-utils";

describe("MemberAvatar", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;
    let member: RoomMember;

    function getComponent(props: Partial<ComponentProps<typeof MemberAvatar>>) {
        return (
            <RoomContext.Provider value={getRoomContext(room, {})}>
                <MemberAvatar member={null} width={35} height={35} {...props} />
            </RoomContext.Provider>
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        mockClient = mocked(MatrixClientPeg.safeGet());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        member = new RoomMember(ROOM_ID, "@bob:example.org");
        jest.spyOn(room, "getMember").mockReturnValue(member);
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue("http://placekitten.com/400/400");
    });

    it("shows an avatar for useOnlyCurrentProfiles", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
            return settingName === "useOnlyCurrentProfiles";
        });

        const { container } = render(getComponent({}));

        let avatar: HTMLElement;
        await waitFor(() => {
            avatar = getByTestId(container, "avatar-img");
            expect(avatar).toBeInTheDocument();
        });

        expect(avatar!.getAttribute("src")).not.toBe("");
    });
});
