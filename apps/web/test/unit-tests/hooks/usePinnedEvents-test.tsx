/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type PropsWithChildren } from "react";
import { renderHook, waitFor } from "jest-matrix-react";
import { EventType, type MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";

import { useFetchedPinnedEvents } from "../../../src/hooks/usePinnedEvents";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../test-utils";

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
        // The pinned event is deliberately not in the local timeline, so every recomputation has
        // to go to the server and is therefore countable.
        jest.spyOn(client, "fetchRoomEvent").mockResolvedValue(
            makeEvent(pinnedEventId, { msgtype: "m.text", body: "original" }).event as never,
        );
        jest.spyOn(client, "relations").mockResolvedValue({ events: [] });
    });

    it("refetches the pinned events when one of them is edited", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(client.fetchRoomEvent).toHaveBeenCalledTimes(1);

        room.addLiveEvents([edit(pinnedEventId, "$edit:server")], { addToState: false });

        await waitFor(() => expect(client.fetchRoomEvent).toHaveBeenCalledTimes(2));
    });

    it("does not refetch when an event that is not pinned is edited", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));

        room.addLiveEvents([edit("$somethingElse:server", "$edit2:server")], { addToState: false });

        // Wait long enough that a refetch would have landed, then confirm none did.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(client.fetchRoomEvent).toHaveBeenCalledTimes(1);
    });
});
