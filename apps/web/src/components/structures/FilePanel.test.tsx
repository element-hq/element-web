/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import {
    EventStatus,
    EventTimelineSet,
    Filter,
    type MatrixClient,
    type MatrixEvent,
    PendingEventOrdering,
    Room,
    RoomEvent,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { screen, render, waitFor } from "test-utils-rtl";
import { clientAndSDKContextRenderOptions, mkEvent, stubClient } from "test-utils";

import FilePanel from "./FilePanel";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { SDKContextClass } from "../../contexts/SDKContextClass.ts";

vi.mock("matrix-js-sdk/src/matrix", async () => ({
    ...(await vi.importActual("matrix-js-sdk/src/matrix")),
    TimelineWindow: vi.fn().mockImplementation(function () {
        return {
            load: vi.fn().mockResolvedValue(null),
            getEvents: vi.fn().mockReturnValue([]),
            canPaginate: vi.fn().mockReturnValue(false),
        };
    }),
}));

describe("FilePanel", () => {
    beforeEach(() => {
        stubClient();
    });

    it("renders empty state", async () => {
        const cli = MatrixClientPeg.safeGet();
        const room = new Room("!room:server", cli, cli.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        const timelineSet = new EventTimelineSet(room);
        room.getOrCreateFilteredTimelineSet = vi.fn().mockReturnValue(timelineSet);
        vi.mocked(cli.getRoom).mockReturnValue(room);

        const { asFragment } = render(
            <FilePanel roomId={room.roomId} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
        );
        await waitFor(() => {
            expect(screen.getByText("No files in this room")).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("does not show a pending message that its filter rejects", async () => {
        const cli = MatrixClientPeg.safeGet();
        const room = new Room("!room:server", cli, cli.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const filter = new Filter(cli.getSafeUserId());
        filter.setDefinition({ room: { timeline: { contains_url: true, types: ["m.room.message"] } } });
        const timelineSet = new EventTimelineSet(room, { filter });
        room.getOrCreateFilteredTimelineSet = vi.fn().mockReturnValue(timelineSet);
        vi.mocked(cli.getRoom).mockReturnValue(room);

        // A text message being sent carries no url, so the file filter rejects it. It is still one of
        // the room's pending events, which the panel is handed in full.
        const pending = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getSafeUserId(),
            room: room.roomId,
            content: { msgtype: "m.text", body: "a message being sent" },
        });
        pending.setStatus(EventStatus.SENDING);
        room.addPendingEvent(pending, "txn-text");

        render(
            <FilePanel roomId={room.roomId} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
        );
        await screen.findByText("No files in this room");

        expect(screen.queryByText("a message being sent")).not.toBeInTheDocument();
    });

    describe("files sent in threads", () => {
        const mkFile = (room: Room, body: string, threadRootId?: string): MatrixEvent =>
            mkEvent({
                event: true,
                type: "m.room.message",
                user: "@other:server",
                room: room.roomId,
                content: {
                    msgtype: "m.file",
                    body,
                    url: `mxc://server/${body}`,
                    ...(threadRootId && {
                        "m.relates_to": { rel_type: THREAD_RELATION_TYPE.name, event_id: threadRootId },
                    }),
                },
            });

        let cli: MatrixClient;
        let room: Room;

        beforeEach(() => {
            cli = MatrixClientPeg.safeGet();
            vi.mocked(cli.supportsThreads).mockReturnValue(true);
            room = new Room("!room:server", cli, cli.getSafeUserId(), {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            vi.mocked(cli.getRoom).mockReturnValue(room);
        });

        it("creates a timeline set which includes events sent in threads", async () => {
            const spy = vi.spyOn(room, "getOrCreateFilteredTimelineSet");

            render(
                <FilePanel roomId={room.roomId} onClose={vi.fn()} />,
                clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
            );
            await screen.findByText("No files in this room");

            expect(spy).toHaveBeenCalledWith(expect.any(Filter), { includeThreadedEvents: true });
            expect(spy.mock.results[0].value.includeThreadedEvents).toBe(true);
        });

        it("shows a file being sent in a thread", async () => {
            const root = mkFile(room, "root.pdf");
            await room.addLiveEvents([root], { addToState: false });

            const pending = mkFile(room, "thread-file.pdf", root.getId());
            pending.setStatus(EventStatus.SENDING);
            room.addPendingEvent(pending, "txn-thread-file");

            render(
                <FilePanel roomId={room.roomId} onClose={vi.fn()} />,
                clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
            );

            await expect(screen.findByText("thread-file.pdf")).resolves.toBeInTheDocument();
        });

        it("adds a decrypted file sent in a thread", async () => {
            const timelineSet = room.getOrCreateFilteredTimelineSet(new Filter(cli.getSafeUserId(), "files"), {
                includeThreadedEvents: true,
            });
            vi.spyOn(room, "getOrCreateFilteredTimelineSet").mockReturnValue(timelineSet);

            let filePanel: FilePanel | null = null;
            render(
                <FilePanel
                    roomId={room.roomId}
                    onClose={vi.fn()}
                    ref={(ref) => {
                        filePanel = ref;
                    }}
                />,
                clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
            );
            await screen.findByText("No files in this room");

            const root = mkFile(room, "root.pdf");
            await room.addLiveEvents([root], { addToState: false });
            const threadFile = mkFile(room, "thread-file.pdf", root.getId());
            filePanel!.addEncryptedLiveEvent(threadFile);

            expect(timelineSet.getLiveTimeline().getEvents()).toContain(threadFile);
        });
    });

    describe("addEncryptedLiveEvent", () => {
        it("should add file msgtype event to filtered timelineSet", async () => {
            const cli = MatrixClientPeg.safeGet();
            const room = new Room("!room:server", cli, cli.getSafeUserId(), {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            cli.reEmitter.reEmit(room, [RoomEvent.Timeline]);
            const timelineSet = new EventTimelineSet(room);
            room.getOrCreateFilteredTimelineSet = vi.fn().mockReturnValue(timelineSet);
            vi.mocked(cli.getRoom).mockReturnValue(room);

            let filePanel: FilePanel | null;
            render(
                <FilePanel
                    roomId={room.roomId}
                    onClose={vi.fn()}
                    ref={(ref) => {
                        filePanel = ref;
                    }}
                />,
                clientAndSDKContextRenderOptions(cli, SDKContextClass.instance),
            );
            await screen.findByText("No files in this room");

            const event = mkEvent({
                type: "m.room.message",
                user: cli.getSafeUserId(),
                room: room.roomId,
                content: {
                    body: "hello",
                    url: "mxc://matrix.org/1234",
                    msgtype: "m.file",
                },
                event: true,
            });
            filePanel!.addEncryptedLiveEvent(event);

            expect(timelineSet.getLiveTimeline().getEvents()).toContain(event);
        });
    });
});
