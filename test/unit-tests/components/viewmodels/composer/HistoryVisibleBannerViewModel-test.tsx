/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room } from "matrix-js-sdk/src/matrix";

import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import SettingsStore, { type CallbackFn } from "../../../../../src/settings/SettingsStore";
import { mkEvent, stubClient, upsertRoomStateEvents } from "../../../../test-utils";
import { HistoryVisibleBannerViewModel } from "../../../../../src/viewmodels/composer/HistoryVisibleBannerViewModel";

describe("HistoryVisibleBannerViewModel", () => {
    const ROOM_ID = "!roomId:example.org";

    let room: Room;
    let watcherCallbacks: CallbackFn[];
    let acknowledgedHistoryVisibility: boolean;

    beforeEach(() => {
        watcherCallbacks = [];
        acknowledgedHistoryVisibility = false;

        jest.spyOn(SettingsStore, "setValue").mockImplementation(async (settingName, roomId, level, value) => {
            if (settingName === "acknowledgedHistoryVisibility") {
                acknowledgedHistoryVisibility = value;
            }
            watcherCallbacks.forEach((callbackFn) => callbackFn(settingName, roomId, level, value, value));
        });

        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName, roomId) => {
            if (settingName === "acknowledgedHistoryVisibility") {
                return acknowledgedHistoryVisibility;
            }
            if (settingName === "feature_share_history_on_invite") {
                return true;
            }
            return SettingsStore.getDefaultValue(settingName);
        });

        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, roomId, callbackFn) => {
            watcherCallbacks.push(callbackFn);
            return `mockWatcherId-${settingName}-${roomId}`;
        });

        stubClient();
        room = new Room(ROOM_ID, {} as any, "@user:example.org");
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should not show the banner in unencrypted rooms", () => {
        const vm = new HistoryVisibleBannerViewModel({ room, threadId: null });
        expect(vm.getSnapshot().visible).toBe(false);
    });

    it("should not show the banner in encrypted rooms with joined history visibility", () => {
        upsertRoomStateEvents(room, [
            mkEvent({
                event: true,
                type: "m.room.encryption",
                user: "@user1:server",
                content: {},
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                content: {
                    history_visibility: "joined",
                },
                user: "@user1:server",
            }),
        ]);

        const vm = new HistoryVisibleBannerViewModel({ room, threadId: null });
        expect(vm.getSnapshot().visible).toBe(false);
    });

    it("should not show the banner if it has been dismissed", async () => {
        await SettingsStore.setValue("acknowledgedHistoryVisibility", ROOM_ID, SettingLevel.ROOM_ACCOUNT, true);
        upsertRoomStateEvents(room, [
            mkEvent({
                event: true,
                type: "m.room.encryption",
                user: "@user1:server",
                content: {},
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                user: "@user1:server",
                content: {
                    history_visibility: "shared",
                },
            }),
        ]);

        const vm = new HistoryVisibleBannerViewModel({ room, threadId: null });
        expect(vm.getSnapshot().visible).toBe(false);
        vm.dispose();
    });

    it("should not show the banner in threads", () => {
        upsertRoomStateEvents(room, [
            mkEvent({
                event: true,
                type: "m.room.encryption",
                user: "@user1:server",
                content: {},
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                user: "@user1:server",
                content: {
                    history_visibility: "shared",
                },
            }),
        ]);

        const vm = new HistoryVisibleBannerViewModel({ room, threadId: "some thread ID" });
        expect(vm.getSnapshot().visible).toBe(false);
        vm.dispose();
    });

    it("should show the banner in encrypted rooms with non-joined history visibility", async () => {
        upsertRoomStateEvents(room, [
            mkEvent({
                event: true,
                type: "m.room.encryption",
                user: "@user1:server",
                content: {},
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                user: "@user1:server",
                content: {
                    history_visibility: "shared",
                },
            }),
        ]);

        const vm = new HistoryVisibleBannerViewModel({ room, threadId: null });
        expect(vm.getSnapshot().visible).toBe(true);
        await vm.onClose();
        expect(vm.getSnapshot().visible).toBe(false);
    });
});
