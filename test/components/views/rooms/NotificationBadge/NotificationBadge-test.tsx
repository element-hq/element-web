/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { fireEvent, render } from "@testing-library/react";
import React from "react";

import { StatelessNotificationBadge } from "../../../../../src/components/views/rooms/NotificationBadge/StatelessNotificationBadge";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { NotificationLevel } from "../../../../../src/stores/notifications/NotificationLevel";
import NotificationBadge from "../../../../../src/components/views/rooms/NotificationBadge";
import { NotificationState } from "../../../../../src/stores/notifications/NotificationState";

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
