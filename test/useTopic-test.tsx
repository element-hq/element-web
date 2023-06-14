/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";
import { act, render, screen } from "@testing-library/react";

import { useTopic } from "../src/hooks/room/useTopic";
import { mkEvent, stubClient } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";

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

        room.addLiveEvents([topic]);

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
            room.addLiveEvents([updatedTopic]);
        });

        expect(screen.queryByText("New topic")).toBeInTheDocument();
    });
});
