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
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mkEvent, stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import RoomTopic from "../../../../src/components/views/elements/RoomTopic";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";

jest.mock("../../../../src/dispatcher/dispatcher");

describe("<RoomTopic/>", () => {
    const originalHref = window.location.href;

    afterEach(() => {
        window.location.href = originalHref;
    });

    /**
     * Create a room with the given topic
     * @param topic
     */
    function createRoom(topic: string) {
        stubClient();
        const room = new Room("!pMBteVpcoJRdCJxDmn:matrix.org", MatrixClientPeg.safeGet(), "@alice:example.org");
        const topicEvent = mkEvent({
            type: "m.room.topic",
            room: "!pMBteVpcoJRdCJxDmn:matrix.org",
            user: "@alice:example.org",
            content: { topic },
            ts: 123,
            event: true,
        });
        room.addLiveEvents([topicEvent]);

        return room;
    }

    /**
     * Create a room and render it
     * @param topic
     */
    const renderRoom = (topic: string) => {
        const room = createRoom(topic);
        render(<RoomTopic room={room} />);
    };

    /**
     * Create a room and click on the given text
     * @param topic
     * @param clickText
     */
    function runClickTest(topic: string, clickText: string) {
        renderRoom(topic);
        fireEvent.click(screen.getByText(clickText));
    }

    it("should capture permalink clicks", () => {
        const permalink =
            "https://matrix.to/#/!pMBteVpcoJRdCJxDmn:matrix.org/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=matrix.org";
        const expectedHref =
            "http://localhost/#/room/!pMBteVpcoJRdCJxDmn:matrix.org/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=matrix.org";
        runClickTest(`... ${permalink} ...`, permalink);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledTimes(0);
    });

    it("should not capture non-permalink clicks", () => {
        const link = "https://matrix.org";
        const expectedHref = originalHref;
        runClickTest(`... ${link} ...`, link);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledTimes(0);
    });

    it("should open topic dialog when not clicking a link", () => {
        const topic = "foobar";
        const expectedHref = originalHref;
        runClickTest(topic, topic);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledWith(Action.ShowRoomTopic);
    });

    it("should open the tooltip when hovering a text", async () => {
        const topic = "room topic";
        renderRoom(topic);
        await userEvent.hover(screen.getByText(topic));
        await waitFor(() => expect(screen.getByRole("tooltip", { name: "Click to read topic" })).toBeInTheDocument());
    });

    it("should not open the tooltip when hovering a link", async () => {
        const topic = "https://matrix.org";
        renderRoom(topic);
        await userEvent.hover(screen.getByText(topic));
        await waitFor(() => expect(screen.queryByRole("tooltip", { name: "Click to read topic" })).toBeNull());
    });
});
