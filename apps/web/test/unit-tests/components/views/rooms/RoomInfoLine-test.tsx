/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import RoomInfoLine from "../../../../../src/components/views/rooms/RoomInfoLine.tsx";
import { stubClient } from "../../../../test-utils";

describe("RoomInfoLine", () => {
    it("renders for public room", () => {
        const cli = stubClient();
        const room = new Room("!roomId", cli, cli.getUserId()!);
        room.currentState.setStateEvents([
            new MatrixEvent({
                sender: cli.getUserId()!,
                room_id: room.roomId,
                state_key: "",
                event_id: "$eventId",
                type: "m.room.join_rules",
                content: {
                    join_rule: "public",
                },
            }),
        ]);

        const { asFragment, getByText } = render(<RoomInfoLine room={room} />);
        expect(getByText("Public room")).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });
});
