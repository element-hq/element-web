/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render } from "jest-matrix-react";

import { mkRoom, stubClient } from "../../../../../test-utils";
import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomList";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import { SecondaryFilters } from "../../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { SortOption } from "../../../../../../src/components/viewmodels/roomlist/useSorter";

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
        vm = {
            rooms,
            primaryFilters: [],
            activateSecondaryFilter: () => {},
            activeSecondaryFilter: SecondaryFilters.AllActivity,
            sort: jest.fn(),
            activeSortOption: SortOption.Activity,
            shouldShowMessagePreview: false,
            toggleMessagePreview: jest.fn(),
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
        const { asFragment } = render(<RoomList vm={vm} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
