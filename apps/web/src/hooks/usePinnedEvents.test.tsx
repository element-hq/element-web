/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type PropsWithChildren } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "test-utils-rtl";
import { EventType, type IEvent, type MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";
import { populateThread } from "test-utils/threads";

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

        await act(async () => {
            await room.addLiveEvents([edit(pinnedEventId, "$edit:server")], { addToState: false });
        });

        await waitFor(() => expect(result.current[0].getContent().body).toBe("edited"));
    });

    it("leaves a pinned event alone when a different event is edited", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));

        await act(async () => {
            await room.addLiveEvents([edit("$somethingElse:server", "$edit2:server")], { addToState: false });
        });

        // Wait long enough that an edit would have been applied, then confirm none was.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current[0].getContent().body).toBe("original");
    });

    it("gives the redacted event for a pinned event that is redacted", async () => {
        const { result } = renderHook(() => useFetchedPinnedEvents(room, pinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(result.current[0].isRedacted()).toBe(false);

        // The room has not loaded the pinned event, so only the server can give its redacted form.
        const redaction = makeEvent("$redaction:server", {});
        redaction.event.type = EventType.RoomRedaction;
        redaction.event.redacts = pinnedEventId;
        const redacted = makeEvent(pinnedEventId, {});
        redacted.event.unsigned = { redacted_because: redaction.event as IEvent };
        vi.mocked(client.fetchRoomEvent).mockResolvedValue(redacted.event as never);

        await act(async () => {
            await room.addLiveEvents([redaction], { addToState: false });
        });

        await waitFor(() => expect(result.current[0].isRedacted()).toBe(true));
        expect(result.current[0].getContent().body).toBeUndefined();
    });

    it("fetches only the redacted pinned event again", async () => {
        const otherEventId = "$other:server";
        const twoPinnedIds = [pinnedEventId, otherEventId];
        vi.mocked(client.fetchRoomEvent).mockImplementation(
            async (_roomId, eventId) => makeEvent(eventId, { msgtype: "m.text", body: eventId }).event as never,
        );
        const { result } = renderHook(() => useFetchedPinnedEvents(room, twoPinnedIds), { wrapper });
        await waitFor(() => expect(result.current).toHaveLength(2));
        vi.mocked(client.fetchRoomEvent).mockClear();

        const redaction = makeEvent("$redaction:server", {});
        redaction.event.type = EventType.RoomRedaction;
        redaction.event.redacts = pinnedEventId;
        const redacted = makeEvent(pinnedEventId, {});
        redacted.event.unsigned = { redacted_because: redaction.event as IEvent };
        vi.mocked(client.fetchRoomEvent).mockResolvedValue(redacted.event as never);

        await act(async () => {
            await room.addLiveEvents([redaction], { addToState: false });
        });

        await waitFor(() =>
            expect(result.current.find((event) => event.getId() === pinnedEventId)?.isRedacted()).toBe(true),
        );
        expect(client.fetchRoomEvent).toHaveBeenCalledTimes(1);
        expect(client.fetchRoomEvent).toHaveBeenCalledWith(room.roomId, pinnedEventId);
        expect(result.current.find((event) => event.getId() === otherEventId)?.getContent().body).toBe(otherEventId);
    });

    it("uses the room's copy of a pinned thread reply", async () => {
        vi.mocked(client.supportsThreads).mockReturnValue(true);
        room = new Room(roomId, client, userId);
        const { events } = await populateThread({ room, client, authorId: userId, participantUserIds: [userId] });
        const reply = events[events.length - 1];
        const replyIds = [reply.getId()!];
        // The reply lives in its thread's timeline only, like a real thread reply.
        expect(room.getUnfilteredTimelineSet().findEventById(reply.getId()!)).toBeUndefined();

        const { result } = renderHook(() => useFetchedPinnedEvents(room, replyIds), { wrapper });

        // The room redacts its own copy, for instance when a retention policy expires the reply.
        await waitFor(() => expect(result.current[0]).toBe(reply));
        expect(client.fetchRoomEvent).not.toHaveBeenCalled();
    });
});
