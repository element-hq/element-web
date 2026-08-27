/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type PropsWithChildren } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "test-utils-rtl";
import { EventType, type MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { useFetchedPinnedEvents } from "./usePinnedEvents";
import MatrixClientContext from "../contexts/MatrixClientContext";

describe("useFetchedPinnedEvents", () => {
    const roomId = "!room:server";
    const userId = "@alice:server";
    const pinnedEventId = "$pinned:server";

    let client: MatrixClient;
    let room: Room;
    // Stable identity: the hook memoises on this array, so a fresh literal per render would
    // refetch forever.
    const pinnedIds = [pinnedEventId];

    const makeEvent = (id: string, content: object): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            room_id: roomId,
            event_id: id,
            origin_server_ts: 0,
            content,
        });

    const edit = (targetId: string, id: string): MatrixEvent =>
        makeEvent(id, {
            "msgtype": "m.text",
            "body": "* edited",
            "m.new_content": { msgtype: "m.text", body: "edited" },
            "m.relates_to": { rel_type: RelationType.Replace, event_id: targetId },
        });

    const wrapper = ({ children }: PropsWithChildren): React.JSX.Element => (
        <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
    );

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, userId);
        // The pinned event is deliberately not in the local timeline, so the hook holds a copy of
        // its own that nothing else keeps up to date.
        vi.spyOn(client, "fetchRoomEvent").mockResolvedValue(
            makeEvent(pinnedEventId, { msgtype: "m.text", body: "original" }).event as never,
        );
        vi.spyOn(client, "relations").mockResolvedValue({ events: [] });
    });

    it("gives the edited content for a pinned event that is edited", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(result.current[0].getContent().body).toBe("original");

        act(() => {
            room.addLiveEvents([edit(pinnedEventId, "$edit:server")], { addToState: false });
        });

        await waitFor(() => expect(result.current[0].getContent().body).toBe("edited"));
    });

    it("leaves a pinned event alone when a different event is edited", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));

        act(() => {
            room.addLiveEvents([edit("$somethingElse:server", "$edit2:server")], { addToState: false });
        });

        // Wait long enough that an edit would have been applied, then confirm none was.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current[0].getContent().body).toBe("original");
    });
});
