/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent, screen } from "jest-matrix-react";
import { Room, type MatrixClient, JoinRule, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked, type MockedObject } from "jest-mock";

import RoomSummaryCardView from "../../../../../src/components/views/right_panel/RoomSummaryCardView";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import * as settingsHooks from "../../../../../src/hooks/useSettings";
import Modal from "../../../../../src/Modal";
import { flushPromises, stubClient, untilDispatch } from "../../../../test-utils";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { _t } from "../../../../../src/languageHandler";
import { ReportRoomDialog } from "../../../../../src/components/views/dialogs/ReportRoomDialog.tsx";
import { type RoomSummaryCardState, type RoomTopicState, useRoomSummaryCardViewModel, useRoomTopicViewModel } from "../../../../../src/components/viewmodels/rooms/RoomSummaryCardViewModel";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher.ts";
jest.mock("../../../../../src/utils/room/tagRoom");

// Mock the viewmodel hooks
jest.mock("../../../../../src/components/viewmodels/rooms/RoomSummaryCardViewModel", () => ({
    useRoomSummaryCardViewModel: jest.fn(),
    useRoomTopicViewModel: jest.fn(),
}));

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

        return render(<RoomSummaryCardView {...defaultProps} {...props} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });
    };

    // Setup mock view models
    const vmDefaultValues: RoomSummaryCardState = {
        isDirectMessage: false,
        isRoomEncrypted: false,
        e2eStatus: undefined,
        isVideoRoom: false,
        roomJoinRule: JoinRule.Public,
        alias: "",
        isFavorite: false,
        canInviteToState: true,
        pinCount: 0,
        searchInputRef: { current: null },
        onUpdateSearchInput: jest.fn(),
        onRoomMembersClick: jest.fn(),
        onRoomThreadsClick: jest.fn(),
        onRoomFilesClick: jest.fn(),
        onRoomExtensionsClick: jest.fn(),
        onRoomPinsClick: jest.fn(),
        onRoomSettingsClick: jest.fn(),
        onLeaveRoomClick: jest.fn(),
        onShareRoomClick: jest.fn(),
        onRoomExportClick: jest.fn(),
        onRoomPollHistoryClick: jest.fn(),
        onReportRoomClick: jest.fn(),
        onFavoriteToggleClick: jest.fn(),
        onInviteToRoomClick: jest.fn(),
    };

    const topicVmDefaultValues: RoomTopicState = {
        expanded: true,
        canEditTopic: false,
        onEditClick: jest.fn(),
        onExpandedClick: jest.fn(),
        onTopicLinkClick: jest.fn(),
    };

    beforeEach(() => {
        mockClient = mocked(stubClient());
        room = new Room(roomId, mockClient, userId);
        mocked(useRoomSummaryCardViewModel).mockReturnValue(vmDefaultValues);
        mocked(useRoomTopicViewModel).mockReturnValue(topicVmDefaultValues);
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

    it("renders the room topic in the summary", () => {
        mocked(useRoomTopicViewModel).mockReturnValue(topicVmDefaultValues);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: "m.room.topic",
                room_id: roomId,
                sender: userId,
                content: {
                    topic: "This is the room's topic.",
                },
                state_key: "",
            }),
        ]);
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("has button to edit topic", () => {
        mocked(useRoomTopicViewModel).mockReturnValue(topicVmDefaultValues,);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: "m.room.topic",
                room_id: roomId,
                sender: userId,
                content: {
                    topic: "This is the room's topic.",
                },
                state_key: "",
            }),
        ]);
        const { container, getByText } = getComponent();
        expect(getByText("Edit")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    describe("search", () => {
        it("has the search field", async () => {
            const onSearchChange = jest.fn();
            const { getByPlaceholderText } = getComponent({
                onSearchChange,
            });
            expect(getByPlaceholderText("Search messages…")).toBeVisible();
        });

        it("should focus the search field if focusRoomSearch=true", () => {
            const onSearchChange = jest.fn();
            const { getByPlaceholderText } = getComponent({
                onSearchChange,
                focusRoomSearch: true,
            });
            expect(getByPlaceholderText("Search messages…")).toHaveFocus();
        });

        it("should cancel search on escape", () => {
            const onSearchChange = jest.fn();
            const onSearchCancel = jest.fn();

            const { getByPlaceholderText } = getComponent({
                onSearchChange,
                onSearchCancel,
                focusRoomSearch: true,
            });
            expect(getByPlaceholderText("Search messages…")).toHaveFocus();
            fireEvent.keyDown(getByPlaceholderText("Search messages…"), { key: "Escape" });
            expect(vmDefaultValues.onUpdateSearchInput).toHaveBeenCalled();
        });
    });

    it("opens room file panel on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Files"));

        expect(vmDefaultValues.onRoomFilesClick).toHaveBeenCalled();
    });

    it("opens room export dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("export_chat|title")));

        expect(vmDefaultValues.onRoomExportClick).toHaveBeenCalled();
    });

    it("opens share room dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|copy_link")));

        expect(vmDefaultValues.onShareRoomClick).toHaveBeenCalled();
    });

    it("opens invite dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|invite")));

        expect(vmDefaultValues.onInviteToRoomClick).toHaveBeenCalled();
    });

    it("fires favourite dispatch on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("room|context_menu|favourite")));

        expect(vmDefaultValues.onFavoriteToggleClick).toHaveBeenCalled();
    });

    it("opens room settings on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("common|settings")));

        expect(vmDefaultValues.onRoomSettingsClick).toHaveBeenCalled();
    });

    it("opens room member list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("People"));

        expect(vmDefaultValues.onRoomMembersClick).toHaveBeenCalled();
    });

    it("opens room threads list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Threads"));

        expect(vmDefaultValues.onRoomThreadsClick).toHaveBeenCalled();
    });

    it("opens room pinned messages on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Pinned messages"));

        expect(vmDefaultValues.onRoomPinsClick).toHaveBeenCalled();
    });

    it("dispatches leave room on button click", async () => {
        jest.spyOn(Modal, "createDialog").mockReturnValueOnce({
            finished: Promise.resolve([true]),
            close: () => {},
        });
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("room_list|more_options|leave_room")));
        await untilDispatch("leave_room", defaultDispatcher);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: "leave_room",
            room_id: room.roomId,
        });
    });

    it("opens report dialog on button click", async () => {
        jest.spyOn(Modal, "createDialog").mockReturnValueOnce({
            finished: Promise.resolve([true]),
            close: () => {},
        });
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|report_room")));
        expect(Modal.createDialog).toHaveBeenCalledWith(ReportRoomDialog, { roomId: room.roomId });
        await untilDispatch("leave_room", defaultDispatcher);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: "leave_room",
            room_id: room.roomId,
        });
    });

    describe("pinning", () => {
        it("renders pins options", () => {
            const { getByText } = getComponent();

            expect(getByText("Pinned messages")).toBeInTheDocument();
        });
    });

    describe("poll history", () => {
        it("renders poll history option", () => {
            const { getByText } = getComponent();

            expect(getByText("Polls")).toBeInTheDocument();
        });

        it("opens poll history dialog on button click", () => {
            const permalinkCreator = new RoomPermalinkCreator(room);
            const { getByText } = getComponent({ permalinkCreator });

            fireEvent.click(getByText("Polls"));

            expect(vmDefaultValues.onRoomPollHistoryClick).toHaveBeenCalled();
        });
    });

    describe("video rooms", () => {
        it("does not render irrelevant options for element video room", () => {
            jest.spyOn(room, "isElementVideoRoom").mockReturnValue(true);
            mocked(settingsHooks.useFeatureEnabled).mockImplementation((feature) => feature === "feature_video_rooms");
            const { queryByText } = getComponent();

            // options not rendered
            expect(queryByText("Files")).not.toBeInTheDocument();
            expect(queryByText("Pinned")).not.toBeInTheDocument();
            expect(queryByText("Export chat")).not.toBeInTheDocument();
        });

        it("does not render irrelevant options for element call room", () => {
            jest.spyOn(room, "isCallRoom").mockReturnValue(true);
            mocked(settingsHooks.useFeatureEnabled).mockImplementation(
                (feature) => feature === "feature_element_call_video_rooms" || feature === "feature_video_rooms",
            );
            const { queryByText } = getComponent();

            // options not rendered
            expect(queryByText("Files")).not.toBeInTheDocument();
            expect(queryByText("Pinned")).not.toBeInTheDocument();
            expect(queryByText("Export chat")).not.toBeInTheDocument();
        });
    });

    describe("public room label", () => {

        it("does not show public room label for a DM", async () => {
            mocked(useRoomSummaryCardViewModel).mockReturnValue({
                ...vmDefaultValues,
                isDirectMessage: true,
            });

            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).not.toBeInTheDocument();
        });

        it("does not show public room label for non public room", async () => {
            mocked(useRoomSummaryCardViewModel).mockReturnValue({
                ...vmDefaultValues,
                isDirectMessage: false,
                roomJoinRule: JoinRule.Invite,
            });
            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).not.toBeInTheDocument();
        });

        it("shows a public room label for a public room", async () => {
            getComponent();

            await flushPromises();

            expect(screen.queryByText("Public room")).toBeInTheDocument();
        });
    });
});
