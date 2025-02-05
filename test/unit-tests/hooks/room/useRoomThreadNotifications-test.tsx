/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { type MatrixClient, NotificationCountType, Room } from "matrix-js-sdk/src/matrix";

import { useRoomThreadNotifications } from "../../../../src/hooks/room/useRoomThreadNotifications";
import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";
import { populateThread } from "../../../test-utils/threads";

function render(room: Room) {
    return renderHook(() => useRoomThreadNotifications(room));
}

describe("useRoomThreadNotifications", () => {
    let cli: MatrixClient;
    let room: Room;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.supportsThreads = () => true;
        room = new Room("!room:server", cli, cli.getSafeUserId());
    });

    it("returns none if no thread in the room has notifications", async () => {
        const { result } = render(room);

        expect(result.current).toBe(NotificationLevel.None);
    });

    it("returns none if the thread hasn't a notification anymore", async () => {
        room.setThreadUnreadNotificationCount("flooble", NotificationCountType.Highlight, 0);
        const { result } = render(room);

        expect(result.current).toBe(NotificationLevel.None);
    });

    it("returns red if a thread in the room has a highlight notification", async () => {
        room.setThreadUnreadNotificationCount("flooble", NotificationCountType.Highlight, 1);
        const { result } = render(room);

        expect(result.current).toBe(NotificationLevel.Highlight);
    });

    it("returns grey if a thread in the room has a normal notification", async () => {
        room.setThreadUnreadNotificationCount("flooble", NotificationCountType.Total, 1);
        const { result } = render(room);

        expect(result.current).toBe(NotificationLevel.Notification);
    });

    it("returns activity if a thread in the room unread messages", async () => {
        await populateThread({
            room,
            client: cli,
            authorId: cli.getSafeUserId(),
            participantUserIds: ["@alice:server.org"],
        });

        const { result } = render(room);

        expect(result.current).toBe(NotificationLevel.Activity);
    });
});
