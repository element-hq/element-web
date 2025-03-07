/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { mkRoom, stubClient } from "../../../../../test-utils";
import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomList";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";

describe("<RoomList />", () => {
    let matrixClient: MatrixClient;
    let vm: RoomListViewState;

    beforeEach(() => {
        // Needed to render the virtualized list in rtl tests
        // https://github.com/bvaughn/react-virtualized/issues/493#issuecomment-640084107
        jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1500);
        jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1500);

        matrixClient = stubClient();
        const rooms = Array.from({ length: 10 }, (_, i) => mkRoom(matrixClient, `room${i}`));
        vm = { rooms, openRoom: jest.fn() };

        // Needed to render a room list cell
        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
    });

    async function renderList() {
        const renderResult = render(<RoomList vm={vm} />);
        // Wait for the row role to be removed
        await waitFor(() => expect(screen.queryByRole("row")).toBeNull());
        return renderResult;
    }

    it("should render a room list", async () => {
        const { asFragment } = await renderList();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should open the room", async () => {
        const user = userEvent.setup();

        await renderList();
        await waitFor(async () => {
            expect(screen.getByRole("option", { name: "Open room room9" })).toBeVisible();
            await user.click(screen.getByRole("option", { name: "Open room room9" }));
        });
        expect(vm.openRoom).toHaveBeenCalledWith(vm.rooms[9].roomId);
    });

    it("should remove the role attribute", async () => {
        await renderList();

        const rowElement = screen.getByRole("listbox").children.item(0)!;
        expect(rowElement).not.toHaveAttribute("role");

        rowElement.setAttribute("role", "row");
        await waitFor(() => expect(rowElement).not.toHaveAttribute("role"));
    });
});
