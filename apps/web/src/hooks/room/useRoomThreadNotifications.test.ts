/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "test-utils-rtl";
import {
    EventType,
    type MatrixClient,
    MatrixEventEvent,
    NotificationCountType,
    RelationType,
    Room,
} from "matrix-js-sdk/src/matrix";
import { decryptExistingEvent, mkMatrixEvent } from "matrix-js-sdk/src/testing";
import { stubClient } from "test-utils";
import { populateThread } from "test-utils/threads";

import { useRoomThreadNotifications } from "../../hooks/room/useRoomThreadNotifications";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { NotificationLevel } from "../../stores/notifications/NotificationLevel";

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

    it("returns activity once a thread reply which arrived undecryptable gets decrypted", async () => {
        // A thread whose latest reply we sent ourselves, so it starts out read.
        const { rootEvent } = await populateThread({
            room,
            client: cli,
            authorId: cli.getSafeUserId(),
            participantUserIds: [cli.getSafeUserId()],
        });

        const { result } = render(room);
        expect(result.current).toBe(NotificationLevel.None);

        // Somebody else replies in the thread, but the room key has not arrived yet, so the
        // event cannot be decrypted. An undecryptable event has no renderer, so it does not
        // count towards the unread state.
        const reply = mkMatrixEvent({
            type: EventType.RoomMessageEncrypted,
            roomId: room.roomId,
            sender: "@alice:server.org",
            ts: 10,
            content: {
                "algorithm": "m.megolm.v1.aes-sha2",
                "m.relates_to": { rel_type: RelationType.Thread, event_id: rootEvent.getId()! },
            },
        });
        await act(async () => {
            await room.addLiveEvents([reply], { addToState: false });
        });
        expect(result.current).toBe(NotificationLevel.None);

        // The room key turns up and the reply is decrypted: it now counts as unread.
        await decryptExistingEvent(reply, {
            plainType: EventType.RoomMessage,
            plainContent: { msgtype: "m.text", body: "hello" },
        });
        act(() => {
            cli.emit(MatrixEventEvent.Decrypted, reply);
        });

        expect(result.current).toBe(NotificationLevel.Activity);
    });
});
