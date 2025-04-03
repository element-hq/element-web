/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { EventTimelineSet, PendingEventOrdering, Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { screen, render, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";

import FilePanel from "../../../../src/components/structures/FilePanel";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { mkEvent, stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

jest.mock("matrix-js-sdk/src/matrix", () => ({
    ...jest.requireActual("matrix-js-sdk/src/matrix"),
    TimelineWindow: jest.fn().mockReturnValue({
        load: jest.fn().mockResolvedValue(null),
        getEvents: jest.fn().mockReturnValue([]),
        canPaginate: jest.fn().mockReturnValue(false),
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
        room.getOrCreateFilteredTimelineSet = jest.fn().mockReturnValue(timelineSet);
        mocked(cli.getRoom).mockReturnValue(room);

        const { asFragment } = render(
            <FilePanel roomId={room.roomId} onClose={jest.fn()} resizeNotifier={new ResizeNotifier()} />,
        );
        await waitFor(() => {
            expect(screen.getByText("No files visible in this room")).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });

    describe("addEncryptedLiveEvent", () => {
        it("should add file msgtype event to filtered timelineSet", async () => {
            const cli = MatrixClientPeg.safeGet();
            const room = new Room("!room:server", cli, cli.getSafeUserId(), {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            cli.reEmitter.reEmit(room, [RoomEvent.Timeline]);
            const timelineSet = new EventTimelineSet(room);
            room.getOrCreateFilteredTimelineSet = jest.fn().mockReturnValue(timelineSet);
            mocked(cli.getRoom).mockReturnValue(room);

            let filePanel: FilePanel | null;
            render(
                <FilePanel
                    roomId={room.roomId}
                    onClose={jest.fn()}
                    resizeNotifier={new ResizeNotifier()}
                    ref={(ref) => {
                        filePanel = ref;
                    }}
                />,
            );
            await screen.findByText("No files visible in this room");

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
