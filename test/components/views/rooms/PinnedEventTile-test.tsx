/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render } from "@testing-library/react";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import PinnedEventTile from "../../../../src/components/views/rooms/PinnedEventTile";
import { getMockClientWithEventEmitter } from "../../../test-utils";

describe("<PinnedEventTile />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const mockClient = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
    });
    const room = new Room(roomId, mockClient, userId);
    const permalinkCreator = new RoomPermalinkCreator(room);

    const getComponent = (event: MatrixEvent) =>
        render(<PinnedEventTile permalinkCreator={permalinkCreator} event={event} />);

    beforeEach(() => {
        mockClient.getRoom.mockReturnValue(room);
    });

    it("should render pinned event", () => {
        const pin1 = new MatrixEvent({
            type: "m.room.message",
            sender: userId,
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: roomId,
            origin_server_ts: 0,
        });

        const { container } = getComponent(pin1);

        expect(container).toMatchSnapshot();
    });

    it("should throw when pinned event has no sender", () => {
        const pin1 = new MatrixEvent({
            type: "m.room.message",
            sender: undefined,
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: roomId,
            origin_server_ts: 0,
        });

        expect(() => getComponent(pin1)).toThrow("Pinned event unexpectedly has no sender");
    });
});
