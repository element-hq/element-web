/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import {
    EventTimelineSet,
    EventType,
    type MatrixClient,
    MsgType,
    RoomEvent,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { createTestClient, mkEvent } from "test-utils";

import { NotificationListViewModel } from "./NotificationListViewModel";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";

describe("NotificationListViewModel", () => {
    let client: MatrixClient;
    let timelineSet: EventTimelineSet;
    let vm: NotificationListViewModel;
    let authedRequest: Mock;

    const highlights = new Set<string>();
    const addNotification = (
        id: string,
        {
            highlight = false,
            user = "@alice:server",
            room = "!room:server",
            threadRoot = undefined as string | undefined,
        } = {},
    ): void => {
        const ev = mkEvent({
            event: true,
            id,
            type: EventType.RoomMessage,
            room,
            user,
            content: {
                msgtype: MsgType.Text,
                body: `hello ${id}`,
                ...(threadRoot && { "m.relates_to": { rel_type: THREAD_RELATION_TYPE.name, event_id: threadRoot } }),
            },
        });
        if (highlight) highlights.add(id);
        timelineSet.addLiveEvent(ev, { addToState: false });
        client.emit(RoomEvent.Timeline, ev, undefined, false, false, {
            timeline: timelineSet.getLiveTimeline(),
            liveEvent: true,
        });
    };

    beforeEach(() => {
        client = createTestClient();
        timelineSet = new EventTimelineSet(undefined, { timelineSupport: true });
        client.getNotifTimelineSet = vi.fn().mockReturnValue(timelineSet);
        authedRequest = vi.fn().mockResolvedValue({ next_token: "", notifications: [] });
        // @ts-expect-error mocking the http api
        client.http = { authedRequest };
        client.getPushDetailsForEvent = vi.fn();
        highlights.clear();
        vi.mocked(client.getPushActionsForEvent).mockImplementation((e) => ({
            notify: true,
            tweaks: { highlight: highlights.has(e.getId()!) },
        }));
        vm = new NotificationListViewModel({ client });
    });

    afterEach(() => {
        vm.dispose();
        vi.restoreAllMocks();
    });

    it("fetches every notification, not only highlights, on creation", async () => {
        vm.dispose();
        authedRequest.mockResolvedValue({
            next_token: "",
            notifications: [
                {
                    room_id: "!dm:server",
                    actions: ["notify"],
                    ts: 1,
                    read: false,
                    event: {
                        event_id: "$old",
                        type: "m.room.message",
                        sender: "@bob:server",
                        origin_server_ts: 1,
                        content: { body: "hi" },
                    },
                },
            ],
        });
        vm = new NotificationListViewModel({ client });
        expect(authedRequest).toHaveBeenLastCalledWith("GET", "/notifications", { limit: "20" });
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
        expect(vm.getSnapshot().items).toEqual([expect.objectContaining({ id: "$old", roomId: "!dm:server" })]);
    });

    it("adds live notifications, newest first", () => {
        addNotification("$1");
        addNotification("$2", { user: "@bob:server", highlight: true });
        const { items } = vm.getSnapshot();
        expect(items.map((i) => i.id)).toEqual(["$2", "$1"]);
        expect(items[0]).toMatchObject({ roomId: "!room:server", isMention: true, count: 1 });
        expect(items[0].preview).toContain("hello $2");
    });

    it("groups consecutive notifications from the same sender in the same room", () => {
        addNotification("$1");
        addNotification("$2", { highlight: true });
        addNotification("$3", { user: "@bob:server" });
        addNotification("$4");
        addNotification("$5", { room: "!other:server" });
        const { items } = vm.getSnapshot();
        expect(items.map((i) => [i.id, i.count])).toEqual([
            ["$5", 1],
            ["$4", 1],
            ["$3", 1],
            ["$1", 2],
        ]);
        // The group points at its oldest event, shows its newest one, and is a mention if any event is
        expect(items[3].preview).toContain("hello $2");
        expect(items[3].isMention).toBe(true);
    });

    it("does not group notifications from different threads", () => {
        addNotification("$1", { threadRoot: "$rootA" });
        addNotification("$2", { threadRoot: "$rootB" });
        expect(vm.getSnapshot().items.map((i) => i.count)).toEqual([1, 1]);
    });

    it("stops paginating once the server has no more notifications", async () => {
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
        vm.loadMore();
        expect(authedRequest).toHaveBeenCalledTimes(1);
    });

    it("opens the room at the event on click", () => {
        const spy = vi.spyOn(defaultDispatcher, "dispatch");
        addNotification("$1");
        addNotification("$2");
        vm.onItemClick(vm.getSnapshot().items[0].id);
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                room_id: "!room:server",
                event_id: "$1",
                highlighted: true,
            }),
        );
    });
});
