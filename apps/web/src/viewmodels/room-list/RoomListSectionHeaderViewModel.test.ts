/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { createTestClient, mkRoom } from "test-utils";

import { RoomListSectionHeaderViewModel } from "./RoomListSectionHeaderViewModel";
import { RoomNotificationState } from "../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";
import { CallStore } from "../../stores/CallStore";
import { type Call } from "../../models/Call";
import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { CHATS_TAG, type SectionExpansionState } from "../../stores/room-list-v3/section";

describe("RoomListSectionHeaderViewModel", () => {
    let onToggleExpanded: Mock;
    let matrixClient: MatrixClient;
    // In-memory backing store shared between the getValue/setValue mocks so that
    // persisted expansion state round-trips within a test.
    let sectionExpansionState: SectionExpansionState;

    beforeEach(() => {
        onToggleExpanded = vi.fn();
        matrixClient = createTestClient();
        sectionExpansionState = {};
        vi.spyOn(SettingsStore, "watchSetting").mockReturnValue("watcher-id");
        vi.spyOn(SettingsStore, "unwatchSetting").mockReturnValue(undefined);
        vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "RoomList.OrderedCustomSections") return [];
            if (setting === "RoomList.SectionExpansionState") return sectionExpansionState;
            return null;
        });
        vi.spyOn(SettingsStore, "setValue").mockImplementation(async (setting, _roomId, _level, value) => {
            if (setting === "RoomList.SectionExpansionState") {
                sectionExpansionState = value as SectionExpansionState;
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    it("should initialize expanded state from the persisted setting", () => {
        sectionExpansionState = { "!space:server": { "m.favourite": false } };

        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });

        expect(vm.getSnapshot().isExpanded).toBe(false);
    });

    it("should persist the expanded state at the device level on click", () => {
        const setValue = vi.spyOn(SettingsStore, "setValue");
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });

        vm.onClick();

        expect(setValue).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
            "!space:server": { "m.favourite": false },
        });
        expect(sectionExpansionState).toEqual({ "!space:server": { "m.favourite": false } });
    });

    it("should persist the expanded state at the device level when set via the setter", () => {
        const setValue = vi.spyOn(SettingsStore, "setValue");
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            spaceId: "!space:server",
            onToggleExpanded,
        });

        vm.isExpanded = false;

        expect(setValue).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
            "!space:server": { "m.favourite": false },
        });
    });

    describe("displaySectionMenu", () => {
        it.each([
            [DefaultTagID.Favourite, false],
            [DefaultTagID.LowPriority, false],
            [CHATS_TAG, false],
            [DefaultTagID.DM, false],
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

    describe("canBeReordered", () => {
        const customTag = "element.io.section.custom";

        beforeEach(() => {
            // A header is only rendered for a custom section that exists in the settings
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.CustomSectionData") return { [customTag]: { tag: customTag, name: "A" } };
                if (setting === "RoomList.SectionExpansionState") return sectionExpansionState;
                return null;
            });
        });

        it.each([
            [DefaultTagID.Favourite, false],
            [DefaultTagID.LowPriority, false],
            [CHATS_TAG, true],
            [DefaultTagID.DM, true],
            [customTag, true],
            ["element.io.section.deleted", false],
        ])("should be %s for tag %s", (tag, expected) => {
            const vm = new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });
            expect(vm.getSnapshot().canBeReordered).toBe(expected);
        });
    });

    describe("acceptedRoomKind", () => {
        function makeViewModel(tag: string, showPeopleSection = true): RoomListSectionHeaderViewModel {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.showPeopleSection") return showPeopleSection;
                if (setting === "RoomList.SectionExpansionState") return sectionExpansionState;
                return null;
            });
            return new RoomListSectionHeaderViewModel({
                tag,
                title: "Section",
                spaceId: "!space:server",
                onToggleExpanded,
            });
        }

        it.each([
            [DefaultTagID.DM, "dm"],
            [CHATS_TAG, "nonDm"],
            [DefaultTagID.Favourite, undefined],
            [DefaultTagID.LowPriority, undefined],
            ["element.io.section.custom", undefined],
        ])("should be %s for tag %s when the People section is shown", (tag, expected) => {
            expect(makeViewModel(tag).getSnapshot().acceptedRoomKind).toBe(expected);
        });

        it("should let the Chats section accept any room when the People section is hidden", () => {
            expect(makeViewModel(CHATS_TAG, false).getSnapshot().acceptedRoomKind).toBeUndefined();
        });
    });

    describe("onCustomSectionDataChange", () => {
        let watchCallback: () => void;

        beforeEach(() => {
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
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

            vi.spyOn(SettingsStore, "getValue").mockReturnValue({ [tag]: { tag, name: "New Title" } });
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

            vi.spyOn(SettingsStore, "getValue").mockReturnValue({});
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
            const editSectionSpy = vi.spyOn(RoomListStoreV3.instance, "editSection").mockResolvedValue(undefined);
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
                on: vi.fn(),
                off: vi.fn(),
                hasAnyNotificationOrActivity: false,
            } as unknown as RoomNotificationState;
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(mockState);
        });

        it("should delegate to RoomListStoreV3.instance.removeSection with isEmpty=true when no rooms", async () => {
            const removeSectionSpy = vi.spyOn(RoomListStoreV3.instance, "removeSection").mockResolvedValue(undefined);
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
            const removeSectionSpy = vi.spyOn(RoomListStoreV3.instance, "removeSection").mockResolvedValue(undefined);
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
            vi.useFakeTimers();
            room = mkRoom(matrixClient, "!room:server");
            notificationState = new RoomNotificationState(room, false);
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        });

        afterEach(() => {
            vi.useRealTimers();
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
            vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

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

            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                .mockReturnValueOnce(notificationState)
                .mockReturnValue(notificationState2);

            vi.spyOn(notificationState, "on");
            vi.spyOn(notificationState, "off");
            vi.spyOn(notificationState2, "on");

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

            vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            notificationState.emit(NotificationStateEvents.Update);

            vi.advanceTimersByTime(200);
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
                vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
                vi.spyOn(notificationState, "isActivityNotification", "get").mockReturnValue(true);

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

                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                    .mockReturnValueOnce(notificationState)
                    .mockReturnValue(notificationState2);

                vi.spyOn(notificationState, "isMention", "get").mockReturnValue(true);
                vi.spyOn(notificationState, "count", "get").mockReturnValue(3);
                vi.spyOn(notificationState, "hasUnreadCount", "get").mockReturnValue(true);

                vi.spyOn(notificationState2, "isNotification", "get").mockReturnValue(true);
                vi.spyOn(notificationState2, "count", "get").mockReturnValue(9);
                vi.spyOn(notificationState2, "hasUnreadCount", "get").mockReturnValue(true);

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
                vi.spyOn(notificationState, "isUnsentMessage", "get").mockReturnValue(true);

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
                vi.spyOn(notificationState, "invited", "get").mockReturnValue(true);

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

                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                    .mockReturnValueOnce(notificationState)
                    .mockReturnValue(notificationState2);

                const voiceCall = {
                    participants: new Map([["@a:server", new Set(["DEVICE"])]]),
                    callType: CallType.Voice,
                    on: vi.fn(),
                    off: vi.fn(),
                } as unknown as Call;
                const videoCall = {
                    participants: new Map([["@b:server", new Set(["DEVICE"])]]),
                    callType: CallType.Video,
                    on: vi.fn(),
                    off: vi.fn(),
                } as unknown as Call;
                vi.spyOn(CallStore.instance, "getCall").mockImplementation((roomId) =>
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
                    on: vi.fn(),
                    off: vi.fn(),
                } as unknown as Call;
                vi.spyOn(CallStore.instance, "getCall").mockReturnValue(call);

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
                vi.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
                vi.spyOn(notificationState, "isNotification", "get").mockReturnValue(true);
                vi.spyOn(notificationState, "count", "get").mockReturnValue(0);
                vi.spyOn(notificationState, "hasUnreadCount", "get").mockReturnValue(false);

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

                vi.spyOn(notificationState, "isMention", "get").mockReturnValue(true);
                notificationState.emit(NotificationStateEvents.Update);

                vi.advanceTimersByTime(200);
                expect(vm.getSnapshot().notification?.isMention).toBe(true);
            });
        });

        it("should unsubscribe from all notification states on dispose", () => {
            vi.spyOn(notificationState, "off");

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
