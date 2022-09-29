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

import Notifier from "../src/Notifier";
import { getLocalNotificationAccountDataEventType } from "../src/utils/notifications";
import { getMockClientWithEventEmitter, mkEvent, mkRoom, mockPlatformPeg } from "./test-utils";

describe("Notifier", () => {
    let MockPlatform;
    let accountDataStore = {};

    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue("@bob:example.org"),
        isGuest: jest.fn().mockReturnValue(false),
        getAccountData: jest.fn().mockImplementation(eventType => accountDataStore[eventType]),
        setAccountData: jest.fn().mockImplementation((eventType, content) => {
            accountDataStore[eventType] = new MatrixEvent({
                type: eventType,
                content,
            });
        }),
    });
    const accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId);
    const roomId = "!room1:server";
    const testEvent = mkEvent({
        event: true,
        type: "m.room.message",
        user: "@user1:server",
        room: roomId,
        content: {},
    });
    const testRoom = mkRoom(mockClient, roomId);

    beforeEach(() => {
        accountDataStore = {};
        MockPlatform = mockPlatformPeg({
            supportsNotifications: jest.fn().mockReturnValue(true),
            maySendNotifications: jest.fn().mockReturnValue(true),
            displayNotification: jest.fn(),
        });

        Notifier.isBodyEnabled = jest.fn().mockReturnValue(true);
    });

    describe("_displayPopupNotification", () => {
        it.each([
            { silenced: true, count: 0 },
            { silenced: false, count: 1 },
        ])("does not dispatch when notifications are silenced", ({ silenced, count }) => {
            mockClient.setAccountData(accountDataEventKey, { is_silenced: silenced });
            Notifier._displayPopupNotification(testEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledTimes(count);
        });
    });

    describe("_playAudioNotification", () => {
        it.each([
            { silenced: true, count: 0 },
            { silenced: false, count: 1 },
        ])("does not dispatch when notifications are silenced", ({ silenced, count }) => {
            // It's not ideal to only look at whether this function has been called
            // but avoids starting to look into DOM stuff
            Notifier.getSoundForRoom = jest.fn();

            mockClient.setAccountData(accountDataEventKey, { is_silenced: silenced });
            Notifier._playAudioNotification(testEvent, testRoom);
            expect(Notifier.getSoundForRoom).toHaveBeenCalledTimes(count);
        });
    });
});
