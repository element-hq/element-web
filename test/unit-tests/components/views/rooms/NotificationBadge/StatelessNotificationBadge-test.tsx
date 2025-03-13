/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { StatelessNotificationBadge } from "../../../../../../src/components/views/rooms/NotificationBadge/StatelessNotificationBadge";
import { NotificationLevel } from "../../../../../../src/stores/notifications/NotificationLevel";

describe("StatelessNotificationBadge", () => {
    it("is highlighted when unsent", () => {
        const { container } = render(
            <StatelessNotificationBadge symbol="!" count={0} level={NotificationLevel.Unsent} />,
        );
        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).not.toBe(null);
    });

    it("has knock style", () => {
        const { container } = render(
            <StatelessNotificationBadge symbol="!" count={0} level={NotificationLevel.Highlight} knocked={true} />,
        );
        expect(container.querySelector(".mx_NotificationBadge_dot")).not.toBeInTheDocument();
        expect(container.querySelector(".mx_NotificationBadge_knocked")).toBeInTheDocument();
    });

    it("has dot style for activity", () => {
        const { container } = render(
            <StatelessNotificationBadge symbol={null} count={3} level={NotificationLevel.Activity} />,
        );
        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeInTheDocument();
    });

    it("has badge style for notification", () => {
        const { container } = render(
            <StatelessNotificationBadge symbol={null} count={3} level={NotificationLevel.Notification} />,
        );
        expect(container.querySelector(".mx_NotificationBadge_dot")).not.toBeInTheDocument();
    });

    it("has dot style for notification when forced", () => {
        const { container } = render(
            <StatelessNotificationBadge
                symbol={null}
                count={3}
                level={NotificationLevel.Notification}
                forceDot={true}
            />,
        );
        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeInTheDocument();
    });
});
