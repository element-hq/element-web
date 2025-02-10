/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { act, render, screen } from "jest-matrix-react";

import { useTopic } from "../../src/hooks/room/useTopic";
import { mkEvent, stubClient } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";

describe("useTopic", () => {
    it("should display the room topic", () => {
        stubClient();
        const room = new Room("!TESTROOM", MatrixClientPeg.safeGet(), "@alice:example.org");
        const topic = mkEvent({
            type: "m.room.topic",
            room: "!TESTROOM",
            user: "@alice:example.org",
            content: {
                topic: "Test topic",
            },
            ts: 123,
            event: true,
        });

        room.addLiveEvents([topic], { addToState: true });

        function RoomTopic() {
            const topic = useTopic(room);
            return <p>{topic!.text}</p>;
        }

        render(<RoomTopic />);

        expect(screen.queryByText("Test topic")).toBeInTheDocument();

        const updatedTopic = mkEvent({
            type: "m.room.topic",
            room: "!TESTROOM",
            user: "@alice:example.org",
            content: {
                topic: "New topic",
            },
            ts: 666,
            event: true,
        });

        act(() => {
            room.addLiveEvents([updatedTopic], { addToState: true });
        });

        expect(screen.queryByText("New topic")).toBeInTheDocument();
    });
});
