/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Mocked, mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";

import {
    localNotificationsAreSilenced,
    getLocalNotificationAccountDataEventType,
    createLocalNotificationSettingsIfNeeded,
    deviceNotificationSettingsKeys,
    clearAllNotifications,
    clearRoomNotification,
} from "../../src/utils/notifications";
import SettingsStore from "../../src/settings/SettingsStore";
import { getMockClientWithEventEmitter } from "../test-utils/client";
import { mkMessage, stubClient } from "../test-utils/test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";

jest.mock("../../src/settings/SettingsStore");

describe("notifications", () => {
    let accountDataStore: Record<string, MatrixEvent> = {};
    let mockClient: Mocked<MatrixClient>;
    let accountDataEventKey: string;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = getMockClientWithEventEmitter({
            isGuest: jest.fn().mockReturnValue(false),
            getAccountData: jest.fn().mockImplementation((eventType) => accountDataStore[eventType]),
            setAccountData: jest.fn().mockImplementation((eventType, content) => {
                accountDataStore[eventType] = new MatrixEvent({
                    type: eventType,
                    content,
                });
            }),
        });
        accountDataStore = {};
        accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId!);
        mocked(SettingsStore).getValue.mockReturnValue(false);
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
                mocked(SettingsStore).getValue.mockImplementation((key): any => {
                    return key === settingKey;
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
        let sendReadReceiptSpy: jest.SpyInstance;
        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";
        let message: MatrixEvent;
        let sendReceiptsSetting = true;

        beforeEach(() => {
            stubClient();
            client = mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
            message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                msg: "Hello",
            });
            room.addLiveEvents([message]);
            sendReadReceiptSpy = jest.spyOn(client, "sendReadReceipt").mockResolvedValue({});
            jest.spyOn(client, "getRooms").mockReturnValue([room]);
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                return name === "sendReadReceipts" && sendReceiptsSetting;
            });
        });

        it("sends a request even if everything has been read", () => {
            clearRoomNotification(room, client);
            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.Read, true);
        });

        it("marks the room as read even if the receipt failed", async () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 5);
            sendReadReceiptSpy = jest.spyOn(client, "sendReadReceipt").mockReset().mockRejectedValue({ error: 42 });

            await expect(async () => {
                await clearRoomNotification(room, client);
            }).rejects.toEqual({ error: 42 });
            expect(room.getUnreadNotificationCount(NotificationCountType.Total)).toBe(0);
        });

        describe("when sendReadReceipts setting is disabled", () => {
            beforeEach(() => {
                sendReceiptsSetting = false;
            });

            it("should send a private read receipt", () => {
                clearRoomNotification(room, client);
                expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.ReadPrivate, true);
            });
        });
    });

    describe("clearAllNotifications", () => {
        let client: MatrixClient;
        let room: Room;
        let sendReadReceiptSpy: jest.SpyInstance;

        const ROOM_ID = "123";
        const USER_ID = "@bob:example.org";

        beforeEach(() => {
            stubClient();
            client = mocked(MatrixClientPeg.safeGet());
            room = new Room(ROOM_ID, client, USER_ID);
            sendReadReceiptSpy = jest.spyOn(client, "sendReadReceipt").mockResolvedValue({});
            jest.spyOn(client, "getRooms").mockReturnValue([room]);
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                return name === "sendReadReceipts";
            });
        });

        it("does not send any requests if everything has been read", () => {
            clearAllNotifications(client);
            expect(sendReadReceiptSpy).not.toHaveBeenCalled();
        });

        it("sends unthreaded receipt requests", () => {
            const message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                ts: 1,
            });
            room.addLiveEvents([message]);
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            clearAllNotifications(client);

            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.Read, true);
        });

        it("sends private read receipts", () => {
            const message = mkMessage({
                event: true,
                room: ROOM_ID,
                user: USER_ID,
                ts: 1,
            });
            room.addLiveEvents([message]);
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            jest.spyOn(SettingsStore, "getValue").mockReset().mockReturnValue(false);

            clearAllNotifications(client);

            expect(sendReadReceiptSpy).toHaveBeenCalledWith(message, ReceiptType.ReadPrivate, true);
        });
    });
});
