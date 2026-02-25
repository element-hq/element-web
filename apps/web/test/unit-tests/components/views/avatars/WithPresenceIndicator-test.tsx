/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient, PendingEventOrdering, Room, RoomMember, User } from "matrix-js-sdk/src/matrix";
import React from "react";
import userEvent from "@testing-library/user-event";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import WithPresenceIndicator from "../../../../../src/components/views/avatars/WithPresenceIndicator";
import { isPresenceEnabled } from "../../../../../src/utils/presence";

jest.mock("../../../../../src/utils/presence");

jest.mock("../../../../../src/utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: jest.fn().mockReturnValue([1, 2]),
}));

describe("WithPresenceIndicator", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;

    function renderComponent() {
        return render(
            <WithPresenceIndicator room={room} size="32px">
                <span />
            </WithPresenceIndicator>,
        );
    }

    beforeEach(() => {
        stubClient();
        mockClient = mocked(MatrixClientPeg.safeGet());
        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders only child if presence is disabled", async () => {
        mocked(isPresenceEnabled).mockReturnValue(false);
        const { container } = renderComponent();

        expect(container.children).toHaveLength(1);
        expect(container.children[0].tagName).toBe("SPAN");
    });

    it.each([
        ["online", "Online"],
        ["offline", "Offline"],
        ["unavailable", "Away"],
    ])("renders presence indicator with tooltip for DM rooms", async (presenceStr, renderedStr) => {
        mocked(isPresenceEnabled).mockReturnValue(true);
        const DM_USER_ID = "@bob:foo.bar";
        const dmRoomMap = {
            getUserIdForRoomId: () => {
                return DM_USER_ID;
            },
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        room.getMember = jest.fn((userId) => {
            const member = new RoomMember(room.roomId, userId);
            member.user = new User(userId);
            member.user.presence = presenceStr;
            return member;
        });

        const { container, asFragment } = renderComponent();

        const presence = container.querySelector(".mx_WithPresenceIndicator_icon")!;
        expect(presence).toBeVisible();
        await userEvent.hover(presence!);

        // wait for the tooltip to open
        const tooltip = await waitFor(() => {
            const tooltip = document.getElementById(presence.getAttribute("aria-labelledby")!);
            expect(tooltip).toBeVisible();
            return tooltip;
        });
        expect(tooltip).toHaveTextContent(renderedStr);

        expect(asFragment()).toMatchSnapshot();
    });
});
