/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MockedObject } from "jest-mock";
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";

import { VideoRoomChatButton } from "../../../../../../src/components/views/rooms/RoomHeader/VideoRoomChatButton";
import { SDKContext, SdkContextClass } from "../../../../../../src/contexts/SDKContext";
import type RightPanelStore from "../../../../../../src/stores/right-panel/RightPanelStore";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";
import { RoomNotificationState } from "../../../../../../src/stores/notifications/RoomNotificationState";
import { NotificationLevel } from "../../../../../../src/stores/notifications/NotificationLevel";
import { NotificationStateEvents } from "../../../../../../src/stores/notifications/NotificationState";
import { RightPanelPhases } from "../../../../../../src/stores/right-panel/RightPanelStorePhases";

describe("<VideoRoomChatButton />", () => {
    const roomId = "!room:server.org";
    let sdkContext!: SdkContextClass;
    let rightPanelStore!: MockedObject<RightPanelStore>;

    /**
     * Create a room using mocked client
     * And mock isElementVideoRoom
     */
    const makeRoom = (isVideoRoom = true): Room => {
        const room = new Room(roomId, sdkContext.client!, sdkContext.client!.getSafeUserId());
        jest.spyOn(room, "isElementVideoRoom").mockReturnValue(isVideoRoom);
        // stub
        jest.spyOn(room, "getPendingEvents").mockReturnValue([]);
        return room;
    };

    const mockRoomNotificationState = (room: Room, level: NotificationLevel): RoomNotificationState => {
        const roomNotificationState = new RoomNotificationState(room, false);

        // @ts-ignore ugly mocking
        roomNotificationState._level = level;
        jest.spyOn(sdkContext.roomNotificationStateStore, "getRoomState").mockReturnValue(roomNotificationState);
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
            showOrHidePhase: jest.fn(),
        } as unknown as MockedObject<RightPanelStore>;
        sdkContext = new SdkContextClass();
        sdkContext.client = client;
        jest.spyOn(sdkContext, "rightPanelStore", "get").mockReturnValue(rightPanelStore);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
