/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";
import { MatrixEvent, Room, EventType } from "matrix-js-sdk/src/matrix";
import { render, type RenderResult } from "jest-matrix-react";

import { stubClient } from "../../../../test-utils";
import SearchResultTile from "../../../../../src/components/views/rooms/SearchResultTile";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

const ROOM_ID = "!qPewotXpIctQySfjSy:localhost";

type Props = React.ComponentPropsWithoutRef<typeof SearchResultTile>;

describe("SearchResultTile", () => {
    beforeAll(() => {
        stubClient();
        const cli = MatrixClientPeg.safeGet();

        const room = new Room(ROOM_ID, cli, "@bob:example.org");
        jest.spyOn(cli, "getRoom").mockReturnValue(room);
    });

    function renderComponent(props: Partial<Props>): RenderResult {
        return render(<SearchResultTile timeline={[]} ourEventsIndexes={[1]} {...props} />);
    }

    it("Sets up appropriate callEventGrouper for m.call. events", () => {
        const { container } = renderComponent({
            timeline: [
                new MatrixEvent({
                    type: EventType.CallInvite,
                    sender: "@user1:server",
                    room_id: ROOM_ID,
                    origin_server_ts: 1432735824652,
                    content: { call_id: "call.1" },
                    event_id: "$1:server",
                }),
                new MatrixEvent({
                    content: {
                        body: "This is an example text message",
                        format: "org.matrix.custom.html",
                        formatted_body: "<b>This is an example text message</b>",
                        msgtype: "m.text",
                    },
                    event_id: "$144429830826TWwbB:localhost",
                    origin_server_ts: 1432735824653,
                    room_id: ROOM_ID,
                    sender: "@example:example.org",
                    type: "m.room.message",
                    unsigned: {
                        age: 1234,
                    },
                }),
                new MatrixEvent({
                    type: EventType.CallAnswer,
                    sender: "@user2:server",
                    room_id: ROOM_ID,
                    origin_server_ts: 1432735824654,
                    content: { call_id: "call.1" },
                    event_id: "$2:server",
                }),
            ],
        });

        const tiles = container.querySelectorAll<HTMLElement>(".mx_EventTile");
        expect(tiles.length).toEqual(2);
        expect(tiles[0]!.dataset.eventId).toBe("$1:server");
        expect(tiles[1]!.dataset.eventId).toBe("$144429830826TWwbB:localhost");
    });

    it("supports events with missing timestamps", () => {
        const { container } = renderComponent({
            timeline: [...Array(20)].map(
                (_, i) =>
                    new MatrixEvent({
                        type: EventType.RoomMessage,
                        sender: "@user1:server",
                        room_id: ROOM_ID,
                        content: { body: `Message #${i}` },
                        event_id: `$${i}:server`,
                        origin_server_ts: i,
                    }),
            ),
        });

        const separators = container.querySelectorAll(".mx_TimelineSeparator");
        // One separator is always rendered at the top, we don't want any
        // between messages.
        expect(separators.length).toBe(1);
    });
});
