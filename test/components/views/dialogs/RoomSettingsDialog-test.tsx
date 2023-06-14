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

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Room, Visibility } from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";
import RoomSettingsDialog from "../../../../src/components/views/dialogs/RoomSettingsDialog";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../src/settings/UIFeature";

describe("<RoomSettingsDialog />", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getRoom: jest.fn(),
        getDomain: jest.fn().mockReturnValue("server.org"),
        getLocalAliases: jest.fn().mockResolvedValue({ aliases: [] }),
        getRoomDirectoryVisibility: jest.fn().mockResolvedValue({ visibility: Visibility.Private }),
        getOrCreateFilter: jest.fn(),
    });

    const roomId = "!room:server.org";
    const room = new Room(roomId, mockClient, userId);
    room.name = "Test Room";
    const room2 = new Room("!room2:server.org", mockClient, userId);
    room2.name = "Another Room";

    jest.spyOn(SettingsStore, "getValue");

    beforeEach(() => {
        jest.clearAllMocks();

        mockClient.getRoom.mockImplementation((roomId) => {
            if (roomId === room.roomId) return room;
            if (roomId === room2.roomId) return room2;
            return null;
        });

        jest.spyOn(SettingsStore, "getValue").mockReset().mockReturnValue(false);
    });

    const getComponent = (onFinished = jest.fn(), propRoomId = roomId) =>
        render(<RoomSettingsDialog roomId={propRoomId} onFinished={onFinished} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    it("catches errors when room is not found", () => {
        getComponent(undefined, "!room-that-does-not-exist");
        expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    });

    it("updates when roomId prop changes", () => {
        const { rerender, getByText } = getComponent(undefined, roomId);

        expect(getByText(`Room Settings - ${room.name}`)).toBeInTheDocument();

        rerender(<RoomSettingsDialog roomId={room2.roomId} onFinished={jest.fn()} />);

        expect(getByText(`Room Settings - ${room2.name}`)).toBeInTheDocument();
    });

    describe("Settings tabs", () => {
        it("renders default tabs correctly", () => {
            const { container } = getComponent();
            expect(container.querySelectorAll(".mx_TabbedView_tabLabel")).toMatchSnapshot();
        });

        it("renders voip settings tab when enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_group_calls",
            );
            getComponent();
            expect(screen.getByTestId("settings-tab-ROOM_VOIP_TAB")).toBeInTheDocument();
        });

        it("renders bridges settings tab when enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_bridge_state",
            );
            getComponent();
            expect(screen.getByTestId("settings-tab-ROOM_BRIDGES_TAB")).toBeInTheDocument();
        });

        it("renders advanced settings tab when enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.AdvancedSettings,
            );
            getComponent();
            expect(screen.getByTestId("settings-tab-ROOM_ADVANCED_TAB")).toBeInTheDocument();
        });
    });

    describe("poll history", () => {
        beforeEach(() => {
            mockClient.getOrCreateFilter.mockResolvedValue("filterId");
        });
        it("renders poll history tab", () => {
            getComponent();
            expect(screen.getByTestId("settings-tab-ROOM_POLL_HISTORY_TAB")).toBeInTheDocument();
        });

        it("displays poll history when tab clicked", () => {
            const { container } = getComponent();

            fireEvent.click(screen.getByText("Poll history"));

            expect(container.querySelector(".mx_SettingsTab")).toMatchSnapshot();
        });
    });
});
