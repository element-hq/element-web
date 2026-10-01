/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import {
    MatrixEvent,
    NotificationCountType,
    Room,
    type MatrixClient,
    ReceiptType,
    type AccountDataEvents,
} from "matrix-js-sdk/src/matrix";
import { describe, it, expect, beforeEach, afterEach, vi, type Mocked, type MockInstance } from "vitest";
import { getMockClientWithEventEmitter, mockClientMethodsServer } from "test-utils/client";
import { mkMessage, stubClient } from "test-utils/test-utils";

import {
    localNotificationsAreSilenced,
    getLocalNotificationAccountDataEventType,
    createLocalNotificationSettingsIfNeeded,
    deviceNotificationSettingsKeys,
    clearAllNotifications,
    clearRoomNotification,
    notificationLevelToIndicator,
    getThreadNotificationLevel,
    getMarkedUnreadState,
    setMarkedUnreadState,
} from "./notifications";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { NotificationLevel } from "../stores/notifications/NotificationLevel";
import { SettingLevel } from "../settings/SettingLevel";
import MatrixClientBackedController from "../settings/controllers/MatrixClientBackedController";
import SettingsStore from "../settings/SettingsStore";

describe("notifications", () => {
    let accountDataStore: Record<string, MatrixEvent> = {};
    let mockClient: Mocked<MatrixClient>;
    let accountDataEventKey: keyof AccountDataEvents;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            isGuest: vi.fn().mockReturnValue(false),
            getAccountData: vi.fn().mockImplementation((eventType) => accountDataStore[eventType]),
            setAccountData: vi.fn().mockImplementation((eventType, content) => {
                accountDataStore[eventType] = new MatrixEvent({
                    type: eventType,
                    content,
                });
            }),
            isVersionSupported: vi.fn().mockImplementation(async (v) => v === "v1.4"),
        });

        // Ensure unstable settings are supported, otherwise it will use the default value.
        MatrixClientBackedController.matrixClient = mockClient;
        accountDataStore = {};
        accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId!);
        // Disable all notifications
        deviceNotificationSettingsKeys.forEach((k) => SettingsStore.setValue(k, null, SettingLevel.DEVICE, false));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        SettingsStore.reset();
    });

    describe("createLocalNotification", () => {
        it("creates account data event", async () => {
            await createLocalNotificationSettingsIfNeeded(mockClient);
            const event = mockClient.getAccountData(accountDataEventKey);
            expect(event?.getContent().is_silenced).toBe(true);
        });

        it("does not do anything for guests", async () => {
            mockClient.isGuest.mockReset().mockReturnValue(true);
            await createLocalNotificationSettingsIfNeeded(mockClient);
            const event = mockClient.getAccountData(accountDataEventKey);
            expect(event).toBeFalsy();
        });

        it.each(deviceNotificationSettingsKeys)(
            "unsilenced for existing sessions when %s setting is truthy",
            async (settingKey) => {
                // We need to spy `getValue` because setting these keys requires mocking
                // the platform to support notifications, which is out of scope for this test.
                const origFn = SettingsStore.getValue;
                vi.spyOn(SettingsStore, "getValue").mockImplementation((name, ...args) => {
                    if (name === settingKey) {
                        return true;
                    }
                    return origFn(name, ...args);
                });
                await createLocalNotificationSettingsIfNeeded(mockClient);
                const event = mockClient.getAccountData(accountDataEventKey);
                expect(event?.getContent().is_silenced).toBe(false);
            },
        );

        it("does not override an existing account event data", async () => {
            mockClient.setAccountData(accountDataEventKey, {
                is_silenced: false,
            });

            await createLocalNotificationSettingsIfNeeded(mockClient);
            const event = mockClient.getAccountData(accountDataEventKey);
            expect(event?.getContent().is_silenced).toBe(false);
        });
    });

    describe("localNotificationsAreSilenced", () => {
        it("defaults to false when no setting exists", () => {
            expect(localNotificationsAreSilenced(mockClient)).toBeFalsy();
        });
        it("checks the persisted value", () => {
            mockClient.setAccountData(accountDataEventKey, { is_silenced: true });
            expect(localNotificationsAreSilenced(mockClient)).toBeTruthy();

            mockClient.setAccountData(accountDataEventKey, { is_silenced: false });
            expect(localNotificationsAreSilenced(mockClient)).toBeFalsy();
        });
    });

    describe("clearRoomNotification", () => {
        let client: MatrixClient;
        let room: Room;
        let sendReadReceiptSpy: MockInstance;
        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";
        let message: MatrixEvent;

        beforeEach(() => {
            stubClient();
            client = vi.mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
            message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                msg: "Hello",
            });
            room.addLiveEvents([message], { addToState: true });
            sendReadReceiptSpy = vi.spyOn(client, "sendReadReceipt").mockResolvedValue({});
            vi.spyOn(client, "getRooms").mockReturnValue([room]);
            SettingsStore.setValue("sendReadReceipts", null, SettingLevel.DEVICE, true);
        });

        it("sends a request even if everything has been read", async () => {
            await clearRoomNotification(room, client);
            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.Read, true);
        });

        it("marks the room as read even if the receipt failed", async () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 5);
            sendReadReceiptSpy = vi.spyOn(client, "sendReadReceipt").mockReset().mockRejectedValue({ error: 42 });

            await expect(async () => {
                await clearRoomNotification(room, client);
            }).rejects.toEqual({ error: 42 });
            expect(room.getUnreadNotificationCount(NotificationCountType.Total)).toBe(0);
        });

        describe("when sendReadReceipts setting is disabled", () => {
            it("should send a private read receipt", async () => {
                SettingsStore.setValue("sendReadReceipts", null, SettingLevel.DEVICE, false);
                await clearRoomNotification(room, client);
                expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.ReadPrivate, true);
            });
        });
    });

    describe("clearAllNotifications", () => {
        let client: MatrixClient;
        let room: Room;
        let sendReadReceiptSpy: MockInstance;

        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";

        beforeEach(() => {
            stubClient();
            client = vi.mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
            sendReadReceiptSpy = vi.spyOn(client, "sendReadReceipt").mockResolvedValue({});
            vi.spyOn(client, "getRooms").mockReturnValue([room]);
            SettingsStore.setValue("sendReadReceipts", null, SettingLevel.DEVICE, true);
        });

        it("does not send any requests if everything has been read", () => {
            clearAllNotifications(client);
            expect(sendReadReceiptSpy).not.toHaveBeenCalled();
        });

        it("sends unthreaded receipt requests", async () => {
            const message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                ts: 1,
            });
            room.addLiveEvents([message], { addToState: true });
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            await clearAllNotifications(client);

            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.Read, true);
        });

        it("sends private read receipts", async () => {
            const message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                ts: 1,
            });
            room.addLiveEvents([message], { addToState: true });
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            SettingsStore.setValue("sendReadReceipts", null, SettingLevel.DEVICE, false);

            await clearAllNotifications(client);

            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.ReadPrivate, true);
        });
    });

    describe("getMarkedUnreadState", () => {
        let client: MatrixClient;
        let room: Room;

        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";

        beforeEach(() => {
            stubClient();
            client = vi.mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
        });

        it("reads from stable prefix", async () => {
            room.getAccountData = vi.fn().mockImplementation((eventType: string) => {
                if (eventType === "m.marked_unread") {
                    return { getContent: vi.fn().mockReturnValue({ unread: true }) };
                }
                return null;
            });
            expect(getMarkedUnreadState(room)).toBe(true);
        });

        it("reads from unstable prefix", async () => {
            room.getAccountData = vi.fn().mockImplementation((eventType: string) => {
                if (eventType === "com.famedly.marked_unread") {
                    return { getContent: vi.fn().mockReturnValue({ unread: true }) };
                }
                return null;
            });
            expect(getMarkedUnreadState(room)).toBe(true);
        });

        it("returns undefined if neither prefix is present", async () => {
            room.getAccountData = vi.fn().mockImplementation((eventType: string) => {
                return null;
            });
            expect(getMarkedUnreadState(room)).toBe(undefined);
        });
    });

    describe("setUnreadMarker", () => {
        let client: MatrixClient;
        let room: Room;

        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";

        beforeEach(() => {
            stubClient();
            client = vi.mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
        });

        // set true, no existing event
        it("sets unread flag if event doesn't exist", async () => {
            await setMarkedUnreadState(room, client, true);
            expect(client.setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, "m.marked_unread", {
                unread: true,
            });
        });

        // set false, no existing event
        it("does nothing when clearing if flag is false", async () => {
            await setMarkedUnreadState(room, client, false);
            expect(client.setRoomAccountData).not.toHaveBeenCalled();
        });

        // set true, existing event = false
        it("sets unread flag to if existing event is false", async () => {
            room.getAccountData = vi.fn().mockReturnValue({ getContent: vi.fn().mockReturnValue({ unread: false }) });
            await setMarkedUnreadState(room, client, true);
            expect(client.setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, "m.marked_unread", {
                unread: true,
            });
        });

        // set false, existing event = false
        it("does nothing if set false and existing event is false", async () => {
            room.getAccountData = vi.fn().mockReturnValue({ getContent: vi.fn().mockReturnValue({ unread: false }) });
            await setMarkedUnreadState(room, client, false);
            expect(client.setRoomAccountData).not.toHaveBeenCalled();
        });

        // set true, existing event = true
        it("does nothing if setting true and existing event is true", async () => {
            room.getAccountData = vi.fn().mockReturnValue({ getContent: vi.fn().mockReturnValue({ unread: true }) });
            await setMarkedUnreadState(room, client, true);
            expect(client.setRoomAccountData).not.toHaveBeenCalled();
        });

        // set false, existing event = true
        it("sets flag if setting false and existing event is true", async () => {
            room.getAccountData = vi.fn().mockReturnValue({ getContent: vi.fn().mockReturnValue({ unread: true }) });
            await setMarkedUnreadState(room, client, false);
            expect(client.setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, "m.marked_unread", {
                unread: false,
            });
        });
    });

    describe("notificationLevelToIndicator", () => {
        it("returns undefined if notification level is None", () => {
            expect(notificationLevelToIndicator(NotificationLevel.None)).toBeUndefined();
        });

        it("returns default if notification level is Activity", () => {
            expect(notificationLevelToIndicator(NotificationLevel.Activity)).toEqual("default");
        });

        it("returns success if notification level is Notification", () => {
            expect(notificationLevelToIndicator(NotificationLevel.Notification)).toEqual("success");
        });

        it("returns critical if notification level is Highlight", () => {
            expect(notificationLevelToIndicator(NotificationLevel.Highlight)).toEqual("critical");
        });
    });

    describe("getThreadNotificationLevel", () => {
        let room: Room;

        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";

        beforeEach(() => {
            room = new Room(ROOM_ID, MatrixClientPeg.safeGet(), USER_ID);
        });

        it.each([
            { notificationCountType: NotificationCountType.Highlight, expected: NotificationLevel.Highlight },
            { notificationCountType: NotificationCountType.Total, expected: NotificationLevel.Notification },
            { notificationCountType: null, expected: NotificationLevel.Activity },
        ])(
            "returns NotificationLevel $expected when notificationCountType is $expected",
            ({ notificationCountType, expected }) => {
                vi.spyOn(room, "threadsAggregateNotificationType", "get").mockReturnValue(notificationCountType);
                expect(getThreadNotificationLevel(room)).toEqual(expected);
            },
        );
    });
});
