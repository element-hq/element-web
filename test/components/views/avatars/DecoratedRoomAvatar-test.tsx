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

import { render, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";
import { JoinRule, MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import React from "react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { stubClient } from "../../../test-utils";
import DecoratedRoomAvatar from "../../../../src/components/views/avatars/DecoratedRoomAvatar";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

jest.mock("../../../../src/utils/presence", () => ({ isPresenceEnabled: jest.fn().mockReturnValue(true) }));

jest.mock("../../../../src/utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: jest.fn().mockReturnValue([0, 1]),
}));

describe("DecoratedRoomAvatar", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;

    function renderComponent() {
        return render(<DecoratedRoomAvatar room={room} size="32px" />, {
            wrapper: TooltipProvider,
        });
    }

    beforeEach(() => {
        stubClient();
        mockClient = mocked(MatrixClientPeg.safeGet());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows an avatar with globe icon and tooltip for public room", async () => {
        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        room.getJoinRule = jest.fn().mockReturnValue(JoinRule.Public);

        const { container, asFragment } = renderComponent();

        const globe = container.querySelector(".mx_DecoratedRoomAvatar_icon_globe")!;
        expect(globe).toBeVisible();
        await userEvent.hover(globe!);

        // wait for the tooltip to open
        const tooltip = await waitFor(() => {
            const tooltip = document.getElementById(globe.getAttribute("aria-describedby")!);
            expect(tooltip).toBeVisible();
            return tooltip;
        });
        expect(tooltip).toHaveTextContent("This room is public");

        expect(asFragment()).toMatchSnapshot();
    });

    it("shows the presence indicator in a DM room that also has functional members", async () => {
        const DM_USER_ID = "@bob:foo.bar";
        const dmRoomMap = {
            getUserIdForRoomId: () => {
                return DM_USER_ID;
            },
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        jest.spyOn(DecoratedRoomAvatar.prototype as any, "getPresenceIcon").mockImplementation(() => "ONLINE");

        const { container, asFragment } = renderComponent();

        const presence = container.querySelector(".mx_DecoratedRoomAvatar_icon")!;
        expect(presence).toBeVisible();
        await userEvent.hover(presence!);

        // wait for the tooltip to open
        const tooltip = await waitFor(() => {
            const tooltip = document.getElementById(presence.getAttribute("aria-describedby")!);
            expect(tooltip).toBeVisible();
            return tooltip;
        });
        expect(tooltip).toHaveTextContent("Online");

        expect(asFragment()).toMatchSnapshot();
    });
});
