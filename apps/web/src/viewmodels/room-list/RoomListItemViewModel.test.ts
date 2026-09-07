/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import EventEmitter from "node:events";
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import {
    type MatrixClient,
    type MatrixEvent,
    Room,
    RoomEvent,
    PendingEventOrdering,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { createTestClient, flushPromises } from "test-utils";

import { RoomNotificationState } from "../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";
import { type MessagePreview, MessagePreviewStore } from "../../stores/message-preview";
import SettingsStore, { type CallbackFn } from "../../settings/SettingsStore";
import DMRoomMap from "../../utils/DMRoomMap";
import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import dispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { CallStore } from "../../stores/CallStore";
import { CallEvent, type Call } from "../../models/Call";
import { RoomListItemViewModel } from "./RoomListItemViewModel";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import * as tagRoomModule from "../../utils/room/tagRoom";
import { CHATS_TAG } from "../../stores/room-list-v3/section";

vi.mock("./utils", () => ({
    hasAccessToOptionsMenu: vi.fn().mockReturnValue(true),
    hasAccessToNotificationMenu: vi.fn().mockReturnValue(true),
}));

vi.mock("../../stores/CallStore", () => ({
    __esModule: true,
    CallStore: {
        instance: {
            getCall: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
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
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);

        const dmRoomMap = {
            getUserIdForRoomId: vi.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "RoomList.showMessagePreview") return false;
            if (setting === "RoomList.OrderedCustomSections") return [];
            if (setting === "RoomList.CustomSectionData") return {};
            return false;
        });
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        vi.spyOn(SettingsStore, "watchSetting").mockImplementation(() => "watcher-id");

        vi.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue(null);
        vi.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
        vi.spyOn(RoomListStoreV3.instance, "orderedSectionTags", "get").mockReturnValue([]);
    });

    afterEach(() => {
        viewModel?.dispose();
        vi.restoreAllMocks();
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
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            vi.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Hello world!",
            } as MessagePreview);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            // Wait for async message preview load
            await flushPromises();

            expect(viewModel.getSnapshot().messagePreview).toBe("Hello world!");
        });

        it("should not load message preview when disabled", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().messagePreview).toBeUndefined();
        });
    });

    describe("Notification state", () => {
        it("should reflect notification state", async () => {
            vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            vi.spyOn(notificationState, "count", "get").mockReturnValue(5);

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

            vi.spyOn(notificationState, "count", "get").mockReturnValue(3);
            notificationState.emit(NotificationStateEvents.Update);

            await flushPromises();
            expect(viewModel.getSnapshot().notification.count).toBe(3);
        });

        it("should show bold text when has notifications", async () => {
            vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isBold).toBe(true);
        });

        it("should show mention badge", async () => {
            vi.spyOn(notificationState, "isMention", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.isMention).toBe(true);
        });

        it("should show invitation state", async () => {
            vi.spyOn(notificationState, "invited", "get").mockReturnValue(true);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.invited).toBe(true);
        });
    });

    describe("Message preview", () => {
        it("should update message preview when store emits update", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            vi.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Initial message",
            } as MessagePreview);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBe("Initial message");

            // Update preview
            vi.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
                text: "Updated message",
            } as MessagePreview);

            MessagePreviewStore.instance.emit(MessagePreviewStore.getPreviewChangedEventName(room));

            await flushPromises();
            expect(viewModel.getSnapshot().messagePreview).toBe("Updated message");
        });

        it("should show/hide preview when setting changes", async () => {
            let showPreview = false;
            let watchCallback: any;

            vi.spyOn(SettingsStore, "getValue").mockImplementation(() => showPreview);
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((setting, _room, callback) => {
                if (setting === "RoomList.showMessagePreview") watchCallback = callback;
                return "watcher-id";
            });
            vi.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockResolvedValue({
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
                off: vi.fn(),
                on: vi.fn(),
            } as unknown as Call;

            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");
        });

        it("should show video call indicator", async () => {
            const mockCall = {
                callType: CallType.Video,
                participants: new Map([[matrixClient.getUserId()!, {}]]),
                off: vi.fn(),
                on: vi.fn(),
            } as unknown as Call;

            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBe("video");
        });

        it("should not show call indicator when no participants", async () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map(),
                off: vi.fn(),
                on: vi.fn(),
            } as unknown as Call;

            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBeUndefined();
        });

        it("should listen to call participant changes", () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map(),
                off: vi.fn(),
                on: vi.fn(),
            };
            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall as unknown as Call);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            expect(viewModel.getSnapshot().notification.callType).toBeUndefined();

            // Get the callback registered for call state changes
            const mockCalls = (CallStore.instance.on as Mock).mock.calls;
            const callStateCallback = mockCalls[mockCalls.length - 1][1];
            callStateCallback();

            // Simulate participant joining
            mockCall.participants.set(matrixClient.getUserId()! as unknown as RoomMember, new Set());

            // Get the callback registered for participant changes
            const participantsChangeCallback = mockCall.on.mock.calls[0][1];
            participantsChangeCallback();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");
        });

        it("should not update the item when there is already an active call and participants join", () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map([[matrixClient.getUserId()! as unknown as RoomMember, new Set<string>()]]),
                off: vi.fn(),
                on: vi.fn(),
            };
            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall as unknown as Call);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            // Trigger onCallStateChanged so the call is tracked and the participant listener is registered
            const mockCalls = (CallStore.instance.on as Mock).mock.calls;
            const callStateCallback = mockCalls[mockCalls.length - 1][1];
            callStateCallback();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");

            // Record the snapshot version before the participant event fires
            const snapshotBefore = viewModel.getSnapshot();

            // Simulate another participant joining while the call is already active
            mockCall.participants.set("@other:server" as unknown as RoomMember, new Set<string>());
            const participantsChangeCallback = mockCall.on.mock.calls[0][1];
            participantsChangeCallback(mockCall.participants);

            // Snapshot should not have changed
            expect(viewModel.getSnapshot()).toBe(snapshotBefore);
        });

        it("should react to participant changes when a call already exists at instantiation time", () => {
            const mockCall = {
                callType: CallType.Voice,
                participants: new Map([]),
                off: vi.fn(),
                on: vi.fn(),
            };
            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall as unknown as Call);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            expect(viewModel.getSnapshot().notification.callType).toBeUndefined();

            // Simulate participant joining
            mockCall.participants.set(matrixClient.getUserId()! as unknown as RoomMember, new Set());

            // Get the callback registered for participant changes
            const participantsChangeCallback = mockCall.on.mock.calls[0][1];
            participantsChangeCallback();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");
        });

        it("should unsubscribe from old call participants when the call changes", () => {
            const firstCall = {
                callType: CallType.Voice,
                participants: new Map([[matrixClient.getUserId()! as unknown as RoomMember, new Set<string>()]]),
                off: vi.fn(),
                on: vi.fn(),
            };
            const secondCall = {
                callType: CallType.Video,
                participants: new Map([[matrixClient.getUserId()! as unknown as RoomMember, new Set<string>()]]),
                off: vi.fn(),
                on: vi.fn(),
            };

            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(firstCall as unknown as Call);
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            // Trigger onCallStateChanged to register the first call
            const mockCalls = (CallStore.instance.on as Mock).mock.calls;
            const callStateCallback = mockCalls[mockCalls.length - 1][1];
            callStateCallback();

            const participantsCallback = firstCall.on.mock.calls[0][1];
            expect(firstCall.on).toHaveBeenCalledWith("participants", participantsCallback);

            // Now switch to a different call
            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(secondCall as unknown as Call);
            callStateCallback();

            // The old call's listener must have been removed
            expect(firstCall.off).toHaveBeenCalledWith("participants", participantsCallback);
            // The new call must have a listener registered
            expect(secondCall.on).toHaveBeenCalledWith("participants", expect.any(Function));
        });

        it("should listen to call type changes", async () => {
            // Start with a voice call
            let callType = CallType.Voice;
            const mockCall = new (class extends EventEmitter {
                get callType() {
                    return callType;
                }
                participants = new Map([[matrixClient.getUserId()!, {}]]);
            })() as unknown as Call;
            vi.spyOn(CallStore.instance, "getCall").mockReturnValue(mockCall);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            await flushPromises();

            expect(viewModel.getSnapshot().notification.callType).toBe("voice");

            // Now turn it into a video call
            callType = CallType.Video;
            mockCall.emit(CallEvent.CallTypeChanged, callType);
            expect(viewModel.getSnapshot().notification.callType).toBe("video");
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
            vi.spyOn(dmRoomMap, "getUserIdForRoomId").mockReturnValue("@user:server");

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isDm).toBe(true);
            // DM rooms should not show copy room link option
            expect(viewModel.getSnapshot().canCopyRoomLink).toBe(false);
        });

        it("should detect non-DM rooms", async () => {
            const dmRoomMap = DMRoomMap.shared();
            vi.spyOn(dmRoomMap, "getUserIdForRoomId").mockReturnValue(undefined);

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            await flushPromises();

            expect(viewModel.getSnapshot().isDm).toBe(false);
            expect(viewModel.getSnapshot().canCopyRoomLink).toBe(true);
        });
    });

    describe("Actions", () => {
        it("should dispatch view room action on openRoom", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const dispatchSpy = vi.spyOn(dispatcher, "dispatch");

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
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch");

            viewModel.onInvite();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "view_invite",
                roomId: "!room:server",
            });
        });

        it("should dispatch copy_room action when onCopyRoomLink is called", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch");

            viewModel.onCopyRoomLink();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "copy_room",
                room_id: "!room:server",
            });
        });

        it("should dispatch leave_room action when onLeaveRoom is called for normal room", () => {
            room.tags = {};
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch");

            viewModel.onLeaveRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "leave_room",
                room_id: "!room:server",
            });
        });

        it("should dispatch forget_room action when onLeaveRoom is called for archived room", () => {
            room.tags = { [DefaultTagID.Archived]: { order: 0 } };

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch");

            viewModel.onLeaveRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "forget_room",
                room_id: "!room:server",
            });
        });

        it("should call createSection on RoomListStoreV3 with the room preselected when onCreateSection is called", async () => {
            const createSectionSpy = vi
                .spyOn(RoomListStoreV3.instance, "createSection")
                .mockResolvedValue("element.io.section.work");
            const tagRoomSpy = vi.spyOn(tagRoomModule, "tagRoom").mockImplementation(() => {});

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            await viewModel.onCreateSection();

            expect(createSectionSpy).toHaveBeenCalledWith(room.roomId);
            // The dialog tags the preselected room itself, tagging it again here would toggle it back off.
            expect(tagRoomSpy).not.toHaveBeenCalled();
        });

        it("should call tagRoom when onToggleSection is called", () => {
            const tagRoomSpy = vi.spyOn(tagRoomModule, "tagRoom").mockImplementation(() => {});
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            viewModel.onToggleSection(DefaultTagID.Favourite);

            expect(tagRoomSpy).toHaveBeenCalledWith(room, DefaultTagID.Favourite);
        });
    });

    describe("Sections", () => {
        const customTag = "element.io.section.custom1";

        beforeEach(() => {
            vi.spyOn(RoomListStoreV3.instance, "orderedSectionTags", "get").mockReturnValue([
                DefaultTagID.Favourite,
                customTag,
                CHATS_TAG,
                DefaultTagID.LowPriority,
            ]);
        });

        it("should include sections from orderedSectionTags excluding CHATS_TAG, favourite, and low priority", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const sections = viewModel.getSnapshot().sections;
            expect(sections.map((s) => s.tag)).toEqual([customTag]);
        });

        it("should mark the room current section as selected", () => {
            room.tags = { [customTag]: { order: 0 } };

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const sections = viewModel.getSnapshot().sections;
            expect(sections.find((s) => s.tag === customTag)?.isSelected).toBe(true);
        });

        it("should use custom section name from CustomSectionData", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.CustomSectionData")
                    return { [customTag]: { name: "My Custom Section", tag: customTag } };
                return false;
            });
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const section = viewModel.getSnapshot().sections.find((s) => s.tag === customTag);
            expect(section?.name).toBe("My Custom Section");
        });

        it("should update sections when OrderedCustomSections setting changes", () => {
            let watchCallback: CallbackFn<"RoomList.OrderedCustomSections"> = () => {};
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((setting, _room, callback) => {
                if (setting === "RoomList.OrderedCustomSections") watchCallback = callback;
                return "watcher-id";
            });

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            expect(viewModel.getSnapshot().sections).toHaveLength(1);

            // Simulate reordering: custom section removed
            vi.spyOn(RoomListStoreV3.instance, "orderedSectionTags", "get").mockReturnValue([
                DefaultTagID.Favourite,
                CHATS_TAG,
                DefaultTagID.LowPriority,
            ]);
            watchCallback("RoomList.OrderedCustomSections", null, null as any, null, null);

            expect(viewModel.getSnapshot().sections.map((s) => s.tag)).toEqual([]);
        });

        it("should set areSectionsEnabled to true when RoomList.showSections is enabled", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.showSections") return true;
                return false;
            });

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            expect(viewModel.getSnapshot().areSectionsEnabled).toBe(true);
        });

        it("should update areSectionsEnabled when RoomList.showSections setting changes", () => {
            let watchCallback: CallbackFn<"RoomList.showSections"> = () => {};
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((setting, _room, callback) => {
                if (setting === "RoomList.showSections") watchCallback = callback;
                return "watcher-id";
            });

            viewModel = new RoomListItemViewModel({ room, client: matrixClient });
            expect(viewModel.getSnapshot().areSectionsEnabled).toBe(false);

            // Enable sections
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.showSections") return true;
                return false;
            });
            watchCallback("RoomList.showSections", null, null as any, null, null);

            expect(viewModel.getSnapshot().areSectionsEnabled).toBe(true);
        });
    });

    describe("Cleanup", () => {
        it("should unsubscribe from all events on dispose", () => {
            viewModel = new RoomListItemViewModel({ room, client: matrixClient });

            const offSpy = vi.spyOn(notificationState, "off");

            viewModel.dispose();

            expect(offSpy).toHaveBeenCalled();
        });
    });
});
