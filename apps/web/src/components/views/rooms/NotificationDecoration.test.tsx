/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { createTestClient, mkStubRoom } from "test-utils";

import { RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { NotificationDecoration } from "./NotificationDecoration";

describe("<NotificationDecoration />", () => {
    let roomNotificationState: RoomNotificationState;
    beforeEach(() => {
        const matrixClient = createTestClient();
        const room = mkStubRoom("roomId", "roomName", matrixClient);
        roomNotificationState = new RoomNotificationState(room, false);
    });

    it("should not render if RoomNotificationState.hasAnyNotificationOrActivity=true", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(false);
        render(<NotificationDecoration notificationState={roomNotificationState} callType={undefined} />);
        expect(screen.queryByTestId("notification-decoration")).toBeNull();
    });

    it("should render the unset message decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "isUnsentMessage", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the invitation decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "invited", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the mention decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "isMention", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "count", "get").mockReturnValue(1);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "isNotification", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "count", "get").mockReturnValue(1);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration without count", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "isNotification", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "count", "get").mockReturnValue(0);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the activity decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "isActivityNotification", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the muted decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        vi.spyOn(roomNotificationState, "muted", "get").mockReturnValue(true);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={undefined} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
    it("should render the video call decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(false);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={CallType.Video} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
    it("should render the audio call decoration", () => {
        vi.spyOn(roomNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(false);
        const { asFragment } = render(
            <NotificationDecoration notificationState={roomNotificationState} callType={CallType.Voice} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
