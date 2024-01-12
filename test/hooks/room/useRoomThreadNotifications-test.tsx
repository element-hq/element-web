/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { renderHook } from "@testing-library/react-hooks/dom";
import { MatrixClient, NotificationCountType, Room } from "matrix-js-sdk/src/matrix";

import { useRoomThreadNotifications } from "../../../src/hooks/room/useRoomThreadNotifications";
import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { NotificationColor } from "../../../src/stores/notifications/NotificationColor";
import { populateThread } from "../../test-utils/threads";

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

        expect(result.current).toBe(NotificationColor.None);
    });

    it("returns red if a thread in the room has a highlight notification", async () => {
        room.setThreadUnreadNotificationCount("flooble", NotificationCountType.Highlight, 1);
        const { result } = render(room);

        expect(result.current).toBe(NotificationColor.Red);
    });

    it("returns grey if a thread in the room has a normal notification", async () => {
        room.setThreadUnreadNotificationCount("flooble", NotificationCountType.Total, 1);
        const { result } = render(room);

        expect(result.current).toBe(NotificationColor.Grey);
    });

    it("returns bold if a thread in the room unread messages", async () => {
        await populateThread({
            room,
            client: cli,
            authorId: cli.getSafeUserId(),
            participantUserIds: ["@alice:server.org"],
        });

        const { result } = render(room);

        expect(result.current).toBe(NotificationColor.Bold);
    });
});
