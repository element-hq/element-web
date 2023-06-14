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
import { NotificationColor } from "../../../../../src/stores/notifications/NotificationColor";

describe("NotificationBadge", () => {
    describe("StatelessNotificationBadge", () => {
        it("lets you click it", () => {
            const cb = jest.fn();

            const { container } = render(
                <StatelessNotificationBadge
                    symbol=""
                    color={NotificationColor.Red}
                    count={5}
                    onClick={cb}
                    onMouseOver={cb}
                    onMouseLeave={cb}
                />,
            );

            fireEvent.click(container.firstChild!);
            expect(cb).toHaveBeenCalledTimes(1);

            fireEvent.mouseEnter(container.firstChild!);
            expect(cb).toHaveBeenCalledTimes(2);

            fireEvent.mouseLeave(container.firstChild!);
            expect(cb).toHaveBeenCalledTimes(3);
        });

        it("hides the bold icon when the settings is set", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                return name === "feature_hidebold";
            });

            const { container } = render(
                <StatelessNotificationBadge symbol="" color={NotificationColor.Bold} count={1} />,
            );

            expect(container.firstChild).toBeNull();
        });
    });
});
