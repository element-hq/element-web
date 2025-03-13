/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, render } from "jest-matrix-react";
import React from "react";

import { StatelessNotificationBadge } from "../../../../../../src/components/views/rooms/NotificationBadge/StatelessNotificationBadge";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { NotificationLevel } from "../../../../../../src/stores/notifications/NotificationLevel";
import NotificationBadge from "../../../../../../src/components/views/rooms/NotificationBadge";
import { NotificationState } from "../../../../../../src/stores/notifications/NotificationState";

class DummyNotificationState extends NotificationState {
    constructor(level: NotificationLevel) {
        super();
        this._level = level;
    }
}

describe("NotificationBadge", () => {
    it("shows a dot if the level is activity", () => {
        const notif = new DummyNotificationState(NotificationLevel.Activity);

        const { container } = render(<NotificationBadge roomId="!foo:bar" notification={notif} />);
        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeInTheDocument();
        expect(container.querySelector(".mx_NotificationBadge")).toBeInTheDocument();
    });

    it("does not show a dot if the level is activity and hideIfDot is true", () => {
        const notif = new DummyNotificationState(NotificationLevel.Activity);

        const { container } = render(<NotificationBadge roomId="!foo:bar" notification={notif} hideIfDot={true} />);
        expect(container.querySelector(".mx_NotificationBadge_dot")).not.toBeInTheDocument();
        expect(container.querySelector(".mx_NotificationBadge")).not.toBeInTheDocument();
    });

    it("still shows an empty badge if hideIfDot us true", () => {
        const notif = new DummyNotificationState(NotificationLevel.Notification);

        const { container } = render(<NotificationBadge roomId="!foo:bar" notification={notif} hideIfDot={true} />);
        expect(container.querySelector(".mx_NotificationBadge_dot")).not.toBeInTheDocument();
        expect(container.querySelector(".mx_NotificationBadge")).toBeInTheDocument();
    });

    describe("StatelessNotificationBadge", () => {
        it("lets you click it", () => {
            const cb = jest.fn();

            const { getByRole } = render(
                <StatelessNotificationBadge symbol="" level={NotificationLevel.Highlight} count={5} onClick={cb} />,
            );

            fireEvent.click(getByRole("button")!);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it("hides the bold icon when the settings is set", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                return name === "feature_hidebold";
            });

            const { container } = render(
                <StatelessNotificationBadge symbol="" level={NotificationLevel.Activity} count={1} />,
            );

            expect(container.firstChild).toBeNull();
        });
    });
});
