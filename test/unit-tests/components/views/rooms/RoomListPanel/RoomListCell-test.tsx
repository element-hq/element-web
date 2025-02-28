/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { mkRoom, stubClient } from "../../../../../test-utils";
import { RoomListCell } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListCell";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";

describe("<RoomListCell />", () => {
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        matrixClient = stubClient();
        room = mkRoom(matrixClient, "room1");

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
    });

    test("should render a room cell", () => {
        const onClick = jest.fn();
        const { asFragment } = render(<RoomListCell room={room} onClick={onClick} />);
        expect(asFragment()).toMatchSnapshot();
    });

    test("should call onClick when clicked", async () => {
        const user = userEvent.setup();

        const onClick = jest.fn();
        render(<RoomListCell room={room} onClick={onClick} />);

        await user.click(screen.getByRole("button", { name: `Open room ${room.name}` }));
        expect(onClick).toHaveBeenCalled();
    });
});
