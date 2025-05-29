/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, waitFor } from "jest-matrix-react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { createTestClient, mkStubRoom } from "../../../../test-utils";
import { type MessagePreview, MessagePreviewStore } from "../../../../../src/stores/room-list/MessagePreviewStore";
import { useMessagePreviewViewModel } from "../../../../../src/components/viewmodels/roomlist/MessagePreviewViewModel";

describe("MessagePreviewViewModel", () => {
    let room: Room;

    beforeEach(() => {
        const matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);
    });

    it("should do an initial fetch of the message preview", async () => {
        // Mock the store to return some text.
        jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockImplementation(async (room) => {
            return { text: "Hello world!" } as MessagePreview;
        });

        const { result: vm } = renderHook(() => useMessagePreviewViewModel(room));

        // Eventually, vm.message should have the text from the store.
        await waitFor(() => {
            expect(vm.current.message).toEqual("Hello world!");
        });
    });

    it("should fetch message preview again on update from store", async () => {
        // Mock the store to return the text in variable message.
        let message = "Hello World!";
        jest.spyOn(MessagePreviewStore.instance, "getPreviewForRoom").mockImplementation(async (room) => {
            return { text: message } as MessagePreview;
        });
        jest.spyOn(MessagePreviewStore, "getPreviewChangedEventName").mockImplementation((room) => {
            return "UPDATE";
        });

        const { result: vm } = renderHook(() => useMessagePreviewViewModel(room));

        // Let's assume the message changed.
        message = "New message!";
        MessagePreviewStore.instance.emit("UPDATE");

        /// vm.message should be the updated message.
        await waitFor(() => {
            expect(vm.current.message).toEqual(message);
        });
    });
});
