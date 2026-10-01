/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { TestSDKContext } from "test-utils";

import TypingStore from "./TypingStore";
import { LOCAL_ROOM_ID_PREFIX } from "../models/LocalRoom";
import SettingsStore from "../settings/SettingsStore";

vi.mock("../settings/SettingsStore", () => ({
    default: {
        getValue: vi.fn(),
        monitorSetting: vi.fn(),
        watchSetting: vi.fn(),
    },
}));

describe("TypingStore", () => {
    let typingStore: TypingStore;
    let mockClient: MatrixClient;
    const roomId = "!test:example.com";
    const localRoomId = LOCAL_ROOM_ID_PREFIX + "test";

    beforeEach(() => {
        mockClient = {
            sendTyping: vi.fn(),
        } as unknown as MatrixClient;
        const context = new TestSDKContext();
        context._client = mockClient;
        typingStore = new TypingStore(context);
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            return name === "sendTypingNotifications";
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
