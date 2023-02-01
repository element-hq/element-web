/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { renderHook } from "@testing-library/react-hooks";
import { EventStatus, NotificationCountType, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import { Room } from "matrix-js-sdk/src/matrix";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { useUnreadNotifications } from "../../src/hooks/useUnreadNotifications";
import { NotificationColor } from "../../src/stores/notifications/NotificationColor";
import { mkEvent, muteRoom, stubClient } from "../test-utils";

describe("useUnreadNotifications", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room:example.org", client, "@user:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    function setUnreads(greys: number, reds: number): void {
        room.setUnreadNotificationCount(NotificationCountType.Highlight, reds);
        room.setUnreadNotificationCount(NotificationCountType.Total, greys);
    }

    it("shows nothing by default", async () => {
        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, symbol, count } = result.current;

        expect(symbol).toBe(null);
        expect(color).toBe(NotificationColor.None);
        expect(count).toBe(0);
    });

    it("indicates if there are unsent messages", async () => {
        const event = mkEvent({
            event: true,
            type: "m.message",
            user: "@user:example.org",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
        room.addPendingEvent(event, "txn");

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, symbol, count } = result.current;

        expect(symbol).toBe("!");
        expect(color).toBe(NotificationColor.Unsent);
        expect(count).toBeGreaterThan(0);
    });

    it("indicates the user has been invited to a channel", async () => {
        room.updateMyMembership("invite");

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, symbol, count } = result.current;

        expect(symbol).toBe("!");
        expect(color).toBe(NotificationColor.Red);
        expect(count).toBeGreaterThan(0);
    });

    it("shows nothing for muted channels", async () => {
        setUnreads(999, 999);
        muteRoom(room);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, count } = result.current;

        expect(color).toBe(NotificationColor.None);
        expect(count).toBe(0);
    });

    it("uses the correct number of unreads", async () => {
        setUnreads(999, 0);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, count } = result.current;

        expect(color).toBe(NotificationColor.Grey);
        expect(count).toBe(999);
    });

    it("uses the correct number of highlights", async () => {
        setUnreads(0, 888);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { color, count } = result.current;

        expect(color).toBe(NotificationColor.Red);
        expect(count).toBe(888);
    });
});
