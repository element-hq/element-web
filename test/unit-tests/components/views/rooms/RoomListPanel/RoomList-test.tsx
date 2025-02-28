/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render } from "jest-matrix-react";

import { createTestClient, mkRoom } from "../../../../../test-utils";
import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomList";

describe("<RoomList />", () => {
    let matrixClient: MatrixClient;
    let vm: RoomListViewState;

    beforeEach(() => {
        matrixClient = createTestClient();
        const rooms = Array.from({ length: 10 }, (_, i) => mkRoom(matrixClient, `room${i}`));
        vm = { rooms };
    });

    it("renders a Default RoomList", () => {
        const { asFragment } = render(<RoomList vm={vm} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
