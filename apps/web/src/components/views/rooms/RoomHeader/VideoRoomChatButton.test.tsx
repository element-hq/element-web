/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { getMockClientWithEventEmitter, mockClientMethodsUser, TestSDKContext } from "test-utils";

import { VideoRoomChatButton } from "./VideoRoomChatButton";
import { SDKContext } from "../../../../contexts/SDKContext";
import type RightPanelStore from "../../../../stores/right-panel/RightPanelStore";
import { RoomNotificationState } from "../../../../stores/notifications/RoomNotificationState";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { NotificationStateEvents } from "../../../../stores/notifications/NotificationState";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";

describe("<VideoRoomChatButton />", () => {
    const roomId = "!room:server.org";
    let sdkContext!: TestSDKContext;
    let rightPanelStore!: MockedObject<RightPanelStore>;

    /**
     * Create a room using mocked client
     * And mock isElementVideoRoom
     */
    const makeRoom = (isVideoRoom = true): Room => {
        const room = new Room(roomId, sdkContext.client!, sdkContext.client!.getSafeUserId());
        vi.spyOn(room, "isElementVideoRoom").mockReturnValue(isVideoRoom);
        // stub
        vi.spyOn(room, "getPendingEvents").mockReturnValue([]);
        return room;
    };

    const mockRoomNotificationState = (room: Room, level: NotificationLevel): RoomNotificationState => {
        const roomNotificationState = new RoomNotificationState(room, false);

        // @ts-ignore ugly mocking
        roomNotificationState._level = level;
        vi.spyOn(sdkContext.roomNotificationStateStore, "getRoomState").mockReturnValue(roomNotificationState);
        return roomNotificationState;
    };

    const getComponent = (room: Room) =>
        render(<VideoRoomChatButton room={room} />, {
            wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
        });

    beforeEach(() => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
        });
        rightPanelStore = {
            showOrHidePhase: vi.fn(),
        } as unknown as MockedObject<RightPanelStore>;
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        vi.spyOn(sdkContext, "rightPanelStore", "get").mockReturnValue(rightPanelStore);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("toggles timeline in right panel on click", () => {
        const room = makeRoom();
        getComponent(room);

        fireEvent.click(screen.getByRole("button", { name: "Chat" }));

        expect(sdkContext.rightPanelStore.showOrHidePhase).toHaveBeenCalledWith(RightPanelPhases.Timeline);
    });

    it("renders button with an unread marker when room is unread", () => {
        const room = makeRoom();
        mockRoomNotificationState(room, NotificationLevel.Activity);
        getComponent(room);

        // snapshot includes `data-indicator` attribute
        expect(screen.getByRole("button", { name: "Chat" })).toMatchSnapshot();
        expect(screen.getByRole("button", { name: "Chat" }).hasAttribute("data-indicator")).toBeTruthy();
    });

    it("adds unread marker when room notification state changes to unread", async () => {
        const room = makeRoom();
        // start in read state
        const notificationState = mockRoomNotificationState(room, NotificationLevel.None);
        getComponent(room);

        // no unread marker
        expect(screen.getByRole("button", { name: "Chat" }).hasAttribute("data-indicator")).toBeFalsy();

        // @ts-ignore ugly mocking
        notificationState._level = NotificationLevel.Highlight;
        notificationState.emit(NotificationStateEvents.Update);

        // unread marker
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Chat" }).hasAttribute("data-indicator")).toBeTruthy(),
        );
    });

    it("clears unread marker when room notification state changes to read", async () => {
        const room = makeRoom();
        // start in unread state
        const notificationState = mockRoomNotificationState(room, NotificationLevel.Highlight);
        getComponent(room);

        // unread marker
        expect(screen.getByRole("button", { name: "Chat" }).hasAttribute("data-indicator")).toBeTruthy();

        // @ts-ignore ugly mocking
        notificationState._level = NotificationLevel.None;
        notificationState.emit(NotificationStateEvents.Update);

        // unread marker cleared
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Chat" }).hasAttribute("data-indicator")).toBeFalsy(),
        );
    });
});
