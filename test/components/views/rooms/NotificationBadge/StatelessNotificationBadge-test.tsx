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

import React from "react";
import { render } from "@testing-library/react";

import { StatelessNotificationBadge } from "../../../../../src/components/views/rooms/NotificationBadge/StatelessNotificationBadge";
import { NotificationColor } from "../../../../../src/stores/notifications/NotificationColor";

describe("StatelessNotificationBadge", () => {
    it("is highlighted when unsent", () => {
        const { container } = render(
            <StatelessNotificationBadge symbol="!" count={0} color={NotificationColor.Unsent} />,
        );
        expect(container.querySelector(".mx_NotificationBadge_highlighted")).not.toBe(null);
    });
});
