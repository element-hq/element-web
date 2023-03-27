/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import { render, screen } from "@testing-library/react";
import React, { ComponentProps } from "react";
import { mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContextMenu from "../../../../src/components/views/context_menus/RoomContextMenu";
import { shouldShowComponent } from "../../../../src/customisations/helpers/UIComponents";
import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

jest.mock("../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("RoomContextMenu", () => {
    const ROOM_ID = "!123:matrix.org";

    let room: Room;
    let mockClient: MatrixClient;

    let onFinished: () => void;

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

        onFinished = jest.fn();
    });

    function getComponent(props: Partial<ComponentProps<typeof RoomContextMenu>> = {}) {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContextMenu room={room} onFinished={onFinished} {...props} />
            </MatrixClientContext.Provider>,
        );
    }

    it("does not render invite menu item when UIComponent customisations disable invite", () => {
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        mocked(shouldShowComponent).mockReturnValue(false);

        getComponent();

        expect(screen.queryByRole("menuitem", { name: "Invite" })).not.toBeInTheDocument();
    });

    it("renders invite menu item when UIComponent customisations enable invite", () => {
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        mocked(shouldShowComponent).mockReturnValue(true);

        getComponent();

        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
    });
});
