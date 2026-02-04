/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent, Room, RoomEvent, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { createTestClient, flushPromises } from "../../../../test-utils";
import { RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../../../src/stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../../../../src/stores/notifications/NotificationState";
import { type MessagePreview, MessagePreviewStore } from "../../../../../src/stores/room-list/MessagePreviewStore";
import { UPDATE_EVENT } from "../../../../../src/stores/AsyncStore";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { CallStore } from "../../../../../src/stores/CallStore";
import type { Call } from "../../../../../src/models/Call";
import { RoomListItemViewModel } from "../../../../../src/viewmodels/room-list/RoomListItemViewModel";

jest.mock("../../../../../src/viewmodels/room-list/utils", () => ({
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(true),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(true),
}));

jest.mock("../../../../../src/stores/CallStore", () => ({
    __esModule: true,
    CallStore: {
        instance: {
            getCall: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
        },
    },
    CallStoreEvent: {
        ConnectedCalls: "connected_calls",
    },
}));

describe("RoomListItemViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;
    let notificationState: RoomNotificationState;
    let viewModel: RoomListItemViewModel;

    beforeEach(() => {
        matrixClient = createTestClient();
        room = new Room("!room:server", matrixClient, matrixClient.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        // Set room name
        room.name = "Test Room";

        notificationState = new RoomNotificationState(room, false);
        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "RoomList.showMessagePreview") return false;
            return false;
        });
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation(() => "watcher-id");

        jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue(null);
        jest.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
    });

    afterEach(() => {
        viewModel?.dispose();
        jest.restoreAllMocks();
    });

    describe("Initialization", () => {
        it("should initialize with room data", async () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            // Wait for async initialization
            await flushPromises();

            const snapshot = viewModel.getSnapshot();
            expect(snapshot.id).toBe("!room:server");
            expect(snapshot.name).toBe("Test Room");
        });

        it("should load message preview when enabled", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Hello world!",
            } as MessagePreview);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            // Wait for async message preview load
            await flushPromises();

            expect(viewModel.getSnapshot().messagePreview).toBe("Hello world!");
        });

        it("should not load message preview when disabled", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().messagePreview).toBeUndefined();
        });
    });

    describe("Notification state", () => {
        it("should reflect notification state", async () => {
            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            jest.spyOn(notificationState, "count", "get").mockReturnValue(5);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            const snapshot = viewModel.getSnapshot();
            expect(snapshot.notification.hasAnyNotificationOrActivity).toBe(true);
            expect(snapshot.notification.count).toBe(5);
        });

        it("should update when notification state changes", async () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().notification.count).toBe(0);

            jest.spyOn(notificationState, "count", "get").mockReturnValue(3);
            notificationState.emit(NotificationStateEvents.Update);

            await flushPromises();
            expect(viewModel.getSnapshot().notification.count).toBe(3);
        });

        it("should show bold text when has notifications", async () => {
            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isBold).toBe(true);
        });

        it("should show mention badge", async () => {
            jest.spyOn(notificationState, "isMention", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.isMention).toBe(true);
        });

        it("should show invitation state", async () => {
            jest.spyOn(notificationState, "invited", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.invited).toBe(true);
        });
    });

    describe("Message preview", () => {
        it("should update message preview when store emits update", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Initial message",
            } as MessagePreview);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBe("Initial message");

            // Update preview
            jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Updated message",
            } as MessagePreview);

            MessagePreviewStore.instance.emit(UPDATE_EVENT);

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBe("Updated message");
        });

        it("should show/hide preview when setting changes", async () => {
            let showPreview = false;
            let watchCallback: any;

            jest.spyOn(SettingsStore, "getValue").mockImplementation(() => showPreview);
            jest.spyOn(SettingsStore, "watchSetting").mockImplementation((_setting, _room, callback) => {
                watchCallback = callback;
                return "watcher-id";
            });
            jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Test message",
            } as MessagePreview);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBeUndefined();

            // Enable previews
            showPreview = true;
            watchCallback(null, "device", true);

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBe("Test message");
        });
    });

    describe("Room tags", () => {
        it("should reflect favorite tag", async () => {
            room.tags = { [DefaultTagID.Favourite]: { order: 0 } };

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isFavourite).toBe(true);
        });

        it("should reflect low priority tag", async () => {
            room.tags = { [DefaultTagID.LowPriority]: { order: 0 } };

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isLowPriority).toBe(true);
        });

        it("should update when room tags change", async () => {
            room.tags = {};
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().isFavourite).toBe(false);

            room.tags = { [DefaultTagID.Favourite]: { order: 0 } };
            const tagEvent = {
                getContent: () => ({ tags: { [DefaultTagID.Favourite]: { order: 0 } } }),
            } as MatrixEvent;
            room.emit(RoomEvent.Tags, tagEvent, room);

            await flushPromises();
            expect(viewModel.getSnapshot().isFavourite).toBe(true);
        });
    });

    describe("Call state", () => {
        it("should show voice call indicator", async () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map([[matrixClient.getUserId()!, {}]]),
            } as unknown as Call;

            jest.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");
        });

        it("should show video call indicator", async () => {
            const mockCall = {
                callType: CallType.Video,
                participants: new Map([[matrixClient.getUserId()!, {}]]),
            } as unknown as Call;

            jest.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBe("video");
        });

        it("should not show call indicator when no participants", async () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map(),
            } as unknown as Call;

            jest.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBeUndefined();
        });
    });

    describe("Room name updates", () => {
        it("should update when room name changes", async () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().name).toBe("Test Room");

            room.name = "Updated Room";
            room.emit(RoomEvent.Name, room);

            await flushPromises();
            expect(viewModel.getSnapshot().name).toBe("Updated Room");
        });
    });

    describe("DM detection", () => {
        it("should detect DM rooms", async () => {
            const dmRoomMap = DMRoomMap.shared();
            jest.spyOn(dmRoomMap, "getUserIdForRoomId").mockReturnValue("@user:server");

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            // DM rooms should not show copy room link option
            expect(viewModel.getSnapshot().canCopyRoomLink).toBe(false);
        });

        it("should detect non-DM rooms", async () => {
            const dmRoomMap = DMRoomMap.shared();
            jest.spyOn(dmRoomMap, "getUserIdForRoomId").mockReturnValue(undefined);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().canCopyRoomLink).toBe(true);
        });
    });

    describe("Actions", () => {
        it("should dispatch view room action on openRoom", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.onOpenRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "!room:server",
                metricsTrigger: "RoomList",
            });
        });

        it("should return room object", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            expect(viewModel.getSnapshot().room).toBe(room);
        });

        it("should dispatch view_invite action when onInvite is called", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.onInvite();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "view_invite",
                roomId: "!room:server",
            });
        });

        it("should dispatch copy_room action when onCopyRoomLink is called", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.onCopyRoomLink();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "copy_room",
                room_id: "!room:server",
            });
        });

        it("should dispatch leave_room action when onLeaveRoom is called for normal room", () => {
            room.tags = {};
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.onLeaveRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "leave_room",
                room_id: "!room:server",
            });
        });

        it("should dispatch forget_room action when onLeaveRoom is called for archived room", () => {
            room.tags = { [DefaultTagID.Archived]: { order: 0 } };

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.onLeaveRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "forget_room",
                room_id: "!room:server",
            });
        });
    });

    describe("Cleanup", () => {
        it("should unsubscribe from all events on dispose", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const offSpy = jest.spyOn(notificationState, "off");

            viewModel.dispose();

            expect(offSpy).toHaveBeenCalled();
        });
    });
});
