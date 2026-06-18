/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { RoomListSectionHeaderViewModel } from "../../../src/viewmodels/room-list/RoomListSectionHeaderViewModel";
import { RoomNotificationState } from "../../../src/stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../src/stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../../src/stores/notifications/NotificationState";
import { CallStore } from "../../../src/stores/CallStore";
import { type Call } from "../../../src/models/Call";
import { createTestClient, mkRoom } from "../../test-utils";
import SettingsStore from "../../../src/settings/SettingsStore";
import RoomListStoreV3 from "../../../src/stores/room-list-v3/RoomListStoreV3";
import { DefaultTagID } from "../../../src/stores/room-list-v3/skip-list/tag";
import { CHATS_TAG } from "../../../src/stores/room-list-v3/section";

describe("RoomListSectionHeaderViewModel", () => {
    let onToggleExpanded: jest.Mock;
    let matrixClient: MatrixClient;

    beforeEach(() => {
        onToggleExpanded = jest.fn();
        matrixClient = createTestClient();
        jest.spyOn(SettingsStore, "watchSetting").mockReturnValue("watcher-id");
        jest.spyOn(SettingsStore, "unwatchSetting").mockReturnValue(undefined);
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "RoomList.OrderedCustomSections") return [];
            return null;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize snapshot from props", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });

        const snapshot = vm.getSnapshot();
        expect(snapshot.id).toBe("m.favourite");
        expect(snapshot.title).toBe("Favourites");
        expect(snapshot.isExpanded).toBe(true);
    });

    it("should toggle expanded state on click", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });
        expect(vm.isExpanded).toBe(true);

        vm.onClick();
        expect(vm.isExpanded).toBe(false);
        expect(vm.getSnapshot().isExpanded).toBe(false);
        expect(onToggleExpanded).toHaveBeenCalledWith(false);

        vm.onClick();
        expect(vm.isExpanded).toBe(true);
        expect(vm.getSnapshot().isExpanded).toBe(true);
        expect(onToggleExpanded).toHaveBeenCalledWith(true);
    });

    it("should track expanded state per space", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });

        // Default space: collapse
        vm.onClick();
        expect(vm.isExpanded).toBe(false);

        // Switch to a different space: should default to expanded
        vm.setSpace("!space2:server");
        expect(vm.isExpanded).toBe(true);

        // Collapse in the new space
        vm.onClick();
        expect(vm.isExpanded).toBe(false);
        vm.onClick();
        expect(vm.isExpanded).toBe(true);

        // Switch to the other space: should still be collapsed
        vm.setSpace("!space:server");
        expect(vm.isExpanded).toBe(false);
    });

    describe("displaySectionMenu", () => {
        it.each([
            [DefaultTagID.Favourite, false],
            [DefaultTagID.LowPriority, false],
            [CHATS_TAG, false],
            ["element.io.section.custom", true],
        ])("should be %s for tag %s", (tag, expected) => {
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            expect(vm.getSnapshot().displaySectionMenu).toBe(expected);
        });
    });

    describe("onCustomSectionDataChange", () => {
        let watchCallback: () => void;

        beforeEach(() => {
            jest.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                if (settingName === "RoomList.CustomSectionData") watchCallback = callback as () => void;
                return "watcher-id";
            });
        });

        it("should update title when custom section data changes", () => {
            const tag = "element.io.section.custom";
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Old Title",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            expect(vm.getSnapshot().title).toBe("Old Title");

            jest.spyOn(SettingsStore, "getValue").mockReturnValue({ [tag]: { tag, name: "New Title" } });
            watchCallback();

            expect(vm.getSnapshot().title).toBe("New Title");
        });

        it("should not update title when section data is missing", () => {
            const tag = "element.io.section.custom";
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "My Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });

            jest.spyOn(SettingsStore, "getValue").mockReturnValue({});
            watchCallback();

            expect(vm.getSnapshot().title).toBe("My Section");
        });

        it("should not update title when tag is not a custom section tag", () => {
            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });

            watchCallback();

            expect(vm.getSnapshot().title).toBe("Favourites");
        });
    });

    describe("editSection", () => {
        it("should delegate to RoomListStoreV3.instance.editSection", async () => {
            const editSectionSpy = jest.spyOn(RoomListStoreV3.instance, "editSection").mockResolvedValue(undefined);
            const tag = "element.io.section.custom";
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });

            await vm.editSection();
            expect(editSectionSpy).toHaveBeenCalledWith(tag);
        });
    });

    describe("removeSection", () => {
        beforeEach(() => {
            const mockState = {
                on: jest.fn(),
                off: jest.fn(),
                hasAnyNotificationOrActivity: false,
            } as unknown as RoomNotificationState;
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(mockState);
        });

        it("should delegate to RoomListStoreV3.instance.removeSection with isEmpty=true when no rooms", async () => {
            const removeSectionSpy = jest.spyOn(RoomListStoreV3.instance, "removeSection").mockResolvedValue(undefined);
            const tag = "element.io.section.custom";
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });

            await vm.removeSection();
            expect(removeSectionSpy).toHaveBeenCalledWith(tag, true);
        });

        it("should delegate to RoomListStoreV3.instance.removeSection with isEmpty=false when rooms exist", async () => {
            const removeSectionSpy = jest.spyOn(RoomListStoreV3.instance, "removeSection").mockResolvedValue(undefined);
            const tag = "element.io.section.custom";
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([mkRoom(matrixClient, "!room:server")]);

            await vm.removeSection();
            expect(removeSectionSpy).toHaveBeenCalledWith(tag, false);
        });
    });

    describe("unread status", () => {
        let room: Room;
        let notificationState: RoomNotificationState;

        beforeEach(() => {
            room = mkRoom(matrixClient, "!room:server");
            notificationState = new RoomNotificationState(room, false);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        });

        it("should set isUnread to false when no rooms have notifications", () => {
            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(false);
        });

        it("should set isUnread to true when a room has notifications", () => {
            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(true);
        });

        it("should subscribe to new rooms and unsubscribe from removed rooms", () => {
            const room2 = mkRoom(matrixClient, "!room2:server");
            const notificationState2 = new RoomNotificationState(room2, false);

            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                .mockReturnValueOnce(notificationState)
                .mockReturnValue(notificationState2);

            jest.spyOn(notificationState, "on");
            jest.spyOn(notificationState, "off");
            jest.spyOn(notificationState2, "on");

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(notificationState.on).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));

            vm.setRooms([room2]);

            expect(notificationState.off).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));
            expect(notificationState2.on).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));

            // Calling setRooms again with the same room should not re-subscribe
            vm.setRooms([room2]);
            expect(notificationState2.on).toHaveBeenCalledTimes(1);
        });

        it("should update isUnread when a notification state update event fires", () => {
            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(false);

            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            notificationState.emit(NotificationStateEvents.Update);

            expect(vm.getSnapshot().isUnread).toBe(true);
        });

        describe("notification decoration", () => {
            it("should expose an empty decoration when no room has notifications", () => {
                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: false,
                        isMention: false,
                        isNotification: false,
                        isUnsentMessage: false,
                        isActivityNotification: false,
                        count: 0,
                    }),
                );
            });

            it("should not show the activity dot for an activity-only section", () => {
                jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
                jest.spyOn(notificationState, "isActivityNotification", "get").mockReturnValue(true);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                // Bold, but no badge to display
                expect(vm.getSnapshot().isUnread).toBe(true);
                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: false,
                        isActivityNotification: false,
                    }),
                );
            });

            it("should merge mentions, notifications and counts across rooms", () => {
                const room2 = mkRoom(matrixClient, "!room2:server");
                const notificationState2 = new RoomNotificationState(room2, false);

                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                    .mockReturnValueOnce(notificationState)
                    .mockReturnValue(notificationState2);

                jest.spyOn(notificationState, "isMention", "get").mockReturnValue(true);
                jest.spyOn(notificationState, "count", "get").mockReturnValue(3);
                jest.spyOn(notificationState, "hasUnreadCount", "get").mockReturnValue(true);

                jest.spyOn(notificationState2, "isNotification", "get").mockReturnValue(true);
                jest.spyOn(notificationState2, "count", "get").mockReturnValue(9);
                jest.spyOn(notificationState2, "hasUnreadCount", "get").mockReturnValue(true);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room, room2]);

                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: true,
                        isMention: true,
                        isNotification: true,
                        hasUnreadCount: true,
                        count: 12,
                        isActivityNotification: false,
                    }),
                );
            });

            it("should surface an unsent message from any room", () => {
                jest.spyOn(notificationState, "isUnsentMessage", "get").mockReturnValue(true);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: true,
                        isUnsentMessage: true,
                    }),
                );
            });

            it("should aggregate an invitation from any room", () => {
                jest.spyOn(notificationState, "invited", "get").mockReturnValue(true);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: true,
                        invited: true,
                    }),
                );
            });

            it("should aggregate an active call, preferring video over voice", () => {
                const room2 = mkRoom(matrixClient, "!room2:server");
                const notificationState2 = new RoomNotificationState(room2, false);

                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                    .mockReturnValueOnce(notificationState)
                    .mockReturnValue(notificationState2);

                const voiceCall = {
                    participants: new Map([["@a:server", new Set(["DEVICE"])]]),
                    callType: CallType.Voice,
                    on: jest.fn(),
                    off: jest.fn(),
                } as unknown as Call;
                const videoCall = {
                    participants: new Map([["@b:server", new Set(["DEVICE"])]]),
                    callType: CallType.Video,
                    on: jest.fn(),
                    off: jest.fn(),
                } as unknown as Call;
                jest.spyOn(CallStore.instance, "getCall").mockImplementation((roomId) =>
                    roomId === room.roomId ? voiceCall : videoCall,
                );

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room, room2]);

                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: true,
                        callType: "video",
                    }),
                );
            });

            it("should ignore a call without participants", () => {
                const call = {
                    participants: new Map(),
                    callType: CallType.Video,
                    on: jest.fn(),
                    off: jest.fn(),
                } as unknown as Call;
                jest.spyOn(CallStore.instance, "getCall").mockReturnValue(call);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().notification?.callType).toBeUndefined();
            });

            it("should show a notification without a count badge for a mark-as-unread room", () => {
                // "Mark as unread" sets level=Notification with count=0 (no real notification events).
                jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
                jest.spyOn(notificationState, "isNotification", "get").mockReturnValue(true);
                jest.spyOn(notificationState, "count", "get").mockReturnValue(0);
                jest.spyOn(notificationState, "hasUnreadCount", "get").mockReturnValue(false);

                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().isUnread).toBe(true);
                expect(vm.getSnapshot().notification).toEqual(
                    expect.objectContaining({
                        hasAnyNotificationOrActivity: true,
                        isNotification: true,
                        hasUnreadCount: false,
                        // The || 1 fallback gives a count of 1 even though no real count exists
                        count: 1,
                    }),
                );
            });

            it("should update the decoration when a notification state update event fires", () => {
                const vm = new RoomListSectionHeaderViewModel({
                    tag: "m.favourite",
                    title: "Favourites",
                    spaceId: "!space:server",
                    onToggleExpanded,
                });
                vm.setRooms([room]);

                expect(vm.getSnapshot().notification?.isMention).toBe(false);

                jest.spyOn(notificationState, "isMention", "get").mockReturnValue(true);
                notificationState.emit(NotificationStateEvents.Update);

                expect(vm.getSnapshot().notification?.isMention).toBe(true);
            });
        });

        it("should unsubscribe from all notification states on dispose", () => {
            jest.spyOn(notificationState, "off");

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            vm.dispose();
            expect(notificationState.off).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));
        });
    });
});
