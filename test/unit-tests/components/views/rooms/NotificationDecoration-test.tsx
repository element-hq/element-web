/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";

import { RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { NotificationDecoration } from "../../../../../src/components/views/rooms/NotificationDecoration";
import { createTestClient, mkStubRoom } from "../../../../test-utils";

describe("<NotificationDecoration />", () => {
    let roomNotificationState: RoomNotificationState;
    beforeEach(() => {
        const matrixClient = createTestClient();
        const room = mkStubRoom("roomId", "roomName", matrixClient);
        roomNotificationState = new RoomNotificationState(room, false);
    });

    it("should not render if RoomNotificationState.hasAnyNotificationOrActivity=true", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(false);
        render(<NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />);
        expect(screen.queryByTestId("notification-decoration")).toBeNull();
    });

    it("should render the unset message decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "isUnsentMessage", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the invitation decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "invited", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the mention decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "isMention", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "count", "get").mockReturnValue(1);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "isNotification", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "count", "get").mockReturnValue(1);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration without count", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "isNotification", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "count", "get").mockReturnValue(0);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the activity decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "isActivityNotification", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the muted decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(roomNotificationState, "muted", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={false} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
    it("should render the video decoration", () => {
        jest.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(false);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} hasVideoCall={true} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
