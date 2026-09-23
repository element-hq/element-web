/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi, type MockedObject } from "vitest";
import { type IEvent, Room, PendingEventOrdering, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { stubClient, mkEvent, makeRoomWithStateEvents } from "test-utils";

import { RoomStateExplorer } from "./RoomState";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { DevtoolsContext } from "./BaseTool";

describe("<RoomStateExplorer />", () => {
    const roomId = "!roomId:example.com";
    const userId = "@alice:example.com";
    let cli: MockedObject<MatrixClient>;

    beforeEach(() => {
        cli = stubClient() as MockedObject<MatrixClient>;
    });

    function renderComponent(room: Room): ReturnType<typeof render> {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsContext.Provider value={{ room }}>
                    <RoomStateExplorer onBack={() => {}} setTool={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
    }

    it("should render", () => {
        const room = new Room(roomId, cli, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const { asFragment } = renderComponent(room);
        expect(asFragment()).toMatchSnapshot();
    });

    it("shows real room state and can check a single event", async () => {
        const nameEvent = mkEvent({
            event: true,
            type: "m.room.name",
            content: { name: "Test room" },
            room: roomId,
            user: userId,
        });
        const room = makeRoomWithStateEvents([nameEvent], { roomId, mockClient: cli });

        renderComponent(room);

        await userEvent.click(screen.getByRole("button", { name: "m.room.name" }));

        expect(screen.getByText(/Test room/)).toBeInTheDocument();
    });

    it("shows the history of a state event", async () => {
        const previousEvent = mkEvent({
            event: false,
            type: "m.room.topic",
            content: { topic: "Old topic" },
            room: roomId,
            user: userId,
            id: "$prevEventId",
        });
        const currentEvent = mkEvent({
            event: true,
            type: "m.room.topic",
            content: { topic: "New topic" },
            room: roomId,
            user: userId,
            id: "$currentEventId",
            unsigned: { replaces_state: "$prevEventId" },
        });
        vi.mocked(cli.fetchRoomEvent).mockResolvedValueOnce(previousEvent as unknown as IEvent);

        const room = makeRoomWithStateEvents([currentEvent], { roomId, mockClient: cli });

        renderComponent(room);

        await userEvent.click(screen.getByRole("button", { name: "m.room.topic" }));
        expect(screen.getByText(/New topic/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "See history" }));

        await waitFor(() => expect(screen.getByText(/Old topic/)).toBeInTheDocument());
        expect(screen.getByText(/New topic/)).toBeInTheDocument();
    });
});
