/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { act, renderHook, waitFor } from "jest-matrix-react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { useRoomSummaryCardViewModel } from "../../../../../src/components/viewmodels/right_panel/RoomSummaryCardViewModel";
import { mkStubRoom, stubClient, withClientContextRenderOptions } from "../../../../test-utils";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import RoomListStore from "../../../../../src/stores/room-list/RoomListStore";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import RightPanelStore from "../../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";
import Modal from "../../../../../src/Modal";
import { ShareDialog } from "../../../../../src/components/views/dialogs/ShareDialog";
import ExportDialog from "../../../../../src/components/views/dialogs/ExportDialog";
import { PollHistoryDialog } from "../../../../../src/components/views/dialogs/PollHistoryDialog";
import { ReportRoomDialog } from "../../../../../src/components/views/dialogs/ReportRoomDialog";
import { inviteToRoom } from "../../../../../src/utils/room/inviteToRoom";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import * as hooks from "../../../../../src/hooks/useAccountData";

jest.mock("../../../../../src/utils/room/inviteToRoom", () => ({
    inviteToRoom: jest.fn(),
}));

describe("useRoomSummaryCardViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;
    let permalinkCreator: any;
    const onSearchCancel = jest.fn();

    beforeEach(() => {
        matrixClient = stubClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);
        permalinkCreator = {};

        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValue([]);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    function render() {
        return renderHook(
            () => useRoomSummaryCardViewModel(room, permalinkCreator, onSearchCancel),
            withClientContextRenderOptions(matrixClient),
        );
    }

    it("should return correct initial state", () => {
        const { result } = render();

        expect(result.current.isDirectMessage).toBe(false);
        expect(result.current.isRoomEncrypted).toBe(false);
        expect(result.current.isVideoRoom).toBe(false);
        expect(result.current.isFavorite).toBe(false);
        expect(result.current.pinCount).toBe(0);
        expect(result.current.searchInputRef.current).toBe(null);
    });

    it("should handle room members click", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { result } = render();

        result.current.onRoomMembersClick();
        expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList }, true);
    });

    it("should handle room settings click", () => {
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = render();

        result.current.onRoomSettingsClick(new Event("click"));
        expect(spy).toHaveBeenCalledWith({ action: "open_room_settings" });
    });

    it("should handle leave room click", () => {
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = render();

        result.current.onLeaveRoomClick();
        expect(spy).toHaveBeenCalledWith({
            action: "leave_room",
            room_id: room.roomId,
        });
    });

    it("should handle room threads click", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { result } = render();

        result.current.onRoomThreadsClick();
        expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel }, true);
    });

    it("should handle room files click", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { result } = render();

        result.current.onRoomFilesClick();
        expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.FilePanel }, true);
    });

    it("should handle room extensions click", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { result } = render();

        result.current.onRoomExtensionsClick();
        expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.Extensions }, true);
    });

    it("should handle room pins click", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { result } = render();

        result.current.onRoomPinsClick();
        expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.PinnedMessages }, true);
    });

    it("should handle room invite click", () => {
        const { result } = render();

        result.current.onInviteToRoomClick();
        expect(inviteToRoom).toHaveBeenCalledWith(room);
    });

    describe("action that trigger a dialog", () => {
        let createDialogSpy: jest.SpyInstance;

        beforeEach(() => {
            createDialogSpy = jest.spyOn(Modal, "createDialog").mockImplementation(() => ({
                finished: Promise.resolve([false]),
                close: jest.fn(),
            }));
        });

        afterEach(() => {
            createDialogSpy.mockRestore();
        });

        it("should handle room export click", async () => {
            const { result } = render();

            await act(async () => {
                await result.current.onRoomExportClick();
            });
            expect(createDialogSpy).toHaveBeenCalledWith(ExportDialog, { room });
        });

        it("should handle room poll history click", async () => {
            const { result } = render();

            await act(async () => {
                await result.current.onRoomPollHistoryClick();
            });
            expect(createDialogSpy).toHaveBeenCalledWith(PollHistoryDialog, {
                room,
                matrixClient,
                permalinkCreator,
            });
        });

        it("should handle room report click", async () => {
            const { result } = render();

            await act(async () => {
                await result.current.onReportRoomClick();
            });

            expect(createDialogSpy).toHaveBeenCalledWith(ReportRoomDialog, { roomId: room.roomId });
        });

        it("should handle share room click", async () => {
            const { result } = render();

            await act(async () => {
                await result.current.onShareRoomClick();
            });

            expect(createDialogSpy).toHaveBeenCalledWith(ShareDialog, {
                target: room,
            });
        });
    });

    describe("favorite room state", () => {
        it("should identify favorite rooms", () => {
            jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValue([DefaultTagID.Favourite]);
            const { result } = render();

            expect(result.current.isFavorite).toBe(true);
        });

        it("should identify non-favorite rooms", () => {
            jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValue([]);
            const { result } = render();

            expect(result.current.isFavorite).toBe(false);
        });
    });

    describe("direct message state", () => {
        it("should identify direct message rooms", async () => {
            // Mock the direct rooms account data
            const directRoomsList = {
                "@user:domain.com": [room.roomId],
            };
            // Mock the useAccountData hook result
            jest.spyOn(hooks, "useAccountData").mockReturnValue(directRoomsList);

            const { result } = render();

            await waitFor(() => {
                expect(result.current.isDirectMessage).toBe(true);
            });
        });

        it("should identify non-direct message rooms", async () => {
            // Mock the direct rooms account data
            const directRoomsList = {};
            // Mock the useAccountData hook result
            jest.spyOn(hooks, "useAccountData").mockReturnValue(directRoomsList);

            const { result } = render();

            await waitFor(() => {
                expect(result.current.isDirectMessage).toBe(false);
            });
        });
    });

    describe("search input", () => {
        it("should handle search input escape key", () => {
            const directRoomsList = {};
            jest.spyOn(hooks, "useAccountData").mockReturnValue(directRoomsList);
            const { result } = render();
            // Create a mock input element and set it as the current ref value
            const mockInputElement = document.createElement("input");
            mockInputElement.value = "some search text";

            result.current.searchInputRef.current = mockInputElement;

            const event = {
                key: "Escape",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            };

            result.current.onUpdateSearchInput(event as any);

            expect(onSearchCancel).toHaveBeenCalled();
            expect(mockInputElement?.value).toBe("");
        });
    });
});
