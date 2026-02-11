/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import {
    EventTimeline,
    EventType,
    JoinRule,
    MatrixEvent,
    Room,
    RoomStateEvent,
    Visibility,
} from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";
import RoomSettingsDialog from "../../../../../src/components/views/dialogs/RoomSettingsDialog";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

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

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
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

        describe("people settings tab", () => {
            it("does not render when disabled and room join rule is not knock", () => {
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
                getComponent();
                expect(screen.queryByTestId("settings-tab-ROOM_PEOPLE_TAB")).not.toBeInTheDocument();
            });

            it("does not render when disabled and room join rule is knock", () => {
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
                getComponent();
                expect(screen.queryByTestId("settings-tab-ROOM_PEOPLE_TAB")).not.toBeInTheDocument();
            });

            it("does not render when enabled and room join rule is not knock", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation(
                    (setting) => setting === "feature_ask_to_join",
                );
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
                getComponent();
                expect(screen.queryByTestId("settings-tab-ROOM_PEOPLE_TAB")).not.toBeInTheDocument();
            });

            it("renders when enabled and room join rule is knock", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation(
                    (setting) => setting === "feature_ask_to_join",
                );
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
                getComponent();
                expect(screen.getByTestId("settings-tab-ROOM_PEOPLE_TAB")).toBeInTheDocument();
            });

            it("re-renders on room join rule changes", async () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation(
                    (setting) => setting === "feature_ask_to_join",
                );
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
                getComponent();
                jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
                mockClient.emit(
                    RoomStateEvent.Events,
                    new MatrixEvent({ content: {}, type: EventType.RoomJoinRules }),
                    room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                    null,
                );
                await waitFor(() =>
                    expect(screen.queryByTestId("settings-tab-ROOM_PEOPLE_TAB")).not.toBeInTheDocument(),
                );
            });
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

            fireEvent.click(screen.getByText("Polls"));

            expect(container.querySelector(".mx_SettingsTab")).toMatchSnapshot();
        });
    });
});
