/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";

import { type RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { NotificationDecoration } from "../../../../../src/components/views/rooms/NotificationDecoration";

describe("<NotificationDecoration />", () => {
    it("should not render if RoomNotificationState.isSilent=true", () => {
        const state = { hasAnyNotificationOrActivity: false } as RoomNotificationState;
        render(<NotificationDecoration notificationState={state} />);
        expect(screen.queryByTestId("notification-decoration")).toBeNull();
    });

    it("should render the unset message decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, isUnsetMessage: true } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the invitation decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, invited: true } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the mention decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, isMention: true, count: 1 } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, isNotification: true, count: 1 } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification decoration without count", () => {
        const state = { hasAnyNotificationOrActivity: true, isNotification: true, count: 0 } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the activity decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, isActivityNotification: true } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the muted decoration", () => {
        const state = { hasAnyNotificationOrActivity: true, muted: true } as RoomNotificationState;
        const { asFragment } = render(<NotificationDecoration notificationState={state} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
