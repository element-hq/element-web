/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MockedObject } from "jest-mock";
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";

import { VideoRoomChatButton } from "../../../../../src/components/views/rooms/RoomHeader/VideoRoomChatButton";
import { SDKContext, SdkContextClass } from "../../../../../src/contexts/SDKContext";
import RightPanelStore from "../../../../../src/stores/right-panel/RightPanelStore";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";
import { RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { NotificationLevel } from "../../../../../src/stores/notifications/NotificationLevel";
import { NotificationStateEvents } from "../../../../../src/stores/notifications/NotificationState";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";

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
            wrapper: ({ children }) => (
                <SDKContext.Provider value={sdkContext}>
                    <TooltipProvider>{children}</TooltipProvider>
                </SDKContext.Provider>
            ),
        });

    beforeEach(() => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
        });
        rightPanelStore = {
            showOrHidePanel: jest.fn(),
        } as unknown as MockedObject<RightPanelStore>;
        sdkContext = new SdkContextClass();
        sdkContext.client = client;
        jest.spyOn(sdkContext, "rightPanelStore", "get").mockReturnValue(rightPanelStore);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not render button when room is not a video room", () => {
        const room = makeRoom(false);
        getComponent(room);

        expect(screen.queryByLabelText("Chat")).not.toBeInTheDocument();
    });

    it("renders button when room is a video room", () => {
        const room = makeRoom();
        getComponent(room);

        expect(screen.getByLabelText("Chat")).toMatchSnapshot();
    });

    it("toggles timeline in right panel on click", () => {
        const room = makeRoom();
        getComponent(room);

        fireEvent.click(screen.getByLabelText("Chat"));

        expect(sdkContext.rightPanelStore.showOrHidePanel).toHaveBeenCalledWith(RightPanelPhases.Timeline);
    });

    it("renders button with an unread marker when room is unread", () => {
        const room = makeRoom();
        mockRoomNotificationState(room, NotificationLevel.Activity);
        getComponent(room);

        // snapshot includes `data-indicator` attribute
        expect(screen.getByLabelText("Chat")).toMatchSnapshot();
        expect(screen.getByLabelText("Chat").hasAttribute("data-indicator")).toBeTruthy();
    });

    it("adds unread marker when room notification state changes to unread", () => {
        const room = makeRoom();
        // start in read state
        const notificationState = mockRoomNotificationState(room, NotificationLevel.None);
        getComponent(room);

        // no unread marker
        expect(screen.getByLabelText("Chat").hasAttribute("data-indicator")).toBeFalsy();

        // @ts-ignore ugly mocking
        notificationState._level = NotificationLevel.Highlight;
        notificationState.emit(NotificationStateEvents.Update);

        // unread marker
        expect(screen.getByLabelText("Chat").hasAttribute("data-indicator")).toBeTruthy();
    });

    it("clears unread marker when room notification state changes to read", () => {
        const room = makeRoom();
        // start in unread state
        const notificationState = mockRoomNotificationState(room, NotificationLevel.Highlight);
        getComponent(room);

        // unread marker
        expect(screen.getByLabelText("Chat").hasAttribute("data-indicator")).toBeTruthy();

        // @ts-ignore ugly mocking
        notificationState._level = NotificationLevel.None;
        notificationState.emit(NotificationStateEvents.Update);

        // unread marker cleared
        expect(screen.getByLabelText("Chat").hasAttribute("data-indicator")).toBeFalsy();
    });
});
