/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventTimelineSet, EventType, type MatrixClient, MsgType, RoomEvent } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkEvent } from "test-utils";

import { NotificationListViewModel } from "./NotificationListViewModel";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";

describe("NotificationListViewModel", () => {
    let client: MatrixClient;
    let timelineSet: EventTimelineSet;
    let vm: NotificationListViewModel;

    const addNotification = (id: string, highlight = false): void => {
        const ev = mkEvent({
            event: true,
            id,
            type: EventType.RoomMessage,
            room: "!room:server",
            user: "@alice:server",
            content: { msgtype: MsgType.Text, body: `hello ${id}` },
        });
        vi.mocked(client.getPushActionsForEvent).mockImplementation((e) =>
            e.getId() === id ? { notify: true, tweaks: { highlight } } : null,
        );
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
        vi.mocked(client.paginateEventTimeline).mockResolvedValue(false);
        vm = new NotificationListViewModel({ client });
    });

    afterEach(() => {
        vm.dispose();
        vi.restoreAllMocks();
    });

    it("paginates on creation when the timeline is empty", () => {
        expect(client.paginateEventTimeline).toHaveBeenCalledWith(timelineSet.getLiveTimeline(), {
            backwards: true,
            limit: 20,
        });
    });

    it("adds live notifications, newest first", () => {
        addNotification("$1");
        addNotification("$2", true);
        const { items } = vm.getSnapshot();
        expect(items.map((i) => i.id)).toEqual(["$2", "$1"]);
        expect(items[0]).toMatchObject({ roomId: "!room:server", isMention: true });
        expect(items[0].preview).toContain("hello $2");
    });

    it("stops paginating once the server has no more notifications", async () => {
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
        vm.loadMore();
        expect(client.paginateEventTimeline).toHaveBeenCalledTimes(1);
    });

    it("opens the room at the event on click", () => {
        const spy = vi.spyOn(defaultDispatcher, "dispatch");
        addNotification("$1");
        vm.onItemClick("$1");
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
