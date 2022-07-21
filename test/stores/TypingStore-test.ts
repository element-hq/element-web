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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import TypingStore from "../../src/stores/TypingStore";
import { LOCAL_ROOM_ID_PREFIX } from "../../src/models/LocalRoom";
import SettingsStore from "../../src/settings/SettingsStore";

jest.mock("../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
}));

describe("TypingStore", () => {
    let typingStore: TypingStore;
    let mockClient: MatrixClient;
    const settings = {
        "sendTypingNotifications": true,
        "feature_thread": false,
    };
    const roomId = "!test:example.com";
    const localRoomId = LOCAL_ROOM_ID_PREFIX + "test";

    beforeEach(() => {
        typingStore = new TypingStore();
        mockClient = {
            sendTyping: jest.fn(),
        } as unknown as MatrixClient;
        MatrixClientPeg.get = () => mockClient;
        mocked(SettingsStore.getValue).mockImplementation((setting: string) => {
            return settings[setting];
        });
    });

    describe("setSelfTyping", () => {
        it("shouldn't do anything for a local room", () => {
            typingStore.setSelfTyping(localRoomId, null, true);
            expect(mockClient.sendTyping).not.toHaveBeenCalled();
        });

        describe("in typing state true", () => {
            beforeEach(() => {
                typingStore.setSelfTyping(roomId, null, true);
            });

            it("should change to false when setting false", () => {
                typingStore.setSelfTyping(roomId, null, false);
                expect(mockClient.sendTyping).toHaveBeenCalledWith(roomId, false, 30000);
            });

            it("should change to true when setting true", () => {
                typingStore.setSelfTyping(roomId, null, true);
                expect(mockClient.sendTyping).toHaveBeenCalledWith(roomId, true, 30000);
            });
        });

        describe("in typing state false", () => {
            beforeEach(() => {
                typingStore.setSelfTyping(roomId, null, false);
            });

            it("shouldn't change when setting false", () => {
                typingStore.setSelfTyping(roomId, null, false);
                expect(mockClient.sendTyping).not.toHaveBeenCalled();
            });

            it("should change to true when setting true", () => {
                typingStore.setSelfTyping(roomId, null, true);
                expect(mockClient.sendTyping).toHaveBeenCalledWith(roomId, true, 30000);
            });
        });
    });
});
