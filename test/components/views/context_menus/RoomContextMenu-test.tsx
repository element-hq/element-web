/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.
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
import SettingsStore from "../../../../src/settings/SettingsStore";

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
        mockClient = mocked(MatrixClientPeg.safeGet());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        onFinished = jest.fn();
    });

    function renderComponent(props: Partial<ComponentProps<typeof RoomContextMenu>> = {}) {
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContextMenu room={room} onFinished={onFinished} {...props} />
            </MatrixClientContext.Provider>,
        );
    }

    it("does not render invite menu item when UIComponent customisations disable invite", () => {
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        mocked(shouldShowComponent).mockReturnValue(false);

        renderComponent();

        expect(screen.queryByRole("menuitem", { name: "Invite" })).not.toBeInTheDocument();
    });

    it("renders invite menu item when UIComponent customisations enable invite", () => {
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        mocked(shouldShowComponent).mockReturnValue(true);

        renderComponent();

        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
    });

    it("when developer mode is disabled, it should not render the developer tools option", () => {
        renderComponent();
        expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
    });

    describe("when developer mode is enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "developerMode");
        });

        it("should render the developer tools option", () => {
            renderComponent();
            expect(screen.getByText("Developer tools")).toBeInTheDocument();
        });
    });
});
