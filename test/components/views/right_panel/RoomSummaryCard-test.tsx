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
import { render, fireEvent, screen } from "@testing-library/react";
import { EventType, MatrixEvent, Room, MatrixClient, JoinRule } from "matrix-js-sdk/src/matrix";
import { mocked, MockedObject } from "jest-mock";

import DMRoomMap from "../../../../src/utils/DMRoomMap";
import RoomSummaryCard from "../../../../src/components/views/right_panel/RoomSummaryCard";
import ShareDialog from "../../../../src/components/views/dialogs/ShareDialog";
import ExportDialog from "../../../../src/components/views/dialogs/ExportDialog";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import * as settingsHooks from "../../../../src/hooks/useSettings";
import Modal from "../../../../src/Modal";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";
import { PollHistoryDialog } from "../../../../src/components/views/dialogs/PollHistoryDialog";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { _t } from "../../../../src/languageHandler";

describe("<RoomSummaryCard />", () => {
    const userId = "@alice:domain.org";

    const roomId = "!room:domain.org";
    let mockClient!: MockedObject<MatrixClient>;
    let room!: Room;

    const getComponent = (props = {}) => {
        const defaultProps = {
            room,
            onClose: jest.fn(),
            permalinkCreator: new RoomPermalinkCreator(room),
        };

        return render(<RoomSummaryCard {...defaultProps} {...props} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });
    };

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            getAccountData: jest.fn(),
            isRoomEncrypted: jest.fn(),
            getOrCreateFilter: jest.fn().mockResolvedValue({ filterId: 1 }),
            getRoom: jest.fn(),
        });
        room = new Room(roomId, mockClient, userId);
        const roomCreateEvent = new MatrixEvent({
            type: "m.room.create",
            room_id: roomId,
            sender: userId,
            content: {
                creator: userId,
                room_version: "5",
            },
            state_key: "",
        });
        room.currentState.setStateEvents([roomCreateEvent]);

        jest.spyOn(Modal, "createDialog");
        jest.spyOn(RightPanelStore.instance, "pushCard");
        jest.spyOn(settingsHooks, "useFeatureEnabled").mockReturnValue(false);
        jest.spyOn(defaultDispatcher, "dispatch");
        jest.clearAllMocks();
        DMRoomMap.makeShared(mockClient);

        mockClient.getRoom.mockReturnValue(room);
        jest.spyOn(room, "isElementVideoRoom").mockRestore();
        jest.spyOn(room, "isCallRoom").mockRestore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the room summary", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("opens the search", async () => {
        const onSearchClick = jest.fn();
        const { getByLabelText } = getComponent({
            onSearchClick,
        });

        const searchBtn = getByLabelText(_t("action|search"));
        fireEvent.click(searchBtn);
        expect(onSearchClick).toHaveBeenCalled();
    });

    it("opens room members list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("People"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith(
            { phase: RightPanelPhases.RoomMemberList },
            true,
        );
    });

    it("opens room file panel on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Files"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.FilePanel }, true);
    });

    it("opens room export dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Export chat"));

        expect(Modal.createDialog).toHaveBeenCalledWith(ExportDialog, { room });
    });

    it("opens share room dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Share room"));

        expect(Modal.createDialog).toHaveBeenCalledWith(ShareDialog, { target: room });
    });

    it("opens room settings on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Room settings"));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "open_room_settings" });
    });

    describe("pinning", () => {
        it("renders pins options when pinning feature is enabled", () => {
            mocked(settingsHooks.useFeatureEnabled).mockImplementation((feature) => feature === "feature_pinning");
            const { getByText } = getComponent();

            expect(getByText("Pinned")).toBeInTheDocument();
        });
    });

    describe("poll history", () => {
        it("renders poll history option", () => {
            const { getByText } = getComponent();

            expect(getByText("Poll history")).toBeInTheDocument();
        });

        it("opens poll history dialog on button click", () => {
            const permalinkCreator = new RoomPermalinkCreator(room);
            const { getByText } = getComponent({ permalinkCreator });

            fireEvent.click(getByText("Poll history"));

            expect(Modal.createDialog).toHaveBeenCalledWith(PollHistoryDialog, {
                room,
                matrixClient: mockClient,
                permalinkCreator: permalinkCreator,
            });
        });
    });

    describe("video rooms", () => {
        it("does not render irrelevant options for element video room", () => {
            jest.spyOn(room, "isElementVideoRoom").mockReturnValue(true);
            mocked(settingsHooks.useFeatureEnabled).mockImplementation(
                (feature) => feature === "feature_video_rooms" || feature === "feature_pinning",
            );
            const { queryByText } = getComponent();

            // options not rendered
            expect(queryByText("Files")).not.toBeInTheDocument();
            expect(queryByText("Pinned")).not.toBeInTheDocument();
            expect(queryByText("Export chat")).not.toBeInTheDocument();
        });

        it("does not render irrelevant options for element call room", () => {
            jest.spyOn(room, "isCallRoom").mockReturnValue(true);
            mocked(settingsHooks.useFeatureEnabled).mockImplementation(
                (feature) =>
                    feature === "feature_element_call_video_rooms" ||
                    feature === "feature_video_rooms" ||
                    feature === "feature_pinning",
            );
            const { queryByText } = getComponent();

            // options not rendered
            expect(queryByText("Files")).not.toBeInTheDocument();
            expect(queryByText("Pinned")).not.toBeInTheDocument();
            expect(queryByText("Export chat")).not.toBeInTheDocument();
        });
    });

    describe("public room label", () => {
        beforeEach(() => {
            jest.spyOn(room.currentState, "getJoinRule").mockReturnValue(JoinRule.Public);
        });

        it("does not show public room label for a DM", async () => {
            mockClient.getAccountData.mockImplementation(
                (eventType) =>
                    ({
                        [EventType.Direct]: new MatrixEvent({
                            type: EventType.Direct,
                            content: {
                                "@bob:sesame.st": ["some-room-id"],
                                // this room is a DM with ernie
                                "@ernie:sesame.st": ["some-other-room-id", room.roomId],
                            },
                        }),
                    }[eventType]),
            );
            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).not.toBeInTheDocument();
        });

        it("does not show public room label for non public room", async () => {
            jest.spyOn(room.currentState, "getJoinRule").mockReturnValue(JoinRule.Invite);
            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).not.toBeInTheDocument();
        });

        it("shows a public room label for a public room", async () => {
            jest.spyOn(room.currentState, "getJoinRule").mockReturnValue(JoinRule.Public);
            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).toBeInTheDocument();
        });
    });
});
