/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";
import { mkStubRoom, stubClient } from "test-utils";

import type { Room } from "matrix-js-sdk/src/matrix";
import { ModuleNotificationDecoration } from "./ModuleNotificationDecoration";
import { NotificationLevel } from "../../stores/notifications/NotificationLevel";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { RoomNotificationState } from "../../stores/notifications/RoomNotificationState";

class MockedNotificationState extends RoomNotificationState {
    public constructor(room: Room, level: NotificationLevel, count: number) {
        super(room, false);
        this._level = level;
        this._count = count;
    }
}

describe("ModuleNotificationDecoration", () => {
    it("Should be able to render component just with room as prop", () => {
        const cli = stubClient();
        const room = mkStubRoom("!foo:matrix.org", "Foo Room", cli);
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(
            new MockedNotificationState(room, NotificationLevel.Notification, 5),
        );
        render(<ModuleNotificationDecoration room={room} />);
        expect(screen.getByTestId("notification-decoration")).toBeInTheDocument();
    });
});
