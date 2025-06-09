/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { mkEvent, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import RoomTopic from "../../../../../src/components/views/elements/RoomTopic";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";

jest.mock("../../../../../src/dispatcher/dispatcher");

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
        const room = new Room("!pMBteVpcoJRdCJxDmn:connect.vietsmile.com.vn", MatrixClientPeg.safeGet(), "@alice:example.org");
        const topicEvent = mkEvent({
            type: "m.room.topic",
            room: "!pMBteVpcoJRdCJxDmn:connect.vietsmile.com.vn",
            user: "@alice:example.org",
            content: { topic },
            ts: 123,
            event: true,
        });
        room.addLiveEvents([topicEvent], { addToState: true });

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
            "https://matrix.to/#/!pMBteVpcoJRdCJxDmn:connect.vietsmile.com.vn/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=connect.vietsmile.com.vn";
        const expectedHref =
            "http://localhost/#/room/!pMBteVpcoJRdCJxDmn:connect.vietsmile.com.vn/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=connect.vietsmile.com.vn";
        runClickTest(`... ${permalink} ...`, permalink);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledTimes(0);
    });

    it("should not capture non-permalink clicks", () => {
        const link = "https://connect.vietsmile.com.vn";
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
        const topic = "https://connect.vietsmile.com.vn";
        renderRoom(topic);
        await userEvent.hover(screen.getByText(topic));
        await waitFor(() => expect(screen.queryByRole("tooltip", { name: "Click to read topic" })).toBeNull());
    });
});
