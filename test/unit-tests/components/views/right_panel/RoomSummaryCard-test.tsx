/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent, screen, waitFor } from "jest-matrix-react";
import { EventType, MatrixEvent, Room, type MatrixClient, JoinRule } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked, type MockedObject } from "jest-mock";
import userEvent from "@testing-library/user-event";

import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import RoomSummaryCard from "../../../../../src/components/views/right_panel/RoomSummaryCard";
import { ShareDialog } from "../../../../../src/components/views/dialogs/ShareDialog";
import ExportDialog from "../../../../../src/components/views/dialogs/ExportDialog";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import * as settingsHooks from "../../../../../src/hooks/useSettings";
import Modal from "../../../../../src/Modal";
import RightPanelStore from "../../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";
import { flushPromises, stubClient, untilDispatch } from "../../../../test-utils";
import { PollHistoryDialog } from "../../../../../src/components/views/dialogs/PollHistoryDialog";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { _t } from "../../../../../src/languageHandler";
import { tagRoom } from "../../../../../src/utils/room/tagRoom";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import { Action } from "../../../../../src/dispatcher/actions";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";
import { ReportRoomDialog } from "../../../../../src/components/views/dialogs/ReportRoomDialog.tsx";

jest.mock("../../../../../src/utils/room/tagRoom");

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
        mockClient = mocked(stubClient());
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
        room.updateMyMembership(KnownMembership.Join);

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

    it("renders the room topic in the summary", () => {
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

        it("should focus the search field if Action.FocusMessageSearch is fired", async () => {
            const onSearchChange = jest.fn();
            const { getByPlaceholderText } = getComponent({
                onSearchChange,
            });
            expect(getByPlaceholderText("Search messages…")).not.toHaveFocus();
            defaultDispatcher.fire(Action.FocusMessageSearch);
            await waitFor(() => {
                expect(getByPlaceholderText("Search messages…")).toHaveFocus();
            });
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
            expect(onSearchCancel).toHaveBeenCalled();
        });

        it("should empty search field when the timeline rendering type changes away", async () => {
            const onSearchChange = jest.fn();
            const { rerender } = render(
                <MatrixClientContext.Provider value={mockClient}>
                    <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Search } as any)}>
                        <RoomSummaryCard
                            room={room}
                            permalinkCreator={new RoomPermalinkCreator(room)}
                            onSearchChange={onSearchChange}
                            focusRoomSearch={true}
                        />
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );

            await userEvent.type(screen.getByPlaceholderText("Search messages…"), "test");
            expect(screen.getByPlaceholderText("Search messages…")).toHaveValue("test");

            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                        <RoomSummaryCard
                            room={room}
                            permalinkCreator={new RoomPermalinkCreator(room)}
                            onSearchChange={onSearchChange}
                        />
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );
            expect(screen.getByPlaceholderText("Search messages…")).toHaveValue("");
        });
    });

    it("opens room file panel on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Files"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.FilePanel }, true);
    });

    it("opens room export dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("export_chat|title")));

        expect(Modal.createDialog).toHaveBeenCalledWith(ExportDialog, { room });
    });

    it("opens share room dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|copy_link")));

        expect(Modal.createDialog).toHaveBeenCalledWith(ShareDialog, { target: room });
    });

    it("opens invite dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|invite")));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "view_invite", roomId: room.roomId });
    });

    it("fires favourite dispatch on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("room|context_menu|favourite")));

        expect(tagRoom).toHaveBeenCalledWith(room, DefaultTagID.Favourite);
    });

    it("opens room settings on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("common|settings")));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "open_room_settings" });
    });

    it("opens room member list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("People"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList }, true);
    });

    it("opens room threads list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Threads"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel }, true);
    });

    it("opens room pinned messages on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Pinned messages"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith(
            { phase: RightPanelPhases.PinnedMessages },
            true,
        );
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
        beforeEach(() => {
            jest.spyOn(room.currentState, "getJoinRule").mockReturnValue(JoinRule.Public);
        });

        it("does not show public room label for a DM", async () => {
            mockClient.getAccountData.mockImplementation((eventType) => {
                if (eventType === EventType.Direct) {
                    return new MatrixEvent({
                        type: EventType.Direct,
                        content: {
                            "@bob:sesame.st": ["some-room-id"],
                            // this room is a DM with ernie
                            "@ernie:sesame.st": ["some-other-room-id", room.roomId],
                        },
                    });
                }
            });
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
