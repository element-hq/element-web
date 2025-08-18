/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render } from "jest-matrix-react";
import { VirtuosoMockContext } from "react-virtuoso";

import { mkRoom, stubClient } from "../../../../../test-utils";
import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomList";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";

describe("<RoomList />", () => {
    let matrixClient: MatrixClient;
    let vm: RoomListViewState;

    beforeEach(() => {
        matrixClient = stubClient();
        const rooms = Array.from({ length: 10 }, (_, i) => mkRoom(matrixClient, `room${i}`));
        vm = {
            isLoadingRooms: false,
            roomsState: { spaceId: "home", rooms },
            primaryFilters: [],
            createRoom: jest.fn(),
            createChatRoom: jest.fn(),
            canCreateRoom: true,
            activeIndex: undefined,
        };

        // Needed to render a room list cell
        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
    });

    it("should render a room list", () => {
        const { asFragment } = render(<RoomList vm={vm} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={matrixClient}>
                    <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 56 }}>
                        <>{children}</>
                    </VirtuosoMockContext.Provider>
                </MatrixClientContext.Provider>
            ),
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
