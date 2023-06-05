/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { render, type RenderResult } from "@testing-library/react";
import { Room } from "matrix-js-sdk/src/models/room";

import { stubClient } from "../../../test-utils";
import SearchResultTile from "../../../../src/components/views/rooms/SearchResultTile";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

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
                        origin_server_ts: undefined,
                    }),
            ),
        });

        const separators = container.querySelectorAll(".mx_DateSeparator");
        // One separator is always rendered at the top, we don't want any
        // between messages.
        expect(separators.length).toBe(1);
    });
});
