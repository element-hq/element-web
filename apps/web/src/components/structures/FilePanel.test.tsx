/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { EventStatus, EventTimelineSet, Filter, PendingEventOrdering, Room, RoomEvent } from "matrix-js-sdk/src/matrix";
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
