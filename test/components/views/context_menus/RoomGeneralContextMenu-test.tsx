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

import { fireEvent, getByLabelText, render } from "@testing-library/react";
import { mocked } from "jest-mock";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import React from "react";

import { ChevronFace } from "../../../../src/components/structures/ContextMenu";
import {
    RoomGeneralContextMenu,
    RoomGeneralContextMenuProps,
} from "../../../../src/components/views/context_menus/RoomGeneralContextMenu";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import RoomListStore from "../../../../src/stores/room-list/RoomListStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { mkMessage, stubClient } from "../../../test-utils/test-utils";

describe("RoomGeneralContextMenu", () => {
    const ROOM_ID = "!123:matrix.org";

    let room: Room;
    let mockClient: MatrixClient;

    let onFinished: () => void;

    function getComponent(props?: Partial<RoomGeneralContextMenuProps>) {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomGeneralContextMenu
                    room={room}
                    onFinished={onFinished}
                    {...props}
                    managed={true}
                    mountAsChild={true}
                    left={1}
                    top={1}
                    chevronFace={ChevronFace.Left}
                />
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        mockClient = mocked(MatrixClientPeg.get());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValueOnce([
            DefaultTagID.DM,
            DefaultTagID.Favourite,
        ]);

        onFinished = jest.fn();
    });

    it("renders an empty context menu for archived rooms", async () => {
        jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValueOnce([DefaultTagID.Archived]);

        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("renders the default context menu", async () => {
        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("marks the room as read", async () => {
        const event = mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            ts: 1000,
        });
        room.addLiveEvents([event], {});

        const { container } = getComponent({});

        const markAsReadBtn = getByLabelText(container, "Mark as read");
        fireEvent.click(markAsReadBtn);

        expect(mockClient.sendReadReceipt).toHaveBeenCalledWith(event, ReceiptType.Read, true);
        expect(onFinished).toHaveBeenCalled();
    });
});
