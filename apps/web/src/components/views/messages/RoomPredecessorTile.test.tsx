/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { act, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { stubClient, upsertRoomStateEvents, filterConsole, getRoomContext } from "test-utils";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from "../../../settings/SettingsStore";
import { guessServerNameFromRoomId, RoomPredecessorTile } from "./RoomPredecessorTile";
import { Action } from "../../../dispatcher/actions";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";

vi.mock("../../../dispatcher/dispatcher");

describe("<RoomPredecessorTile />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    stubClient();
    const client = vi.mocked(MatrixClientPeg.safeGet());

    function makeRoom({ createEventHasPredecessor = false }): Room {
        const room = new Room(roomId, client, userId);

        const createInfo = {
            type: EventType.RoomCreate,
            state_key: "",
            sender: userId,
            room_id: roomId,
            content: {},
            event_id: "$create",
        };

        if (createEventHasPredecessor) {
            createInfo.content = {
                predecessor: { room_id: "old_room_id", event_id: "$tombstone_event_id" },
            };
        }

        const createEvent = new MatrixEvent(createInfo);
        upsertRoomStateEvents(room, [createEvent]);
        return room;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(dis.dispatch).mockReset();
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        stubClient();
    });

    afterAll(() => {
        vi.spyOn(SettingsStore, "getValue").mockRestore();
        vi.spyOn(SettingsStore, "setValue").mockRestore();
    });

    function renderTile(room: Room) {
        // Find this room's create event (it should have one!)
        const createEvent = room.currentState.getStateEvents("m.room.create")[0];
        expect(createEvent).toBeTruthy();

        return render(
            <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                <RoomPredecessorTile mxEvent={createEvent} />
            </ScopedRoomContextProvider>,
        );
    }

    it("Renders as expected", () => {
        const roomCreate = renderTile(makeRoom({ createEventHasPredecessor: true }));
        expect(roomCreate.asFragment()).toMatchSnapshot();
    });

    it("Links to the old version of the room", () => {
        renderTile(makeRoom({ createEventHasPredecessor: true }));
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/$tombstone_event_id",
        );
    });

    describe("(filtering warnings about no predecessor)", () => {
        filterConsole("RoomPredecessorTile unexpectedly used in a room with no predecessor.");

        it("Shows an empty div if there is no predecessor", () => {
            renderTile(makeRoom({}));
            expect(screen.queryByText("Click here to see older messages.", { exact: false })).toBeNull();
        });
    });

    it("Opens the old room on click", async () => {
        renderTile(makeRoom({ createEventHasPredecessor: true }));
        const link = screen.getByText("Click here to see older messages.");

        await act(() => userEvent.click(link));

        await waitFor(() =>
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: "$tombstone_event_id",
                highlighted: true,
                room_id: "old_room_id",
                metricsTrigger: "Predecessor",
                metricsViaKeyboard: false,
            }),
        );
    });

    describe("If the predecessor room is not found", () => {
        filterConsole("Failed to find predecessor room with id old_room_id");

        beforeEach(() => {
            vi.mocked(MatrixClientPeg.safeGet().getRoom).mockReturnValue(null);
        });

        it("Shows an error if there are no via servers", () => {
            renderTile(makeRoom({ createEventHasPredecessor: true }));
            expect(screen.getByText("Can't find the old version of this room", { exact: false })).toBeInTheDocument();
        });
    });
});

describe("guessServerNameFromRoomId", () => {
    it("Extracts the domain name from a standard room ID", () => {
        expect(guessServerNameFromRoomId("!436456:example.com")).toEqual("example.com");
    });

    it("Extracts the domain name and port when included", () => {
        expect(guessServerNameFromRoomId("!436456:example.com:8888")).toEqual("example.com:8888");
    });

    it("Handles an IPv4 address for server name", () => {
        expect(guessServerNameFromRoomId("!436456:127.0.0.1")).toEqual("127.0.0.1");
    });

    it("Handles an IPv4 address and port", () => {
        expect(guessServerNameFromRoomId("!436456:127.0.0.1:81")).toEqual("127.0.0.1:81");
    });

    it("Handles an IPv6 address for server name", () => {
        expect(guessServerNameFromRoomId("!436456:::1")).toEqual("::1");
    });

    it("Handles an IPv6 address and port", () => {
        expect(guessServerNameFromRoomId("!436456:::1:8080")).toEqual("::1:8080");
    });

    it("Returns null when the room ID contains no colon", () => {
        expect(guessServerNameFromRoomId("!436456")).toBeNull();
    });
});
