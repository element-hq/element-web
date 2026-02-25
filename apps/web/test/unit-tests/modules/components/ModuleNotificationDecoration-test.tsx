/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { render, screen } from "jest-matrix-react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { ModuleNotificationDecoration } from "../../../../src/modules/components/ModuleNotificationDecoration";
import { mkStubRoom, stubClient } from "../../../test-utils";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";
import { RoomNotificationStateStore } from "../../../../src/stores/notifications/RoomNotificationStateStore";
import { RoomNotificationState } from "../../../../src/stores/notifications/RoomNotificationState";

class MockedNotificationState extends RoomNotificationState {
    public constructor(room: Room, level: NotificationLevel, count: number) {
        super(room, false);
        this._level = level;
        this._count = count;
    }
}

it("Should be able to render component just with room as prop", () => {
    const cli = stubClient();
    const room = mkStubRoom("!foo:matrix.org", "Foo Room", cli);
    jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(
        new MockedNotificationState(room, NotificationLevel.Notification, 5),
    );
    render(<ModuleNotificationDecoration room={room} />);
    expect(screen.getByTestId("notification-decoration")).toBeInTheDocument();
});
