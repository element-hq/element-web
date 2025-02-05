/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getByTestId, render, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient, PendingEventOrdering, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import React, { type ComponentProps } from "react";

import MemberAvatar from "../../../../../src/components/views/avatars/MemberAvatar";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { getRoomContext } from "../../../../test-utils/room";
import { stubClient } from "../../../../test-utils/test-utils";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

describe("MemberAvatar", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;
    let member: RoomMember;

    function getComponent(props: Partial<ComponentProps<typeof MemberAvatar>>) {
        return (
            <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                <MemberAvatar member={null} size="35px" {...props} />
            </ScopedRoomContextProvider>
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
