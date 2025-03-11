/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import { mkRoom, stubClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { RoomListItemView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListItemView";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import {
    type RoomListItemViewState,
    useRoomListItemViewModel,
} from "../../../../../../src/components/viewmodels/roomlist/RoomListItemViewModel";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListItemViewModel", () => ({
    useRoomListItemViewModel: jest.fn(),
}));

describe("<RoomListItemView />", () => {
    const defaultValue: RoomListItemViewState = {
        openRoom: jest.fn(),
        showHoverMenu: false,
    };
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        mocked(useRoomListItemViewModel).mockReturnValue(defaultValue);
        matrixClient = stubClient();
        room = mkRoom(matrixClient, "room1");

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
    });

    test("should render a room item", () => {
        const onClick = jest.fn();
        const { asFragment } = render(<RoomListItemView room={room} onClick={onClick} />);
        expect(asFragment()).toMatchSnapshot();
    });

    test("should call openRoom when clicked", async () => {
        const user = userEvent.setup();
        render(<RoomListItemView room={room} />);

        await user.click(screen.getByRole("button", { name: `Open room ${room.name}` }));
        expect(defaultValue.openRoom).toHaveBeenCalled();
    });

    test("should hover decoration if hovered", async () => {
        mocked(useRoomListItemViewModel).mockReturnValue({ ...defaultValue, showHoverMenu: true });

        const user = userEvent.setup();
        render(<RoomListItemView room={room} />, withClientContextRenderOptions(matrixClient));
        const listItem = screen.getByRole("button", { name: `Open room ${room.name}` });
        expect(screen.queryByRole("button", { name: "More Options" })).toBeNull();

        await user.hover(listItem);
        await waitFor(() => expect(screen.getByRole("button", { name: "More Options" })).toBeInTheDocument());
    });
});
